import { expect, test } from "bun:test"
import { getDifferentialPairPhaseSkew } from "lib/index"
import { renderPairBoard } from "tests/fixtures/pair-board"
import { maximumAbsolutePhaseSkew } from "tests/fixtures/phase-skew-endpoints"
import { phaseSkewSvg } from "tests/fixtures/phase-skew-svg"
import { phaseSkewAtX } from "tests/fixtures/segment-at-x"

test("phase skew ramps between matched runs where the traces split apart", async () => {
  // DN drops 6 mm away between x = -6 and x = 6.
  const circuitJson = await renderPairBoard({
    positivePath: [],
    negativePath: [
      { x: 6, y: 0 },
      { x: 6, y: -6 },
      { x: 18, y: -6 },
      { x: 18, y: 0 },
    ],
    pcbTraceGap: "0.45mm",
  })
  const [pair] = getDifferentialPairPhaseSkew({ circuitJson })

  expect(phaseSkewAtX({ segments: pair.positive_trace.segments, x: -9 })).toBe(
    0,
  )
  // Halfway through the split, skew is halfway from 0 to the 12 mm detour.
  expect(
    phaseSkewAtX({ segments: pair.positive_trace.segments, x: 0 }),
  ).toBeCloseTo(-6, 1)

  expect(
    phaseSkewAtX({
      segments: pair.negative_trace.segments,
      x: 0,
    }),
  ).toBeCloseTo(6, 1)
  const ramp = pair.positive_trace.segments.filter(
    (segment) => segment.start.x >= -6 && segment.end.x <= 6,
  )
  expect(ramp).toHaveLength(1)
  expect(ramp[0].start_length_difference_mm).toBe(0)
  expect(ramp[0].end_length_difference_mm).toBe(-12)
  // Only the measured stretches count toward the maximum: 12 mm of detour.
  expect(maximumAbsolutePhaseSkew(pair)).toBeCloseTo(12, 5)

  await expect(phaseSkewSvg(circuitJson)).toMatchSvgSnapshot(import.meta.path)
})
