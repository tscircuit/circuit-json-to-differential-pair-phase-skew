import { expect, test } from "bun:test"
import { getDifferentialPairPhaseSkew } from "lib/index"
import { renderPairBoard } from "tests/fixtures/pair-board"
import { phaseSkewSvg } from "tests/fixtures/phase-skew-svg"
import { phaseSkewAtX } from "tests/fixtures/segment-at-x"

test("coupling stops partway along a step where the partner drifts out of spacing", async () => {
  // DN slants from 0.70 mm to 0.98 mm away from DP between x = -10 and
  // x = 10. The 0.45 mm gap and 0.15 mm traces give a 0.72 mm main-pass
  // limit. The load pad pitch extends the reach to 0.90 mm, which the
  // traces exceed near x = 4.3.
  const circuitJson = await renderPairBoard({
    positivePath: [],
    negativePath: [
      { x: 2, y: -0.1 },
      { x: 22, y: -0.38 },
    ],
    pcbTraceGap: "0.45mm",
  })
  const [pair] = getDifferentialPairPhaseSkew({ circuitJson })

  // Measured up to x = 4.3 (by x = 0 DN's 0.1 mm entry jog has added
  // 2.50 µm and its slant 0.98 µm), and unknown after it.
  expect(
    phaseSkewAtX({ segments: pair.positive_trace.segments, x: 0 }),
  ).toBeCloseTo(-0.00348, 5)
  expect(
    phaseSkewAtX({ segments: pair.positive_trace.segments, x: 5 }),
  ).toBeUndefined()

  await expect(phaseSkewSvg(circuitJson)).toMatchSvgSnapshot(import.meta.path)
})
