import type {
  PcbDifferentialPairPhaseSkew,
  PcbDifferentialPairPhaseSkewTrace,
} from "circuit-json"

/** The length differences at the ends of a trace's known segments, in mm. */
export function phaseSkewEndpoints(
  trace: PcbDifferentialPairPhaseSkewTrace,
): number[] {
  return trace.segments.flatMap((segment) => [
    segment.start_length_difference_mm,
    segment.end_length_difference_mm,
  ])
}

/** The largest length difference magnitude across both traces' segments, in mm. */
export function maximumAbsolutePhaseSkew(
  pair: PcbDifferentialPairPhaseSkew,
): number {
  return Math.max(
    ...phaseSkewEndpoints(pair.positive_trace).map(Math.abs),
    ...phaseSkewEndpoints(pair.negative_trace).map(Math.abs),
  )
}
