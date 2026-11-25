import { expect, test } from "bun:test"
import { cju } from "@tscircuit/circuit-json-util"
import { getDifferentialPairPhaseSkew } from "lib/index"
import { phaseSkewSvg } from "tests/fixtures/phase-skew-svg"
import { renderSourcePadBoard } from "tests/fixtures/source-pad-board"

test("a jog up to a via inside the source pad adds only the via's layer change", async () => {
  // DP jogs inside its 2 mm source pad to a via at x = -8.6, runs on bottom
  // and comes back up through a second via at x = 1. Inside the pad the
  // route runs straight from the pad centre to the via, so DP is ahead of
  // DN by just the two vias' layer changes.
  const circuitJson = await renderSourcePadBoard({
    sourcePad: <smtpad portHints={["1"]} shape="circle" radius="1mm" />,
    positivePath: [
      { x: 0.2, y: 0.2 },
      { x: 0.4, y: 0, via: true, toLayer: "bottom" },
      { x: 10, y: 0, via: true, toLayer: "top" },
    ],
  })

  const boardThickness = cju(circuitJson).pcb_board.list()[0].thickness
  const [pair] = getDifferentialPairPhaseSkew({ circuitJson })
  expect(
    pair.positive_trace.segments.at(-1)?.end_length_difference_mm,
  ).toBeCloseTo(2 * boardThickness, 5)
  const [firstPositiveSegment] = pair.positive_trace.segments
  expect(firstPositiveSegment.start).toEqual({ x: -9, y: 1 })
  expect(firstPositiveSegment.end).toEqual({ x: -8.6, y: 1 })

  await expect(phaseSkewSvg(circuitJson)).toMatchSvgSnapshot(import.meta.path)
})
