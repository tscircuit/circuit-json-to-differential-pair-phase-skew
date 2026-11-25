import { expect, test } from "bun:test"
import { getDifferentialPairPhaseSkew } from "lib/index"
import { renderPairBoard } from "tests/fixtures/pair-board"
import { phaseSkewSvg } from "tests/fixtures/phase-skew-svg"
import { phaseSkewAtX } from "tests/fixtures/segment-at-x"

test("without pcbTraceGap, a short closer neck-down doesn't uncouple the main run", async () => {
  // DN steps 0.3 mm closer to DP between x = -2 and x = -1.
  const circuitJson = await renderPairBoard({
    positivePath: [],
    negativePath: [
      { x: 10, y: 0 },
      { x: 10, y: 0.3 },
      { x: 11, y: 0.3 },
      { x: 11, y: 0 },
    ],
  })
  const [pair] = getDifferentialPairPhaseSkew({ circuitJson })

  // Measured on both sides of the neck-down, which adds 0.6 mm to DN.
  expect(phaseSkewAtX({ segments: pair.positive_trace.segments, x: -8 })).toBe(
    0,
  )
  expect(
    phaseSkewAtX({ segments: pair.positive_trace.segments, x: 6 }),
  ).toBeCloseTo(-0.6, 5)

  await expect(phaseSkewSvg(circuitJson)).toMatchSvgSnapshot(import.meta.path)
})
