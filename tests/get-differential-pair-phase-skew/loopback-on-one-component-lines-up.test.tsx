import { expect, test } from "bun:test"
import { getDifferentialPairPhaseSkew } from "lib/index"
import { renderLoopbackBoard } from "tests/fixtures/loopback-board"
import { maximumAbsolutePhaseSkew } from "tests/fixtures/phase-skew-endpoints"
import { phaseSkewSvg } from "tests/fixtures/phase-skew-svg"
import { phaseSkewAtX } from "tests/fixtures/segment-at-x"

test("a loopback with all pads on one part lines the traces up by their ends", async () => {
  const circuitJson = await renderLoopbackBoard()
  const [pair] = getDifferentialPairPhaseSkew({ circuitJson })

  expect(phaseSkewAtX({ segments: pair.positive_trace.segments, x: 0 })).toBe(0)
  expect(maximumAbsolutePhaseSkew(pair)).toBe(0)

  await expect(phaseSkewSvg(circuitJson)).toMatchSvgSnapshot(import.meta.path)
})
