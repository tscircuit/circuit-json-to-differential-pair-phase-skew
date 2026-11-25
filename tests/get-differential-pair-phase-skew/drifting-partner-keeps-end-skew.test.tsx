import { expect, test } from "bun:test"
import { getDifferentialPairPhaseSkew } from "lib/index"
import { renderPairBoard } from "tests/fixtures/pair-board"
import { maximumAbsolutePhaseSkew } from "tests/fixtures/phase-skew-endpoints"
import { phaseSkewSvg } from "tests/fixtures/phase-skew-svg"

/** DN's slanted 20 mm run is this much longer than DP's straight one, in mm. */
const SLANT_EXTRA_LENGTH = Math.hypot(20, 0.1) - 20

test("a slightly slanted partner keeps the skew it builds along the run", async () => {
  // DN runs from x = -10 to x = 10 while drifting 0.1 mm away from DP.
  const circuitJson = await renderPairBoard({
    positivePath: [{ x: 2, y: 0 }],
    negativePath: [
      { x: 2, y: 0 },
      { x: 22, y: -0.1 },
    ],
    pcbTraceGap: "0.45mm",
  })
  const [pair] = getDifferentialPairPhaseSkew({ circuitJson })

  // The run's skew grows from 0 to the slant's extra length; the maximum
  // comes from its end, not its middle.
  expect(maximumAbsolutePhaseSkew(pair)).toBeCloseTo(SLANT_EXTRA_LENGTH, 5)
  const slanted = pair.negative_trace.segments.filter(
    (segment) => segment.start.y !== segment.end.y,
  )
  expect(slanted).toHaveLength(1)
  expect(slanted[0].start_length_difference_mm).toBe(0)
  expect(slanted[0].end_length_difference_mm).toBeCloseTo(SLANT_EXTRA_LENGTH, 5)

  await expect(phaseSkewSvg(circuitJson)).toMatchSvgSnapshot(import.meta.path)
})
