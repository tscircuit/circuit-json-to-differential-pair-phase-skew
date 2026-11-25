import { expect, test } from "bun:test"
import { pcb_differential_pair_phase_skew } from "circuit-json"
import { getDifferentialPairPhaseSkew } from "lib/index"
import { renderCircuit } from "tests/fixtures/render-circuit"
import {
  CustomColorsBoard,
  LayerChangeBoard,
  LoadEndMeanderBoard,
  LocalCompensationBoard,
  MatchedPairBoard,
} from "tests/fixtures/stroke-example-boards"

test("each measured pair produces a valid PCB phase skew element", async () => {
  const boards = [
    <MatchedPairBoard />,
    <LoadEndMeanderBoard />,
    <LocalCompensationBoard />,
    <LayerChangeBoard />,
    <CustomColorsBoard />,
  ]
  const measuredPairs = []
  for (const board of boards) {
    const circuitJson = await renderCircuit(board)
    measuredPairs.push(...getDifferentialPairPhaseSkew({ circuitJson }))
  }

  expect(measuredPairs).toHaveLength(6)
  expect(
    measuredPairs.map((pair) => pcb_differential_pair_phase_skew.parse(pair)),
  ).toEqual(measuredPairs)
})
