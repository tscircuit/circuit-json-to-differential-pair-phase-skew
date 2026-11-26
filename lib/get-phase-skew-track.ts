import { blendTouchingRuns } from "./blend-touching-runs"
import { type CoupledRun, MIN_OVERLAP } from "./select-coupled-runs"
import type { TraceStep, TraceWalk } from "./walk-trace"

/**
 * A stretch of one trace, between two routed distances along its walk, with
 * phase skew changing linearly from `startPhaseSkewMm` to `endPhaseSkewMm`.
 */
export type PhaseSkewSpan = {
  startWalkDistanceMm: number
  endWalkDistanceMm: number
  startPhaseSkewMm: number
  endPhaseSkewMm: number
}

/** A stretch of one trace, between two routed distances along its walk, where phase skew is unknown. */
export type UnknownPhaseSkewSpan = {
  startWalkDistanceMm: number
  endWalkDistanceMm: number
  startPhaseSkewMm: null
  endPhaseSkewMm: null
}

/** Which trace of the pair a walk belongs to. */
type PairSide = "positive" | "negative"

/**
 * A coupled run seen from one trace: where it starts and ends on this trace
 * and on its partner, the phase skew at each end, and the length of any
 * layer change right at each end on either trace, all in mm.
 */
export type SideRun = {
  startWalkDistanceMm: number
  endWalkDistanceMm: number
  partnerStartWalkDistanceMm: number
  partnerEndWalkDistanceMm: number
  startPhaseSkewMm: number
  endPhaseSkewMm: number
  layerChangeLengthBeforeMm: number
  layerChangeLengthAfterMm: number
  partnerLayerChangeLengthBeforeMm: number
  partnerLayerChangeLengthAfterMm: number
}

/**
 * Returns the phase skew spans from pad to pad: measured on coupled runs
 * and interpolated across the intervening copper and terminal fanouts.
 */
export function getPhaseSkewTrack({
  runs,
  side,
  walk,
  partnerWalk,
}: {
  runs: CoupledRun[]
  side: PairSide
  walk: TraceWalk
  partnerWalk: TraceWalk
}): PhaseSkewSpan[] {
  const steps = walk.steps
  const sideRuns = getSideRuns({
    runs,
    side,
    steps,
    partnerSteps: partnerWalk.steps,
  })
  const first = sideRuns[0]
  const last = sideRuns.at(-1)
  if (first === undefined || last === undefined) return []

  const start = getPadAnchor({ walk, partnerWalk, edge: "start" })
  const end = getPadAnchor({ walk, partnerWalk, edge: "end" })
  const leading = interpolateUnmatchedSpan({ previous: start, run: first })
  const trailing = interpolateUnmatchedSpan({ previous: last, run: end })
  const spans = splitTerminalSpanAtVias({ span: leading, steps })
  let previousBlend: PhaseSkewSpan | null = null
  for (const [index, run] of sideRuns.entries()) {
    const previous = sideRuns[index - 1]
    const next = sideRuns[index + 1]
    if (previous !== undefined) {
      const between =
        previousBlend ?? interpolateUnmatchedSpan({ previous, run })
      if (
        between !== null &&
        between.endWalkDistanceMm - between.startWalkDistanceMm > MIN_OVERLAP
      ) {
        spans.push(between)
      }
    }

    let nextBlend: PhaseSkewSpan | null = null
    if (next !== undefined) {
      nextBlend = blendTouchingRuns({ previous: run, next })
    }

    const span: PhaseSkewSpan = {
      startWalkDistanceMm:
        previousBlend?.endWalkDistanceMm ?? run.startWalkDistanceMm,
      endWalkDistanceMm:
        nextBlend?.startWalkDistanceMm ?? run.endWalkDistanceMm,
      startPhaseSkewMm: previousBlend?.endPhaseSkewMm ?? run.startPhaseSkewMm,
      endPhaseSkewMm: nextBlend?.startPhaseSkewMm ?? run.endPhaseSkewMm,
    }
    if (previous === undefined && leading === null) {
      span.startPhaseSkewMm = start.endPhaseSkewMm
    }
    if (next === undefined && trailing === null) {
      span.endPhaseSkewMm = end.startPhaseSkewMm
    }
    spans.push(span)
    previousBlend = nextBlend
  }
  return spans.concat(splitTerminalSpanAtVias({ span: trailing, steps }))
}

/**
 * Splits a terminal fanout at any layer change within it. The unaccounted
 * length difference ramps over planar copper, with each via's height
 * added at its own location.
 */
function splitTerminalSpanAtVias({
  span,
  steps,
}: {
  span: PhaseSkewSpan | null
  steps: TraceStep[]
}): PhaseSkewSpan[] {
  if (span === null) return []
  const vias = steps.filter(
    (step) =>
      step.layerChangeLengthAfterMm > 0 &&
      step.startDistance + step.length >
        span.startWalkDistanceMm + MIN_OVERLAP &&
      step.startDistance + step.length + step.layerChangeLengthAfterMm <
        span.endWalkDistanceMm - MIN_OVERLAP,
  )
  if (vias.length === 0) return [span]

  const viaLengthMm = vias.reduce(
    (length, step) => length + step.layerChangeLengthAfterMm,
    0,
  )
  const planarLengthMm =
    span.endWalkDistanceMm - span.startWalkDistanceMm - viaLengthMm
  const planarSkewPerMm =
    (span.endPhaseSkewMm - span.startPhaseSkewMm - viaLengthMm) / planarLengthMm
  const spans: PhaseSkewSpan[] = []
  let startWalkDistanceMm = span.startWalkDistanceMm
  let startPhaseSkewMm = span.startPhaseSkewMm
  for (const step of vias) {
    const endWalkDistanceMm = step.startDistance + step.length
    const endPhaseSkewMm =
      startPhaseSkewMm +
      (endWalkDistanceMm - startWalkDistanceMm) * planarSkewPerMm
    spans.push({
      startWalkDistanceMm,
      endWalkDistanceMm,
      startPhaseSkewMm,
      endPhaseSkewMm,
    })
    startWalkDistanceMm = endWalkDistanceMm + step.layerChangeLengthAfterMm
    startPhaseSkewMm = endPhaseSkewMm + step.layerChangeLengthAfterMm
  }
  spans.push({ ...span, startWalkDistanceMm, startPhaseSkewMm })
  return spans
}

/**
 * Represents a pad as a point at the end of the clipped planar walk.
 * The final anchor includes any layer change that terminates at the pad.
 */
function getPadAnchor({
  walk,
  partnerWalk,
  edge,
}: {
  walk: TraceWalk
  partnerWalk: TraceWalk
  edge: "start" | "end"
}): SideRun {
  const walkDistanceMm = getPlanarEndDistance({ walk, edge })
  const partnerWalkDistanceMm = getPlanarEndDistance({
    walk: partnerWalk,
    edge,
  })
  let phaseSkewMm = 0
  if (edge === "end") phaseSkewMm = walk.length - partnerWalk.length
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

/** The coupled runs seen from `side`, with layer change lengths at their ends, in order along that trace. */
function getSideRuns({
  runs,
  side,
  steps,
  partnerSteps,
}: {
  runs: CoupledRun[]
  side: PairSide
  steps: TraceStep[]
  partnerSteps: TraceStep[]
}): SideRun[] {
  return runs
    .map((run) => {
      const {
        startWalkDistanceMm,
        endWalkDistanceMm,
        partnerStartWalkDistanceMm,
        partnerEndWalkDistanceMm,
      } = runEnds({ run, side })
      return {
        startWalkDistanceMm,
        endWalkDistanceMm,
        partnerStartWalkDistanceMm,
        partnerEndWalkDistanceMm,
        startPhaseSkewMm: startWalkDistanceMm - partnerStartWalkDistanceMm,
        endPhaseSkewMm: endWalkDistanceMm - partnerEndWalkDistanceMm,
        layerChangeLengthBeforeMm: getAdjacentLayerChangeLengthMm({
          steps,
          walkDistanceMm: startWalkDistanceMm,
          edge: "start",
        }),
        layerChangeLengthAfterMm: getAdjacentLayerChangeLengthMm({
          steps,
          walkDistanceMm: endWalkDistanceMm,
          edge: "end",
        }),
        partnerLayerChangeLengthBeforeMm: getAdjacentLayerChangeLengthMm({
          steps: partnerSteps,
          walkDistanceMm: partnerStartWalkDistanceMm,
          edge: "start",
        }),
        partnerLayerChangeLengthAfterMm: getAdjacentLayerChangeLengthMm({
          steps: partnerSteps,
          walkDistanceMm: partnerEndWalkDistanceMm,
          edge: "end",
        }),
      }
    })
    .sort((a, b) => a.startWalkDistanceMm - b.startWalkDistanceMm)
}

/** Where a coupled run starts and ends on one trace and on its partner, in mm along each walk. */
type RunEnds = {
  startWalkDistanceMm: number
  endWalkDistanceMm: number
  partnerStartWalkDistanceMm: number
  partnerEndWalkDistanceMm: number
}

/** A run's ends on `side` and on the partner trace. */
function runEnds({ run, side }: { run: CoupledRun; side: PairSide }): RunEnds {
  if (side === "positive") {
    return {
      startWalkDistanceMm: run.positiveStartDistanceMm,
      endWalkDistanceMm: run.positiveEndDistanceMm,
      partnerStartWalkDistanceMm: run.negativeStartDistanceMm,
      partnerEndWalkDistanceMm: run.negativeEndDistanceMm,
    }
  }
  return {
    startWalkDistanceMm: run.negativeStartDistanceMm,
    endWalkDistanceMm: run.negativeEndDistanceMm,
    partnerStartWalkDistanceMm: run.positiveStartDistanceMm,
    partnerEndWalkDistanceMm: run.positiveEndDistanceMm,
  }
}

/**
 * The interpolated span between two consecutive coupled runs, from just
 * after any via ending the first to just before any via starting the second,
 * or null when they touch.
 */
function interpolateUnmatchedSpan({
  previous,
  run,
}: {
  previous: SideRun
  run: SideRun
}): PhaseSkewSpan | null {
  const startWalkDistanceMm =
    previous.endWalkDistanceMm + previous.layerChangeLengthAfterMm
  const endWalkDistanceMm =
    run.startWalkDistanceMm - run.layerChangeLengthBeforeMm
  if (endWalkDistanceMm - startWalkDistanceMm <= MIN_OVERLAP) return null
  const phaseSkewAfterPreviousRunMm =
    previous.endPhaseSkewMm +
    previous.layerChangeLengthAfterMm -
    previous.partnerLayerChangeLengthAfterMm
  const partnerHasCopperGap =
    run.partnerStartWalkDistanceMm -
      (previous.partnerEndWalkDistanceMm +
        previous.partnerLayerChangeLengthAfterMm) >
    MIN_OVERLAP
  // If the partner had only a single via between the two runs, that via
  // was already accounted for at `previous.partnerLayerChangeLengthAfterMm`.
  let partnerLayerChangeLengthBeforeMm = 0
  if (partnerHasCopperGap) {
    partnerLayerChangeLengthBeforeMm = run.partnerLayerChangeLengthBeforeMm
  }
  return {
    startWalkDistanceMm,
    endWalkDistanceMm,
    startPhaseSkewMm: phaseSkewAfterPreviousRunMm,
    endPhaseSkewMm:
      run.startPhaseSkewMm -
      run.layerChangeLengthBeforeMm +
      partnerLayerChangeLengthBeforeMm,
  }
}

/** Z-distance of any layer change directly before the start or after the end of a step at `walkDistanceMm`, in mm. */
function getAdjacentLayerChangeLengthMm({
  steps,
  walkDistanceMm,
  edge,
}: {
  steps: TraceStep[]
  walkDistanceMm: number
  edge: "start" | "end"
}): number {
  let low = 0
  let high = steps.length
  while (low < high) {
    const middle = (low + high) >> 1
    if (
      edgeDistance({ step: steps[middle]!, edge }) <
      walkDistanceMm - MIN_OVERLAP
    ) {
      low = middle + 1
      continue
    }
    high = middle
  }
  for (let index = low; index < steps.length; index++) {
    const step = steps[index]
    if (
      !step ||
      !(edgeDistance({ step, edge }) <= walkDistanceMm + MIN_OVERLAP)
    )
      break
    const length = edgeLayerChangeLengthMm({ step, edge })
    if (length > 0) return length
  }
  return 0
}

/** Distance along the walk to a step's start or end, in mm. */
function edgeDistance({
  step,
  edge,
}: {
  step: TraceStep
  edge: "start" | "end"
}): number {
  if (edge === "start") return step.startDistance
  return step.startDistance + step.length
}

/** Z-distance of the layer changes directly before a step's start or after its end, in mm. */
function edgeLayerChangeLengthMm({
  step,
  edge,
}: {
  step: TraceStep
  edge: "start" | "end"
}): number {
  if (edge === "start") return step.layerChangeLengthBeforeMm
  return step.layerChangeLengthAfterMm
}
