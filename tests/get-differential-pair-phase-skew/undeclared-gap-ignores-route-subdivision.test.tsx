import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { getDifferentialPairPhaseSkew } from "lib/index"
import { type PairPathPoint, renderPairBoard } from "tests/fixtures/pair-board"
import { phaseSkewSvg } from "tests/fixtures/phase-skew-svg"
import { phaseSkewAtX } from "tests/fixtures/segment-at-x"

/**
 * DN runs 2 mm below DP between x = -11 and x = 11. Both routes get extra
 * collinear points every `step` mm.
 */
async function renderFarPair({
  step,
}: {
  step: number
}): Promise<AnyCircuitElement[]> {
  const positivePath: PairPathPoint[] = []
  const negativeAlong: PairPathPoint[] = []
  for (let x = step; x < 24; x += step) positivePath.push({ x, y: 0 })
  for (let x = 1 + step; x < 23; x += step) negativeAlong.push({ x, y: -1.4 })
  return renderPairBoard({
    positivePath,
    negativePath: [
      { x: 1, y: 0 },
      { x: 1, y: -1.4 },
      ...negativeAlong,
      { x: 23, y: -1.4 },
      { x: 23, y: 0 },
    ],
  })
}

test("without pcbTraceGap, splitting a route into more points doesn't change coupling", async () => {
  // 2 mm apart is beyond ten trace widths, so the far stretch never couples,
  // whether DN is one 22 mm step or 22 steps of 1 mm.
  const circuitJson = await renderFarPair({ step: 1 })
  expect(getDifferentialPairPhaseSkew({ circuitJson })).toEqual(
    getDifferentialPairPhaseSkew({
      circuitJson: await renderFarPair({ step: 30 }),
    }),
  )
  const [pair] = getDifferentialPairPhaseSkew({ circuitJson })
  // The 2.8 mm DN adds at its ends ramps in across the far stretch.
  expect(
    phaseSkewAtX({ segments: pair.positive_trace.segments, x: 0 }),
  ).toBeCloseTo(-1.4, 1)
  await expect(phaseSkewSvg(circuitJson)).toMatchSvgSnapshot(import.meta.path)
})
