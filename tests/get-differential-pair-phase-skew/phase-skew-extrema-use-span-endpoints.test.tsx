import { expect, test } from "bun:test"
import { getDifferentialPairPhaseSkew } from "lib/index"
import { renderPairBoard } from "tests/fixtures/pair-board"
import { phaseSkewEndpoints } from "tests/fixtures/phase-skew-endpoints"
import { phaseSkewSvg } from "tests/fixtures/phase-skew-svg"

/** DN's slanted 20 mm run is ~0.00196 mm longer than DP's straight run. */
const SLANT_EXTRA_LENGTH = Math.hypot(20, 0.28) - 20

/** Total extra length including the final fanout back to the pad. */
const TOTAL_EXTRA_LENGTH = SLANT_EXTRA_LENGTH + Math.hypot(2, 0.28) - 2

test("each trace's phase skew extrema come from known span endpoints, not piece midpoints", async () => {
  // DN slants 0.28 mm over 20 mm (still parallel at cos ~0.999902) inside a
  // 0.8 mm gap, so the whole run is coupled and its phase skew ramps from 0
  // to ~0.00196 mm at its end.
  const circuitJson = await renderPairBoard({
    positivePath: [{ x: 2, y: 0 }],
    negativePath: [
      { x: 2, y: 0 },
      { x: 22, y: -0.28 },
    ],
    pcbTraceGap: "0.8mm",
  })

  const [pair] = getDifferentialPairPhaseSkew({ circuitJson })
  expect(Math.max(0, ...phaseSkewEndpoints(pair.negative_trace))).toBeCloseTo(
    TOTAL_EXTRA_LENGTH,
    5,
  )
  expect(Math.min(0, ...phaseSkewEndpoints(pair.negative_trace))).toBe(0)
  expect(Math.max(0, ...phaseSkewEndpoints(pair.positive_trace))).toBe(0)
  expect(Math.min(0, ...phaseSkewEndpoints(pair.positive_trace))).toBeCloseTo(
    -TOTAL_EXTRA_LENGTH,
    5,
  )

  await expect(phaseSkewSvg(circuitJson)).toMatchSvgSnapshot(import.meta.path)
})
