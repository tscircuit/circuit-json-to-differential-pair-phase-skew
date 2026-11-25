import type { PcbDifferentialPairPhaseSkewSegment, Point } from "circuit-json"
import type { PhaseSkewSpan } from "./get-phase-skew-track"
import { roundPhaseSkew } from "./round-phase-skew"
import { MIN_OVERLAP } from "./select-coupled-runs"
import type { TraceStep } from "./walk-trace"

/** Cuts planar copper at known span boundaries and zero crossings. */
export function getPhaseSkewSegments({
  steps,
  spans,
}: {
  steps: TraceStep[]
  spans: PhaseSkewSpan[]
}): PcbDifferentialPairPhaseSkewSegment[] {
  const segments: PcbDifferentialPairPhaseSkewSegment[] = []
  let spanIndex = 0
  for (const step of steps) {
    if (step.width <= 0 || !Number.isFinite(step.width)) continue
    const stepEnd = step.startDistance + step.length
    while (
      spanIndex < spans.length &&
      spans[spanIndex]!.endWalkDistanceMm <= step.startDistance
    ) {
      spanIndex++
    }
    for (let index = spanIndex; index < spans.length; index++) {
      const span = spans[index]!
      if (span.startWalkDistanceMm >= stepEnd) break
      const from = Math.max(step.startDistance, span.startWalkDistanceMm)
      const to = Math.min(stepEnd, span.endWalkDistanceMm)
      if (to - from <= MIN_OVERLAP) continue
      const startPhaseSkewMm = phaseSkewAt({ span, distance: from })
      const endPhaseSkewMm = phaseSkewAt({ span, distance: to })
      if (
        !Number.isFinite(startPhaseSkewMm) ||
        !Number.isFinite(endPhaseSkewMm)
      )
        continue
      const start = pointAt({ step, distance: from })
      const end = pointAt({ step, distance: to })
      const segment = {
        start,
        end,
        layer: step.layer,
        width: step.width,
        start_length_difference_mm: roundPhaseSkew(startPhaseSkewMm),
        end_length_difference_mm: roundPhaseSkew(endPhaseSkewMm),
      }
      if (startPhaseSkewMm * endPhaseSkewMm >= 0) {
        if (start.x !== end.x || start.y !== end.y) segments.push(segment)
        continue
      }
      const zeroFraction =
        startPhaseSkewMm / (startPhaseSkewMm - endPhaseSkewMm)
      const zero = pointAt({
        step,
        distance: from + (to - from) * zeroFraction,
      })
      if (start.x !== zero.x || start.y !== zero.y) {
        segments.push({ ...segment, end: zero, end_length_difference_mm: 0 })
      }
      if (zero.x !== end.x || zero.y !== end.y) {
        segments.push({
          ...segment,
          start: zero,
          start_length_difference_mm: 0,
        })
      }
    }
  }
  return segments
}

/** The length difference in mm at a distance inside a known span. */
function phaseSkewAt({
  span,
  distance,
}: {
  span: PhaseSkewSpan
  distance: number
}): number {
  const fraction =
    (distance - span.startWalkDistanceMm) /
    (span.endWalkDistanceMm - span.startWalkDistanceMm)
  return (1 - fraction) * span.startPhaseSkewMm + fraction * span.endPhaseSkewMm
}

/** The point in PCB coordinates at a distance along the whole walk. */
function pointAt({
  step,
  distance,
}: {
  step: TraceStep
  distance: number
}): Point {
  if (distance === step.startDistance) return step.start
  if (distance === step.startDistance + step.length) return step.end
  const fraction = (distance - step.startDistance) / step.length
  return {
    x: step.start.x + (step.end.x - step.start.x) * fraction,
    y: step.start.y + (step.end.y - step.start.y) * fraction,
  }
}
