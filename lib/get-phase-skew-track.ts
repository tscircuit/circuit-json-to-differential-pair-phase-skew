import { type CoupledRun, MIN_OVERLAP } from "./select-coupled-runs"
import type { TraceStep } from "./walk-trace"

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
type SideRun = {
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
 * Returns the known phase skew spans on one trace: measured on coupled runs
 * and interpolated between them. Via lengths step at the via, where there
 * is no planar copper, instead of ramping across the uncoupled stretch.
 */
export function getPhaseSkewTrack({
  runs,
  side,
  steps,
  partnerSteps,
}: {
  runs: CoupledRun[]
  side: PairSide
  steps: TraceStep[]
  partnerSteps: TraceStep[]
}): PhaseSkewSpan[] {
  const sideRuns = getSideRuns({ runs, side, steps, partnerSteps })
  const spans: PhaseSkewSpan[] = []
  for (const [index, run] of sideRuns.entries()) {
    const previous = sideRuns[index - 1]
    if (previous !== undefined) {
      const unmatchedSpan = interpolateUnmatchedSpan({ previous, run })
      if (unmatchedSpan !== null) spans.push(unmatchedSpan)
    }
    spans.push({
      startWalkDistanceMm: run.startWalkDistanceMm,
      endWalkDistanceMm: run.endWalkDistanceMm,
      startPhaseSkewMm: run.startPhaseSkewMm,
      endPhaseSkewMm: run.endPhaseSkewMm,
    })
  }
  return spans
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
