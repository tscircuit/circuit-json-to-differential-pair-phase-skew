import { expect, test } from "bun:test"
import type { PcbDifferentialPairPhaseSkewSegment } from "circuit-json"
import { getDifferentialPairPhaseSkew } from "lib/index"
import { renderPairBoard } from "tests/fixtures/pair-board"
import { maximumAbsolutePhaseSkew } from "tests/fixtures/phase-skew-endpoints"
import { phaseSkewSvg } from "tests/fixtures/phase-skew-svg"
import { phaseSkewAtX } from "tests/fixtures/segment-at-x"

/** The non-horizontal overlay segment that covers `x`. */
function diagonalAtX({
  segments,
  x,
}: {
  segments: PcbDifferentialPairPhaseSkewSegment[]
  x: number
}): PcbDifferentialPairPhaseSkewSegment {
  const segment = segments.find(
    (candidate) =>
      candidate.start.y !== candidate.end.y &&
      Math.min(candidate.start.x, candidate.end.x) <= x &&
      Math.max(candidate.start.x, candidate.end.x) >= x,
  )
  if (!segment) throw new Error(`No diagonal segment covers x = ${x}`)
  return segment
}

/**
 * Corner setback c = d * tan(pi / 8) = d * (sqrt(2) - 1) for a 45° bend at
 * centreline pitch d = 0.6 mm (~0.248528 mm). Each 45° bend adds 2c (~0.497056 mm)
 * to the outer trace: c before the bend plus c along the diagonal projection.
 */
const CORNER_SHIFT = 0.6 * Math.tan(Math.PI / 8)
const MITRED_BEND_SKEW = 2 * CORNER_SHIFT

// Geometry check inspired by KiCad QA test `DRCFalsePositiveRegressions` (`issue8407` in test_drc_regressions.cpp); dimensions and expected values are our own.
test("45° mitred bends create opposite-sign skew of 2 * d * tan(pi/8) on coupled diagonals", async () => {
  // Coupled 45° Z-jog keeping d = 0.60 mm perpendicular spacing on every run
  // (maxOffset = (0.45 + 0.15) * 1.2 = 0.72 mm):
  //   entry horizontal (x in [-12, -6]):         DP - DN = 0
  //   upward +45° diagonal (x around -4):        DP on inside -> -2c = -0.497056 mm
  //   top horizontal (x in [-2 + c, 2 - c]):     outer + inner bends cancel -> 0
  //   downward -45° diagonal (x around 4):       DP on outside -> +2c = +0.497056 mm
  //   exit horizontal (x in [6, 12]):            bends cancel -> 0
  const circuitJson = await renderPairBoard({
    positivePath: [
      { x: 6, y: 0 },
      { x: 10, y: 4 },
      { x: 14, y: 4 },
      { x: 18, y: 0 },
    ],
    negativePath: [
      { x: 6 + CORNER_SHIFT, y: 0 },
      { x: 10 + CORNER_SHIFT, y: 4 },
      { x: 14 - CORNER_SHIFT, y: 4 },
      { x: 18 - CORNER_SHIFT, y: 0 },
    ],
    pcbTraceGap: "0.45mm",
  })
  const [pair] = getDifferentialPairPhaseSkew({ circuitJson })

  expect(
    phaseSkewAtX({
      segments: pair.positive_trace.segments,
      x: -9,
      y: 0.3,
    }),
  ).toBe(0)
  expect(
    phaseSkewAtX({
      segments: pair.negative_trace.segments,
      x: -9,
      y: -0.3,
    }),
  ).toBe(0)

  const upPos = diagonalAtX({ segments: pair.positive_trace.segments, x: -4 })
  const upNeg = diagonalAtX({ segments: pair.negative_trace.segments, x: -4 })
  expect(upPos.start_length_difference_mm).toBeCloseTo(-MITRED_BEND_SKEW, 5)
  expect(upNeg.start_length_difference_mm).toBeCloseTo(MITRED_BEND_SKEW, 5)

  expect(
    phaseSkewAtX({
      segments: pair.positive_trace.segments,
      x: 0,
      y: 4.3,
    }),
  ).toBe(0)
  expect(
    phaseSkewAtX({
      segments: pair.negative_trace.segments,
      x: 0,
      y: 3.7,
    }),
  ).toBe(0)

  const downPos = diagonalAtX({ segments: pair.positive_trace.segments, x: 4 })
  const downNeg = diagonalAtX({ segments: pair.negative_trace.segments, x: 4 })
  expect(downPos.start_length_difference_mm).toBeCloseTo(MITRED_BEND_SKEW, 5)
  expect(downNeg.start_length_difference_mm).toBeCloseTo(-MITRED_BEND_SKEW, 5)

  expect(
    phaseSkewAtX({
      segments: pair.positive_trace.segments,
      x: 9,
      y: 0.3,
    }),
  ).toBe(0)
  expect(
    phaseSkewAtX({
      segments: pair.negative_trace.segments,
      x: 9,
      y: -0.3,
    }),
  ).toBe(0)

  expect(maximumAbsolutePhaseSkew(pair)).toBeCloseTo(MITRED_BEND_SKEW, 5)

  await expect(phaseSkewSvg(circuitJson)).toMatchSvgSnapshot(import.meta.path)
})
