import type { Point } from "circuit-json"
import type { SideRun } from "./get-phase-skew-track"
import { MIN_OVERLAP } from "./select-coupled-runs"
import type { TraceStep, TraceWalk } from "./walk-trace"

/**
 * Represents a pad as a point at the end of the clipped planar walk, with
 * the phase skew across the pad's cross-section of the pair. The
 * cross-section is perpendicular to the nearest coupled run, so a pad
 * level with the middle of its partner's fanout starts with the partner's
 * length so far, while a pad its partner hasn't reached yet starts at zero.
 * At the end, the skew falls back to the end-to-end length difference,
 * including any layer change that terminates at the pad.
 */
export function getPadAnchor({
  walk,
  partnerWalk,
  run,
  edge,
}: {
  walk: TraceWalk
  partnerWalk: TraceWalk
  run: SideRun
  edge: "start" | "end"
}): SideRun {
  const walkDistanceMm = getPlanarEndDistance({ walk, edge })
  const partnerPadDistanceMm = getPlanarEndDistance({
    walk: partnerWalk,
    edge,
  })
  const partnerWalkDistanceMm = getPartnerAnchorDistance({
    walk,
    partnerWalk,
    run,
    edge,
    walkDistanceMm,
    partnerPadDistanceMm,
  })
  let selfDistanceMm = walkDistanceMm
  if (edge === "end") selfDistanceMm = walk.length
  const phaseSkewMm = selfDistanceMm - partnerWalkDistanceMm
  return {
    startWalkDistanceMm: walkDistanceMm,
    endWalkDistanceMm: walkDistanceMm,
    partnerStartWalkDistanceMm: partnerWalkDistanceMm,
    partnerEndWalkDistanceMm: partnerWalkDistanceMm,
    startPhaseSkewMm: phaseSkewMm,
    endPhaseSkewMm: phaseSkewMm,
    layerChangeLengthBeforeMm: 0,
    layerChangeLengthAfterMm: 0,
    partnerLayerChangeLengthBeforeMm: 0,
    partnerLayerChangeLengthAfterMm: 0,
  }
}

/** A line through a pad across the pair, perpendicular to the nearest coupled run. */
type PadCrossSection = {
  pad: Point
  /** Unit direction from the pad toward the coupled run. */
  towardRun: Point
  /** A partner pad closer to the line than this, in mm, is level with the pad. */
  levelToleranceMm: number
}

/** A stretch of a partner's fanout, ordered from the coupled run toward the pad. */
type FanoutPiece = {
  step: TraceStep
  nearRunDistanceMm: number
  nearPadDistanceMm: number
}

/** The partner's walked distance across this pad's cross-section, in mm. */
function getPartnerAnchorDistance({
  walk,
  partnerWalk,
  run,
  edge,
  walkDistanceMm,
  partnerPadDistanceMm,
}: {
  walk: TraceWalk
  partnerWalk: TraceWalk
  run: SideRun
  edge: "start" | "end"
  walkDistanceMm: number
  partnerPadDistanceMm: number
}): number {
  let fallbackDistanceMm = partnerPadDistanceMm
  if (edge === "end") fallbackDistanceMm = partnerWalk.length
  const crossSection = getPadCrossSection({ walk, run, edge, walkDistanceMm })
  const partnerPadStep = findStepAt({
    steps: partnerWalk.steps,
    distanceMm: partnerPadDistanceMm,
    edge,
  })
  if (crossSection === null || partnerPadStep === undefined) {
    return fallbackDistanceMm
  }
  const partnerPadAheadMm = getDistanceAheadMm({
    point: pointAt({ step: partnerPadStep, distanceMm: partnerPadDistanceMm }),
    crossSection,
  })
  if (partnerPadAheadMm > crossSection.levelToleranceMm) {
    if (edge === "start") return 0
    return fallbackDistanceMm
  }
  if (partnerPadAheadMm >= -crossSection.levelToleranceMm) {
    return fallbackDistanceMm
  }

  let partnerRunDistanceMm = run.partnerEndWalkDistanceMm
  if (edge === "start") partnerRunDistanceMm = run.partnerStartWalkDistanceMm
  const pieces = getFanoutPieces({
    steps: partnerWalk.steps,
    edge,
    partnerRunDistanceMm,
    partnerPadDistanceMm,
  })
  for (const { step, nearRunDistanceMm, nearPadDistanceMm } of pieces) {
    const nearRunAheadMm = getDistanceAheadMm({
      point: pointAt({ step, distanceMm: nearRunDistanceMm }),
      crossSection,
    })
    if (nearRunAheadMm <= 0) return fallbackDistanceMm
    const nearPadAheadMm = getDistanceAheadMm({
      point: pointAt({ step, distanceMm: nearPadDistanceMm }),
      crossSection,
    })
    if (nearPadAheadMm > 0) continue
    return (
      nearRunDistanceMm +
      ((nearPadDistanceMm - nearRunDistanceMm) * nearRunAheadMm) /
        (nearRunAheadMm - nearPadAheadMm)
    )
  }
  return fallbackDistanceMm
}

/** The line through this trace's pad, perpendicular to its copper where the coupled run begins or ends. */
function getPadCrossSection({
  walk,
  run,
  edge,
  walkDistanceMm,
}: {
  walk: TraceWalk
  run: SideRun
  edge: "start" | "end"
  walkDistanceMm: number
}): PadCrossSection | null {
  let runDistanceMm = run.endWalkDistanceMm
  if (edge === "start") runDistanceMm = run.startWalkDistanceMm
  const runStep = findStepAt({
    steps: walk.steps,
    distanceMm: runDistanceMm,
    edge,
  })
  const padStep = findStepAt({
    steps: walk.steps,
    distanceMm: walkDistanceMm,
    edge,
  })
  if (runStep === undefined || padStep === undefined) return null
  let towardRunScale = 1 / runStep.length
  if (edge === "end") towardRunScale = -towardRunScale
  return {
    pad: pointAt({ step: padStep, distanceMm: walkDistanceMm }),
    towardRun: {
      x: (runStep.end.x - runStep.start.x) * towardRunScale,
      y: (runStep.end.y - runStep.start.y) * towardRunScale,
    },
    levelToleranceMm: runStep.width,
  }
}

/** How far `point` lies past the pad's cross-section toward the coupled run, in mm. */
function getDistanceAheadMm({
  point,
  crossSection,
}: {
  point: Point
  crossSection: PadCrossSection
}): number {
  const { pad, towardRun } = crossSection
  return (point.x - pad.x) * towardRun.x + (point.y - pad.y) * towardRun.y
}

/** The partner's planar copper between the coupled run and its pad, ordered from the run. */
function getFanoutPieces({
  steps,
  edge,
  partnerRunDistanceMm,
  partnerPadDistanceMm,
}: {
  steps: TraceStep[]
  edge: "start" | "end"
  partnerRunDistanceMm: number
  partnerPadDistanceMm: number
}): FanoutPiece[] {
  const low = Math.min(partnerRunDistanceMm, partnerPadDistanceMm)
  const high = Math.max(partnerRunDistanceMm, partnerPadDistanceMm)
  const pieces = steps
    .filter(
      (step) =>
        isDrawableStep(step) &&
        step.startDistance < high - MIN_OVERLAP &&
        step.startDistance + step.length > low + MIN_OVERLAP,
    )
    .map((step) => {
      const startDistanceMm = Math.max(step.startDistance, low)
      const endDistanceMm = Math.min(step.startDistance + step.length, high)
      if (edge === "start") {
        return {
          step,
          nearRunDistanceMm: endDistanceMm,
          nearPadDistanceMm: startDistanceMm,
        }
      }
      return {
        step,
        nearRunDistanceMm: startDistanceMm,
        nearPadDistanceMm: endDistanceMm,
      }
    })
  if (edge === "start") return pieces.reverse()
  return pieces
}

/** The planar step covering `distanceMm`, preferring the one leaving it at the start and arriving at it at the end. */
function findStepAt({
  steps,
  distanceMm,
  edge,
}: {
  steps: TraceStep[]
  distanceMm: number
  edge: "start" | "end"
}): TraceStep | undefined {
  const covers = (step: TraceStep) =>
    isDrawableStep(step) &&
    step.startDistance <= distanceMm + MIN_OVERLAP &&
    step.startDistance + step.length >= distanceMm - MIN_OVERLAP
  if (edge === "start") return steps.findLast(covers)
  return steps.find(covers)
}

/** The point `distanceMm` along the walk, within `step`. */
function pointAt({
  step,
  distanceMm,
}: {
  step: TraceStep
  distanceMm: number
}): Point {
  const t = (distanceMm - step.startDistance) / step.length
  return {
    x: step.start.x + (step.end.x - step.start.x) * t,
    y: step.start.y + (step.end.y - step.start.y) * t,
  }
}

/** Distance to the first or last point of planar copper, excluding a via behind that point. */
function getPlanarEndDistance({
  walk,
  edge,
}: {
  walk: TraceWalk
  edge: "start" | "end"
}): number {
  if (edge === "start") {
    const first = walk.steps.find(isDrawableStep)
    return first?.startDistance ?? 0
  }
  const last = walk.steps.findLast(isDrawableStep)
  if (last === undefined) return walk.length
  return last.startDistance + last.length
}

/** Planar copper that can contribute a rendered phase skew segment. */
function isDrawableStep(step: TraceStep): boolean {
  return (
    step.length > MIN_OVERLAP && step.width > 0 && Number.isFinite(step.width)
  )
}
