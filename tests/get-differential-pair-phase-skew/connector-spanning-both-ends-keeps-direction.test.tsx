import { expect, test } from "bun:test"
import { getDifferentialPairPhaseSkew } from "lib/index"
import { maximumAbsolutePhaseSkew } from "tests/fixtures/phase-skew-endpoints"
import { phaseSkewSvg } from "tests/fixtures/phase-skew-svg"
import { phaseSkewAtX } from "tests/fixtures/segment-at-x"
import { renderSpanningConnectorBoard } from "tests/fixtures/spanning-connector-board"

test("a connector at the start of one trace and the end of the other doesn't flip the pair", async () => {
  const circuitJson = await renderSpanningConnectorBoard()
  const [pair] = getDifferentialPairPhaseSkew({ circuitJson })

  for (const segments of [
    pair.positive_trace.segments,
    pair.negative_trace.segments,
  ]) {
    expect(phaseSkewAtX({ segments, x: 0 })).toBe(0)
  }
  expect(maximumAbsolutePhaseSkew(pair)).toBe(0)

  await expect(phaseSkewSvg(circuitJson)).toMatchSvgSnapshot(import.meta.path)
})
