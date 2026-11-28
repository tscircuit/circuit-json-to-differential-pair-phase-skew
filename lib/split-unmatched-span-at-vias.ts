import type { PhaseSkewSpan } from "./get-phase-skew-track"
import { MIN_OVERLAP } from "./select-coupled-runs"
import type { TraceStep } from "./walk-trace"

/**
 * Splits an unmatched span at any layer change within it so planar length
 * differences ramp over planar copper while each via steps at its own location.
 */
export function splitUnmatchedSpanAtVias({
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
