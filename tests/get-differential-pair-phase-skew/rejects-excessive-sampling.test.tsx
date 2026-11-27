import { expect, test } from "bun:test"
import { getDifferentialPairPhaseSkew } from "lib/index"
import { renderPairBoard } from "tests/fixtures/pair-board"

test("rejects sampling that exceeds the limit across both traces", async () => {
  const circuitJson = await renderPairBoard({
    positivePath: [],
    negativePath: [],
    pcbTraceGap: "0.45mm",
  })
  const [pair] = getDifferentialPairPhaseSkew({ circuitJson })
  expect(pair.positive_trace.segments).toHaveLength(1)
  expect(pair.negative_trace.segments).toHaveLength(1)
  const segment = pair.positive_trace.segments[0]
  const lengthMm = Math.hypot(
    segment.end.x - segment.start.x,
    segment.end.y - segment.start.y,
  )
  expect(() =>
    getDifferentialPairPhaseSkew({
      circuitJson,
      sample_spacing_mm: lengthMm / 60_000,
    }),
  ).toThrow("add more than 100,000 samples")
})
