import { expect, test } from "bun:test"
import { cju } from "@tscircuit/circuit-json-util"
import { getDifferentialPairPhaseSkew } from "lib/index"
import { renderPairBoard } from "tests/fixtures/pair-board"
import { phaseSkewSvg } from "tests/fixtures/phase-skew-svg"
import { phaseSkewAtX } from "tests/fixtures/segment-at-x"

test("each via adds the same length to skew as to trace_length", async () => {
  // Both traces take the same path, but DN hops to the bottom layer and
  // back between x = -6 and x = 6.
  const circuitJson = await renderPairBoard({
    positivePath: [],
    negativePath: [
      { x: 6, y: 0, via: true, fromLayer: "top", toLayer: "bottom" },
      { x: 18, y: 0, via: true, fromLayer: "bottom", toLayer: "top" },
    ],
    pcbTraceGap: "0.45mm",
  })

  const [positiveLength, negativeLength] = cju(circuitJson)
    .pcb_trace.list()
    .map((trace) => trace.trace_length ?? Number.NaN)
  const [pair] = getDifferentialPairPhaseSkew({ circuitJson })

  expect(phaseSkewAtX({ segments: pair.positive_trace.segments, x: -9 })).toBe(
    0,
  )
  expect(
    phaseSkewAtX({ segments: pair.positive_trace.segments, x: 9 }),
  ).toBeCloseTo(positiveLength - negativeLength, 5)
  expect(
    phaseSkewAtX({ segments: pair.positive_trace.segments, x: 9 }),
  ).toBeLessThan(0)
  expect(
    pair.positive_trace.segments.at(-1)?.end_length_difference_mm,
  ).toBeCloseTo(positiveLength - negativeLength, 5)

  await expect(phaseSkewSvg(circuitJson)).toMatchSvgSnapshot(import.meta.path)
})
