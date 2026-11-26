import { expect, test } from "bun:test"
import { getDifferentialPairPhaseSkew } from "lib/index"
import { renderPairBoard } from "tests/fixtures/pair-board"
import { phaseSkewSvg } from "tests/fixtures/phase-skew-svg"
import { phaseSkewAtX } from "tests/fixtures/segment-at-x"

test("phase skew after the last coupled run reaches the end-to-end length difference", async () => {
  // DP runs straight on top; DN drops to bottom at x = -6, returns to top at
  // x = 10, and jogs 2 mm away so it never recouples. The coupled run on
  // [-12, -6] has zero skew, but DN's asymmetric ending via at x = -6 adds
  // a known 1.6 mm step right after the run.
  const circuitJson = await renderPairBoard({
    positivePath: [],
    negativePath: [
      { x: 6, y: 0, via: true, fromLayer: "top", toLayer: "bottom" },
      { x: 22, y: 0, via: true, fromLayer: "bottom", toLayer: "top" },
      { x: 22, y: -2 },
      { x: 24, y: -2 },
    ],
    pcbTraceGap: "0.45mm",
  })

  const [pair] = getDifferentialPairPhaseSkew({ circuitJson })

  expect(phaseSkewAtX({ segments: pair.positive_trace.segments, x: -9 })).toBe(
    0,
  )
  // The full walk includes both 1.6 mm vias and both 2 mm fanout jogs.
  expect(pair.end_to_end_length_difference_mm).toBe(-7.2)
  const positive = pair.positive_trace.segments.at(-1)
  const negative = pair.negative_trace.segments.at(-1)
  expect(positive?.end.x).toBe(12)
  expect(negative?.end.x).toBe(12)
  expect(positive?.end_length_difference_mm).toBe(
    pair.end_to_end_length_difference_mm,
  )
  expect(negative?.end_length_difference_mm).toBe(
    -pair.end_to_end_length_difference_mm,
  )

  await expect(phaseSkewSvg(circuitJson)).toMatchSvgSnapshot(import.meta.path)
})
