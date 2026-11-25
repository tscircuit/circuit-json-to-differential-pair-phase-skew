import { expect, test } from "bun:test"
import { getDifferentialPairPhaseSkew } from "lib/index"
import { renderPairBoard } from "tests/fixtures/pair-board"
import { phaseSkewSvg } from "tests/fixtures/phase-skew-svg"
import { phaseSkewAtX } from "tests/fixtures/segment-at-x"

test("a 0.02 mm stretch beside the partner is measured, not lost between samples", async () => {
  // DN leaves DP at x = -11, returns beside it only for 0 <= x <= 0.02,
  // then leaves again until just before the load.
  const circuitJson = await renderPairBoard({
    positivePath: [],
    negativePath: [
      { x: 1, y: 0 },
      { x: 1, y: -3 },
      { x: 12, y: -3 },
      { x: 12, y: 0 },
      { x: 12.02, y: 0 },
      { x: 12.02, y: -3 },
      { x: 23, y: -3 },
      { x: 23, y: 0 },
    ],
    pcbTraceGap: "0.45mm",
  })
  const [pair] = getDifferentialPairPhaseSkew({ circuitJson })

  // DN has run 1 + 3 + 11 + 3 mm more than DP's 12 mm to reach x = 0.
  expect(
    phaseSkewAtX({ segments: pair.positive_trace.segments, x: 0.01 }),
  ).toBeCloseTo(-6, 5)

  await expect(phaseSkewSvg(circuitJson)).toMatchSvgSnapshot(import.meta.path)
})
