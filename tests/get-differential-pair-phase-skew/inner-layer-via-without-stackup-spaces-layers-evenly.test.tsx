import { expect, test } from "bun:test"
import { cju } from "@tscircuit/circuit-json-util"
import { getDifferentialPairPhaseSkew } from "lib/index"
import { renderPairBoard } from "tests/fixtures/pair-board"
import { phaseSkewSvg } from "tests/fixtures/phase-skew-svg"
import { phaseSkewAtX } from "tests/fixtures/segment-at-x"

/** Spacing between neighbouring copper layers of a 1.6 mm, 4-layer board with evenly spaced layers, in mm. */
const LAYER_SPACING_MM = 1.6 / 3

test("without a stackup, a via to an inner layer spans only the evenly spaced layers between", async () => {
  // A 1.6 mm 4-layer board with no pcb_stackup: DN hops top -> inner1 -> top.
  // The length is estimated with evenly spaced copper layers, so each via
  // is a third of the board thick, not all of it.
  const circuitJson = await renderPairBoard({
    positivePath: [],
    negativePath: [
      { x: 6, y: 0, via: true, fromLayer: "top", toLayer: "inner1" },
      { x: 18, y: 0, via: true, fromLayer: "inner1", toLayer: "top" },
    ],
    pcbTraceGap: "0.45mm",
    layers: 4,
  })
  expect(cju(circuitJson).pcb_stackup.list()).toEqual([])

  const [pair] = getDifferentialPairPhaseSkew({ circuitJson })
  const { segments } = pair.positive_trace
  expect(phaseSkewAtX({ segments, x: 0 })).toBeCloseTo(-LAYER_SPACING_MM, 5)
  expect(phaseSkewAtX({ segments, x: 9 })).toBeCloseTo(-2 * LAYER_SPACING_MM, 5)
  expect(
    pair.positive_trace.segments.at(-1)?.end_length_difference_mm,
  ).toBeCloseTo(-2 * LAYER_SPACING_MM, 5)
  await expect(phaseSkewSvg(circuitJson)).toMatchSvgSnapshot(import.meta.path)
})
