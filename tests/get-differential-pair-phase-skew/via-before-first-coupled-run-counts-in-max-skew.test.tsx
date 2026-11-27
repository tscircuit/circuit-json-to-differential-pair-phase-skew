import { expect, test } from "bun:test"
import { getDifferentialPairPhaseSkew } from "lib/index"
import { renderPairBoard } from "tests/fixtures/pair-board"
import { phaseSkewSvg } from "tests/fixtures/phase-skew-svg"
import { phaseSkewAtX } from "tests/fixtures/segment-at-x"

test("phase skew starts at zero before the first coupled run", async () => {
  // DN starts away from DP and makes two layer changes. DP catches up
  // by the time the two traces couple on top.
  const circuitJson = await renderPairBoard({
    positivePath: [
      { x: 4, y: 0 },
      { x: 4, y: 3.6 },
      { x: 6, y: 3.6 },
      { x: 6, y: 0 },
    ],
    negativePath: [
      { x: 0, y: -2 },
      { x: 2, y: -2 },
      { x: 2, y: 0, via: true, fromLayer: "top", toLayer: "bottom" },
      { x: 18, y: 0, via: true, fromLayer: "bottom", toLayer: "top" },
    ],
    pcbTraceGap: "0.45mm",
  })

  const [pair] = getDifferentialPairPhaseSkew({ circuitJson })

  for (const { segments } of [pair.positive_trace, pair.negative_trace]) {
    expect(segments[0].start.x).toBe(-12)
    expect(segments[0].start_length_difference_mm).toBe(0)
  }
  const via = pair.negative_trace.segments.findIndex(
    (segment) => segment.end.x === -10 && segment.end.y === -0.3,
  )
  const segments = pair.negative_trace.segments
  expect(segments[via].layer).toBe("top")
  expect(segments[via + 1].layer).toBe("bottom")
  expect(
    segments[via + 1].start_length_difference_mm -
      segments[via].end_length_difference_mm,
  ).toBeCloseTo(1.6, 5)
  expect(phaseSkewAtX({ segments: pair.positive_trace.segments, x: 9 })).toBe(0)

  await expect(phaseSkewSvg(circuitJson)).toMatchSvgSnapshot(import.meta.path)
})
