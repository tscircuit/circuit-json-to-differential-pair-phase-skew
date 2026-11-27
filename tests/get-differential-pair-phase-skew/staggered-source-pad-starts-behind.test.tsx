import { expect, test } from "bun:test"
import { getDifferentialPairPhaseSkew } from "lib/index"
import { renderPairBoard } from "tests/fixtures/pair-board"

test("a source pad level with its partner's fanout starts with the partner's lead", async () => {
  // Like a DDR DQS fanout: DN's pad sits 1 mm closer to the coupled run
  // than DP's and runs straight, while DP jogs out and back. Across DN's
  // pad, DP has already run about 1.25 mm, so DN starts behind, not at zero.
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

  const [pair] = getDifferentialPairPhaseSkew({ circuitJson })

  expect(pair.positive_trace.segments[0].start_length_difference_mm).toBe(0)
  expect(
    pair.negative_trace.segments[0].start_length_difference_mm,
  ).toBeLessThan(-1)
})
