import { expect, test } from "bun:test"
import { getDifferentialPairPhaseSkew } from "lib/index"
import { phaseSkewSvg } from "tests/fixtures/phase-skew-svg"
import { renderCircuit } from "tests/fixtures/render-circuit"
import { phaseSkewAtX, segmentAtX } from "tests/fixtures/segment-at-x"
import { LayerChangeBoard } from "tests/fixtures/stroke-example-boards"

test("segments keep their layer and length difference through a layer change", async () => {
  const circuitJson = await renderCircuit(<LayerChangeBoard />)
  const [pair] = getDifferentialPairPhaseSkew({ circuitJson })

  for (const { segments } of [pair.positive_trace, pair.negative_trace]) {
    expect(segmentAtX({ segments, x: -2 })?.layer).toBe("top")
    expect(segmentAtX({ segments, x: 2 })?.layer).toBe("bottom")
    const topValue = phaseSkewAtX({ segments, x: -2 })
    expect(topValue).not.toBe(0)
    expect(topValue).toBeDefined()
    expect(phaseSkewAtX({ segments, x: 2 })).toBe(topValue)
  }
  await expect(phaseSkewSvg(circuitJson)).toMatchSvgSnapshot(import.meta.path)
})
