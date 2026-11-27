import type {
  PcbDifferentialPairPhaseSkew,
  PcbDifferentialPairPhaseSkewSegment,
  PcbDifferentialPairPhaseSkewTrace,
} from "circuit-json"

// Reject accidental payload growth from requests for tiny sample intervals.
const MAX_ADDED_SAMPLES = 100_000

/** Stores samples as extra segment endpoints without changing the Circuit JSON schema. */
export function samplePhaseSkewPairs({
  pairs,
  spacingMm,
}: {
  pairs: PcbDifferentialPairPhaseSkew[]
  spacingMm: number
}): PcbDifferentialPairPhaseSkew[] {
  let addedSamples = 0
  for (const pair of pairs) {
    for (const trace of [pair.positive_trace, pair.negative_trace]) {
      for (const segment of trace.segments) {
        addedSamples += countParts({ segment, spacingMm }) - 1
        if (addedSamples > MAX_ADDED_SAMPLES) {
          throw new RangeError(
            "sample_spacing_mm would add more than 100,000 samples; increase the spacing",
          )
        }
      }
    }
  }
  return pairs.map((pair) => ({
    ...pair,
    positive_trace: sampleTrace({ trace: pair.positive_trace, spacingMm }),
    negative_trace: sampleTrace({ trace: pair.negative_trace, spacingMm }),
  }))
}

/** Number of equal-length pieces needed to respect the maximum spacing. */
function countParts({
  segment,
  spacingMm,
}: {
  segment: PcbDifferentialPairPhaseSkewSegment
  spacingMm: number
}): number {
  return Math.max(
    1,
    Math.ceil(
      Math.hypot(
        segment.end.x - segment.start.x,
        segment.end.y - segment.start.y,
      ) / spacingMm,
    ),
  )
}

/** Subdivides each measured segment independently, keeping gaps and layer changes. */
function sampleTrace({
  trace,
  spacingMm,
}: {
  trace: PcbDifferentialPairPhaseSkewTrace
  spacingMm: number
}): PcbDifferentialPairPhaseSkewTrace {
  return {
    ...trace,
    segments: trace.segments.flatMap((segment) =>
      sampleSegment({ segment, count: countParts({ segment, spacingMm }) }),
    ),
  }
}

/** Inserts stored values on the original line without moving either endpoint. */
function sampleSegment({
  segment,
  count,
}: {
  segment: PcbDifferentialPairPhaseSkewSegment
  count: number
}): PcbDifferentialPairPhaseSkewSegment[] {
  if (count === 1) return [segment]
  const pieces: PcbDifferentialPairPhaseSkewSegment[] = []
  const { x, y } = segment.start
  const dx = segment.end.x - x
  const dy = segment.end.y - y
  const initialDifferenceMm = segment.start_length_difference_mm
  const deltaMm = segment.end_length_difference_mm - initialDifferenceMm
  let start = segment.start
  let startDifferenceMm = initialDifferenceMm
  for (let index = 1; index < count; index++) {
    const fraction = index / count
    const end = { x: x + dx * fraction, y: y + dy * fraction }
    const endDifferenceMm = initialDifferenceMm + deltaMm * fraction
    pieces.push({
      ...segment,
      start,
      end,
      start_length_difference_mm: startDifferenceMm,
      end_length_difference_mm: endDifferenceMm,
    })
    start = end
    startDifferenceMm = endDifferenceMm
  }
  pieces.push({
    ...segment,
    start,
    start_length_difference_mm: startDifferenceMm,
  })
  return pieces
}
