import { expect, test } from "bun:test"
import { getDifferentialPairPhaseSkew } from "lib/index"
import { renderPairBoard } from "tests/fixtures/pair-board"
import { phaseSkewSvg } from "tests/fixtures/phase-skew-svg"

test("copper running beside the partner in the opposite direction is not coupled", async () => {
  // DN loops away, then runs right-to-left beside DP (anti-parallel), then
  // returns to its load far from DP.
  const circuitJson = await renderPairBoard({
    positivePath: [],
    negativePath: [
      { x: 0, y: -4.7 },
      { x: 23, y: -4.7 },
      { x: 23, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: -1.2 },
      { x: 24, y: -1.2 },
    ],
    pcbTraceGap: "0.45mm",
  })
  expect(getDifferentialPairPhaseSkew({ circuitJson })).toEqual([])

  await expect(phaseSkewSvg(circuitJson)).toMatchSvgSnapshot(import.meta.path)
})
