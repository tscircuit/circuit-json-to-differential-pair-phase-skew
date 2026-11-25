import type { PcbDifferentialPairPhaseSkewSegment } from "circuit-json"

/** Horizontal segment lookup by X and optional Y, in PCB coordinates. */
type SegmentAtXOptions = {
  segments: PcbDifferentialPairPhaseSkewSegment[]
  x: number
  y?: number
}

/** The horizontal segment covering a point where phase skew is known. */
export function segmentAtX({
  segments,
  x,
  y,
}: SegmentAtXOptions): PcbDifferentialPairPhaseSkewSegment | undefined {
  return segments.find(
    (candidate) =>
      candidate.start.y === candidate.end.y &&
      (y === undefined || Math.abs(candidate.start.y - y) < 1e-9) &&
      Math.min(candidate.start.x, candidate.end.x) <= x &&
      Math.max(candidate.start.x, candidate.end.x) >= x,
  )
}

/** The interpolated phase skew at X, or undefined where there is no segment. */
export function phaseSkewAtX(options: SegmentAtXOptions): number | undefined {
  const segment = segmentAtX(options)
  if (!segment) return undefined
  const fraction =
    (options.x - segment.start.x) / (segment.end.x - segment.start.x)
  return (
    segment.start_length_difference_mm +
    fraction *
      (segment.end_length_difference_mm - segment.start_length_difference_mm)
  )
}
