import { expect, test } from "bun:test"
import { getDifferentialPairPhaseSkew } from "lib/index"
import { phaseSkewSvg } from "tests/fixtures/phase-skew-svg"
import { renderCircuit } from "tests/fixtures/render-circuit"
import { phaseSkewAtX } from "tests/fixtures/segment-at-x"
import { LocalCompensationBoard } from "tests/fixtures/stroke-example-boards"

test("the locally compensated pair returns to zero while the other stays skewed", async () => {
  const circuitJson = await renderCircuit(<LocalCompensationBoard />)
  const segments = getDifferentialPairPhaseSkew({ circuitJson }).flatMap(
    (pair) => [
      ...pair.positive_trace.segments,
      ...pair.negative_trace.segments,
    ],
  )

  const [compensatedTop, compensatedBottom, skewedTop, skewedBottom] = [
    2.8, 1.6, -1.6, -2.8,
  ].map((y) => phaseSkewAtX({ segments, x: 10, y }))
  expect(compensatedTop).toBe(0)
  expect(compensatedBottom).toBe(0)
  expect(skewedTop).toBeGreaterThan(0)
  expect(skewedBottom).toBe(-(skewedTop ?? 0))
  await expect(phaseSkewSvg(circuitJson)).toMatchSvgSnapshot(import.meta.path)
})
