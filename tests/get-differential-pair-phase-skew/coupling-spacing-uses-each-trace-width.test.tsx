import { expect, test } from "bun:test"
import { getDifferentialPairPhaseSkew } from "lib/index"
import { renderPairBoard } from "tests/fixtures/pair-board"
import { phaseSkewSvg } from "tests/fixtures/phase-skew-svg"
import { phaseSkewAtX, segmentAtX } from "tests/fixtures/segment-at-x"

test("the spacing allowance uses the mean of the two trace widths", async () => {
  // DP is 0.45 mm wide, DN 0.15 mm, gap 0.25 mm: the traces count as
  // coupled up to (0.25 + 0.3) * 1.2 = 0.66 mm apart. They start 0.6 mm
  // apart, and DN moves to 0.7 mm between x = -6 and x = 6.
  const circuitJson = await renderPairBoard({
    positivePath: [],
    negativePath: [
      { x: 6, y: 0 },
      { x: 6, y: -0.1 },
      { x: 18, y: -0.1 },
      { x: 18, y: 0 },
    ],
    pcbTraceGap: "0.25mm",
    positiveThickness: "0.45mm",
  })
  const [pair] = getDifferentialPairPhaseSkew({ circuitJson })

  const beside = segmentAtX({ segments: pair.positive_trace.segments, x: -9 })
  expect(phaseSkewAtX({ segments: pair.positive_trace.segments, x: -9 })).toBe(
    0,
  )
  expect(beside?.width).toBe(0.45)
  // Measured, DN would already be 0.1 mm ahead from its first jog at x = -6.
  // Uncoupled, the 0.2 mm the two jogs add ramps in over DP's 12 mm.
  expect(
    phaseSkewAtX({ segments: pair.positive_trace.segments, x: -3 }),
  ).toBeCloseTo(-0.05, 2)

  await expect(phaseSkewSvg(circuitJson)).toMatchSvgSnapshot(import.meta.path)
})
