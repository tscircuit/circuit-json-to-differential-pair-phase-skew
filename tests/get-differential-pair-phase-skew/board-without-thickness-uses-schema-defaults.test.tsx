import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { getDifferentialPairPhaseSkew } from "lib/index"
import { renderPairBoard } from "tests/fixtures/pair-board"

/** circuit-json's pcb_board schema default thickness, in mm. */
const SCHEMA_DEFAULT_BOARD_THICKNESS_MM = 1.4

test("a board record without thickness or num_layers uses the pcb_board schema defaults", async () => {
  // DN hops top -> bottom -> top. Older or unparsed Circuit JSON can omit a
  // board's thickness and layer count, which the pcb_board schema defaults
  // to 1.4 mm and 4 layers, so each via spans the whole 1.4 mm.
  const circuitJson = await renderPairBoard({
    positivePath: [],
    negativePath: [
      { x: 6, y: 0, via: true, fromLayer: "top", toLayer: "bottom" },
      { x: 18, y: 0, via: true, fromLayer: "bottom", toLayer: "top" },
    ],
    pcbTraceGap: "0.45mm",
  })
  const circuitJsonWithoutBoardDimensions = circuitJson.map(
    (element): AnyCircuitElement => {
      if (element.type !== "pcb_board") return element
      const {
        thickness: _thickness,
        num_layers: _numLayers,
        ...boardWithoutDimensions
      } = element
      return { ...boardWithoutDimensions } as AnyCircuitElement
    },
  )

  const [pair] = getDifferentialPairPhaseSkew({
    circuitJson: circuitJsonWithoutBoardDimensions,
  })
  expect(
    pair.positive_trace.segments.at(-1)?.end_length_difference_mm,
  ).toBeCloseTo(-2 * SCHEMA_DEFAULT_BOARD_THICKNESS_MM, 5)
  expect(pair.negative_trace.segments.map((segment) => segment.layer)).toEqual([
    "top",
    "bottom",
    "top",
  ])
})
