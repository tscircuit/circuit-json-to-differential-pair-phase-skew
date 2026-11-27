import { expect, test } from "bun:test"
import { getDifferentialPairPhaseSkew } from "lib/index"
import { renderPairBoard } from "tests/fixtures/pair-board"
import { maximumAbsolutePhaseSkew } from "tests/fixtures/phase-skew-endpoints"
import { phaseSkewSvg } from "tests/fixtures/phase-skew-svg"

test("a coupled stretch right at the 1 nm overlap threshold finishes without hanging", async () => {
  // DN only comes beside DP for 1 nm between x = 4 and x = 4.000001, just
  // above MIN_OVERLAP because of floating-point rounding.
  const circuitJson = await renderPairBoard({
    positivePath: [],
    negativePath: [
      { x: 0, y: -3 },
      { x: 16, y: -3 },
      { x: 16, y: 0 },
      { x: 16.000001, y: 0 },
      { x: 16.000001, y: -3 },
      { x: 24, y: -3 },
    ],
    pcbTraceGap: "0.45mm",
  })

  const [pair] = getDifferentialPairPhaseSkew({ circuitJson })

  const segments = pair.positive_trace.segments
  expect(segments).toHaveLength(3)
  expect(segments[1].start_length_difference_mm).toBeCloseTo(-6, 5)
  expect(maximumAbsolutePhaseSkew(pair)).toBeCloseTo(12, 5)

  await expect(phaseSkewSvg(circuitJson)).toMatchSvgSnapshot(import.meta.path)
}, 2000)
