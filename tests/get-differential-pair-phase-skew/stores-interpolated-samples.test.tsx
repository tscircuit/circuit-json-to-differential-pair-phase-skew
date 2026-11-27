import { expect, test } from "bun:test"
import { pcb_differential_pair_phase_skew } from "circuit-json"
import { getDifferentialPairPhaseSkew } from "lib/index"
import { renderPairBoard } from "tests/fixtures/pair-board"

test("stores intermediate signed values without changing either trace's measured path", async () => {
  const circuitJson = await renderPairBoard({
    positivePath: [
      { x: 0.6, y: 0.6 },
      { x: 1.6, y: 0.6 },
      { x: 2.2, y: 0 },
    ],
    negativePath: [],
    negativeSourcePadX: -11,
    pcbTraceGap: "0.45mm",
  })
  const spacingMm = 0.1
  const [original] = getDifferentialPairPhaseSkew({ circuitJson })
  const [sampled] = getDifferentialPairPhaseSkew({
    circuitJson,
    sample_spacing_mm: spacingMm,
  })
  expect(pcb_differential_pair_phase_skew.parse(sampled)).toEqual(sampled)
  for (const side of ["positive_trace", "negative_trace"] as const) {
    expect(sampled[side].pcb_trace_id).toBe(original[side].pcb_trace_id)
    const pieces = sampled[side].segments
    expect(pieces.length).toBeGreaterThan(original[side].segments.length)

    let offset = 0
    let foundInterpolatedRamp = false
    for (const segment of original[side].segments) {
      const lengthMm = Math.hypot(
        segment.end.x - segment.start.x,
        segment.end.y - segment.start.y,
      )
      const count = Math.ceil(lengthMm / spacingMm)
      const first = pieces[offset]
      expect(first.start).toEqual(segment.start)
      expect(first.start_length_difference_mm).toBe(
        segment.start_length_difference_mm,
      )
      for (let i = 0; i < count; i++) {
        const piece = pieces[offset + i]
        expect(piece.layer).toBe(segment.layer)
        expect(piece.width).toBe(segment.width)
        expect(
          Math.hypot(piece.end.x - piece.start.x, piece.end.y - piece.start.y),
        ).toBeLessThanOrEqual(spacingMm + 1e-12)
        if (i > 0) {
          expect(piece.start).toEqual(pieces[offset + i - 1].end)
          expect(piece.start_length_difference_mm).toBe(
            pieces[offset + i - 1].end_length_difference_mm,
          )
        }
        const fraction = (i + 1) / count
        const fromMm = segment.start_length_difference_mm
        const toMm = segment.end_length_difference_mm
        expect(piece.end_length_difference_mm).toBeCloseTo(
          fromMm * (1 - fraction) + toMm * fraction,
          12,
        )
        if (i + 1 < count && fromMm !== toMm) foundInterpolatedRamp = true
      }
      const last = pieces[offset + count - 1]
      expect(last.end).toEqual(segment.end)
      expect(last.end_length_difference_mm).toBe(
        segment.end_length_difference_mm,
      )
      offset += count
    }
    expect(offset).toBe(pieces.length)
    expect(foundInterpolatedRamp).toBe(true)
  }
})
