import { expect, test } from "bun:test"
import { getDifferentialPairPhaseSkew } from "lib/index"
import { type PairPathPoint, renderPairBoard } from "tests/fixtures/pair-board"
import { maximumAbsolutePhaseSkew } from "tests/fixtures/phase-skew-endpoints"
import { phaseSkewSvg } from "tests/fixtures/phase-skew-svg"
import { phaseSkewAtX, segmentAtX } from "tests/fixtures/segment-at-x"

/** Drops to the bottom layer at x = -6 and returns at x = 6. */
const BOTTOM_LAYER_HOP: PairPathPoint[] = [
  { x: 6, y: 0, via: true, fromLayer: "top", toLayer: "bottom" },
  { x: 18, y: 0, via: true, fromLayer: "bottom", toLayer: "top" },
]

test("the run between two vias is coupled on the bottom layer", async () => {
  const circuitJson = await renderPairBoard({
    positivePath: BOTTOM_LAYER_HOP,
    negativePath: BOTTOM_LAYER_HOP,
    pcbTraceGap: "0.45mm",
  })
  const [pair] = getDifferentialPairPhaseSkew({ circuitJson })

  for (const segments of [
    pair.positive_trace.segments,
    pair.negative_trace.segments,
  ]) {
    const between = segmentAtX({ segments, x: 0 })
    expect(between?.layer).toBe("bottom")
    expect(phaseSkewAtX({ segments, x: 0 })).toBe(0)
  }
  expect(maximumAbsolutePhaseSkew(pair)).toBe(0)

  await expect(phaseSkewSvg(circuitJson)).toMatchSvgSnapshot(import.meta.path)
})
