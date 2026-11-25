import { expect, test } from "bun:test"
import { cju } from "@tscircuit/circuit-json-util"
import { getDifferentialPairPhaseSkew } from "lib/index"
import { renderPairBoard } from "tests/fixtures/pair-board"
import { maximumAbsolutePhaseSkew } from "tests/fixtures/phase-skew-endpoints"
import { phaseSkewSvg } from "tests/fixtures/phase-skew-svg"
import { phaseSkewAtX } from "tests/fixtures/segment-at-x"

test("without a stackup, each via is as long as the board is thick", async () => {
  // A 0.8 mm board with no pcb_stackup: DN hops top -> bottom -> top.
  const circuitJson = await renderPairBoard({
    positivePath: [],
    negativePath: [
      { x: 6, y: 0, via: true, fromLayer: "top", toLayer: "bottom" },
      { x: 18, y: 0, via: true, fromLayer: "bottom", toLayer: "top" },
    ],
    pcbTraceGap: "0.45mm",
    thickness: "0.8mm",
  })
  expect(cju(circuitJson).pcb_stackup.list()).toEqual([])

  const [pair] = getDifferentialPairPhaseSkew({ circuitJson })
  const { segments } = pair.positive_trace
  expect(phaseSkewAtX({ segments, x: 0 })).toBeCloseTo(-0.8, 5)
  expect(phaseSkewAtX({ segments, x: 9 })).toBeCloseTo(-1.6, 5)
  expect(maximumAbsolutePhaseSkew(pair)).toBeCloseTo(1.6, 5)
  expect(
    pair.positive_trace.segments.at(-1)?.end_length_difference_mm,
  ).toBeCloseTo(-1.6, 5)
  await expect(phaseSkewSvg(circuitJson)).toMatchSvgSnapshot(import.meta.path)
})
