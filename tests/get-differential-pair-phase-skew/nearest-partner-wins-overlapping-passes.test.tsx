import { expect, test } from "bun:test"
import { getDifferentialPairPhaseSkew } from "lib/index"
import { renderPairBoard } from "tests/fixtures/pair-board"
import { phaseSkewSvg } from "tests/fixtures/phase-skew-svg"
import { phaseSkewAtX } from "tests/fixtures/segment-at-x"

/** Extra length the negative trace runs while doubling back, in mm. */
const DOUBLE_BACK_LENGTH = 0.3 + 6 + 0.3 + 6

test("when the negative trace passes the positive one twice, the nearer pass is used", async () => {
  // DN runs beside DP to x = 2, doubles back to x = -4, then runs beside DP
  // again 0.6 mm farther out. Both passes are within the 1 mm gap.
  const circuitJson = await renderPairBoard({
    positivePath: [],
    negativePath: [
      { x: 14, y: 0 },
      { x: 14, y: -0.3 },
      { x: 8, y: -0.3 },
      { x: 8, y: -0.6 },
      { x: 24, y: -0.6 },
      { x: 24, y: 0 },
    ],
    pcbTraceGap: "1mm",
  })
  const [pair] = getDifferentialPairPhaseSkew({ circuitJson })

  const segments = pair.positive_trace.segments
  expect(phaseSkewAtX({ segments, x: 0 })).toBe(0)
  expect(phaseSkewAtX({ segments, x: 8 })).toBeCloseTo(-DOUBLE_BACK_LENGTH, 5)
  // Where both passes are within the gap, DP is still matched only once.
  const coveringX0 = segments.filter(
    (segment) => segment.start.x <= 0 && segment.end.x >= 0,
  )
  expect(coveringX0).toHaveLength(1)
  for (const segment of segments) {
    expect(segment.start_length_difference_mm).toBeLessThanOrEqual(0)
    expect(segment.start_length_difference_mm).toBeGreaterThanOrEqual(
      -DOUBLE_BACK_LENGTH - 1e-5,
    )
  }

  await expect(phaseSkewSvg(circuitJson)).toMatchSvgSnapshot(import.meta.path)
})
