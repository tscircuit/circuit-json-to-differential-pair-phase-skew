import { expect, test } from "bun:test"
import { getDifferentialPairPhaseSkew } from "lib/index"
import { renderPairBoard } from "tests/fixtures/pair-board"
import { phaseSkewSvg } from "tests/fixtures/phase-skew-svg"
import { phaseSkewAtX } from "tests/fixtures/segment-at-x"

/** How far DN drops over its 20 mm slant: 2°, just past the 0.8° parallel limit. */
const SLANT_DROP = 20 * Math.tan((2 * Math.PI) / 180)

test("a partner angled 2° away is not coupled, even within the spacing", async () => {
  // DN slants away from x = -11 to 9; its first 3.4 mm stay within the
  // 0.72 mm spacing allowance.
  const circuitJson = await renderPairBoard({
    positivePath: [],
    negativePath: [
      { x: 1, y: 0 },
      { x: 21, y: -SLANT_DROP },
      { x: 21, y: 0 },
    ],
    pcbTraceGap: "0.45mm",
  })
  const [pair] = getDifferentialPairPhaseSkew({ circuitJson })

  expect(
    phaseSkewAtX({ segments: pair.positive_trace.segments, x: -11.5 }),
  ).toBe(0)
  // Measured, x = -10 would be almost 0. Uncoupled, the 0.71 mm DN adds
  // ramps in over the 20 mm slant.
  expect(
    phaseSkewAtX({ segments: pair.positive_trace.segments, x: -10 }),
  ).toBeCloseTo(-0.035, 2)

  await expect(phaseSkewSvg(circuitJson)).toMatchSvgSnapshot(import.meta.path)
})
