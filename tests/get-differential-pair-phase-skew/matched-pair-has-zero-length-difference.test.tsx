import { expect, test } from "bun:test"
import { getDifferentialPairPhaseSkew } from "lib/index"
import { phaseSkewSvg } from "tests/fixtures/phase-skew-svg"
import { renderCircuit } from "tests/fixtures/render-circuit"
import { MatchedPairBoard } from "tests/fixtures/stroke-example-boards"

test("a matched pair is one zero segment per trace", async () => {
  const circuitJson = await renderCircuit(<MatchedPairBoard />)
  const [pair] = getDifferentialPairPhaseSkew({ circuitJson })

  expect(
    [pair.positive_trace, pair.negative_trace].map(({ segments }) => segments),
  ).toEqual(
    [0.6, -0.6].map((y) => [
      {
        start: { x: -12, y },
        end: { x: 12, y },
        layer: "top",
        width: 0.24,
        start_length_difference_mm: 0,
        end_length_difference_mm: 0,
      },
    ]),
  )
  await expect(phaseSkewSvg(circuitJson)).toMatchSvgSnapshot(import.meta.path)
})
