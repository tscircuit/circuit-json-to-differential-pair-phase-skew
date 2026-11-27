import { expect, test } from "bun:test"
import { renderPairBoard } from "tests/fixtures/pair-board"
import { phaseSkewSvg } from "tests/fixtures/phase-skew-svg"

test("renders phase skew from staggered source pads", async () => {
  // DN's pad sits 1 mm closer to the coupled run than DP's, as in a DDR
  // DQS fanout, while DP jogs out and back.
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
  await expect(phaseSkewSvg(circuitJson)).toMatchSvgSnapshot(import.meta.path)
})
