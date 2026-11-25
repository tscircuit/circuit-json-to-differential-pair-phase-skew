import { expect, test } from "bun:test"
import { getDifferentialPairPhaseSkew } from "lib/index"
import { phaseSkewEndpoints } from "tests/fixtures/phase-skew-endpoints"
import { phaseSkewSvg } from "tests/fixtures/phase-skew-svg"
import { renderCircuit } from "tests/fixtures/render-circuit"
import { phaseSkewAtX } from "tests/fixtures/segment-at-x"
import { LoadEndMeanderBoard } from "tests/fixtures/stroke-example-boards"

test("each trace reaches its peak mid-route, halves, and returns to zero", async () => {
  const circuitJson = await renderCircuit(<LoadEndMeanderBoard />)
  const [pair] = getDifferentialPairPhaseSkew({ circuitJson })

  const traces = [
    {
      trace: pair.positive_trace,
      peak: Math.max(...phaseSkewEndpoints(pair.positive_trace)),
    },
    {
      trace: pair.negative_trace,
      peak: Math.min(...phaseSkewEndpoints(pair.negative_trace)),
    },
  ]
  for (const { trace, peak } of traces) {
    const [start, middle, afterFirstDetour, end] = [-11, 0, 7.5, 11.5].map(
      (x) => phaseSkewAtX({ segments: trace.segments, x }),
    )
    expect(peak).not.toBe(0)
    expect(start).toBe(0)
    expect(middle).toBeCloseTo(peak, 9)
    expect(afterFirstDetour).toBeCloseTo(peak / 2, 2)
    expect(end).toBe(0)
  }
  await expect(phaseSkewSvg(circuitJson)).toMatchSvgSnapshot(import.meta.path)
})
