import { expect, test } from "bun:test"
import type { PcbDifferentialPairPhaseSkewSegment } from "circuit-json"
import { getDifferentialPairPhaseSkew } from "lib/index"
import { renderPairBoard } from "tests/fixtures/pair-board"
import { maximumAbsolutePhaseSkew } from "tests/fixtures/phase-skew-endpoints"
import { phaseSkewSvg } from "tests/fixtures/phase-skew-svg"
import { phaseSkewAtX } from "tests/fixtures/segment-at-x"

/** The vertical overlay segment at `x` that covers `y`. */
function segmentAtY({
  segments,
  x,
  y,
}: {
  segments: PcbDifferentialPairPhaseSkewSegment[]
  x: number
  y: number
}): PcbDifferentialPairPhaseSkewSegment {
  const segment = segments.find(
    (candidate) =>
      Math.abs(candidate.start.x - x) < 1e-9 &&
      Math.abs(candidate.end.x - x) < 1e-9 &&
      Math.min(candidate.start.y, candidate.end.y) <= y &&
      Math.max(candidate.start.y, candidate.end.y) >= y,
  )
  if (!segment) {
    throw new Error(`No vertical segment at x = ${x} covers y = ${y}`)
  }
  return segment
}

/**
 * Each 90° bend of a pair at centreline pitch d = 0.6 mm puts the outer trace
 * 2d = 1.2 mm ahead of the inner trace (d before the corner + d after it).
 */
const BEND_SKEW = 2 * 0.6

// Geometry check inspired by KiCad QA tests `DRCSkew` / `DRCFalsePositiveRegressions` (`diff_pair_uncoupled_tuning_drc` in test_drc_skew.cpp and test_drc_regressions.cpp); dimensions and expected values are our own.
test("coupled serpentine meander alternates phase skew across legs and cancels to zero on exit", async () => {
  // 3-lobe serpentine at d = 0.6 mm centreline pitch (maxOffset = (0.45 + 0.15) * 1.2 = 0.72 mm).
  // Both legs have total length 32.0 mm:
  //   DP: 8.6 + 2.0 + 1.0 + 4.0 + 2.2 + 2.0 + 12.2 = 32.0 mm
  //   DN: 8.0 + 2.0 + 2.2 + 4.0 + 1.0 + 2.0 + 12.8 = 32.0 mm
  // Cumulative distances at each coupled run (DP - DN):
  //   entry horizontal (x in [-12, -4]):    0
  //   1st down leg     (y in [-1.7, -0.3]): (8.9 - y) - (7.7 - y) = +1.2 mm
  //   bottom flat      (x in [-3.4, -2.4]): (x + 14) - (x + 14)   =  0
  //   middle up leg    (y in [-1.7, 1.7]):  (y + 13.3) - (y + 14.5) = -1.2 mm
  //   top flat         (x in [-1.8, -0.8]): (x + 18) - (x + 18)   =  0
  //   final down leg   (y in [0.3, 1.7]):   (20.1 - y) - (18.9 - y) = +1.2 mm
  //   exit horizontal  (x in [-0.2, 12]):   (x + 20) - (x + 20)   =  0
  const circuitJson = await renderPairBoard({
    positivePath: [
      { x: 8.6, y: 0 },
      { x: 8.6, y: -2 },
      { x: 9.6, y: -2 },
      { x: 9.6, y: 2 },
      { x: 11.8, y: 2 },
      { x: 11.8, y: 0 },
    ],
    negativePath: [
      { x: 8, y: 0 },
      { x: 8, y: -2 },
      { x: 10.2, y: -2 },
      { x: 10.2, y: 2 },
      { x: 11.2, y: 2 },
      { x: 11.2, y: 0 },
    ],
    pcbTraceGap: "0.45mm",
  })
  const [pair] = getDifferentialPairPhaseSkew({ circuitJson })

  expect(
    phaseSkewAtX({
      segments: pair.positive_trace.segments,
      x: -8,
      y: 0.3,
    }),
  ).toBe(0)
  expect(
    phaseSkewAtX({
      segments: pair.negative_trace.segments,
      x: -8,
      y: -0.3,
    }),
  ).toBe(0)

  const firstDownPos = segmentAtY({
    segments: pair.positive_trace.segments,
    x: -3.4,
    y: -1,
  })
  const firstDownNeg = segmentAtY({
    segments: pair.negative_trace.segments,
    x: -4.0,
    y: -1,
  })
  expect(firstDownPos.start_length_difference_mm).toBeCloseTo(BEND_SKEW, 5)
  expect(firstDownNeg.start_length_difference_mm).toBeCloseTo(-BEND_SKEW, 5)

  expect(
    phaseSkewAtX({
      segments: pair.positive_trace.segments,
      x: -2.9,
      y: -1.7,
    }),
  ).toBe(0)
  expect(
    phaseSkewAtX({
      segments: pair.negative_trace.segments,
      x: -2.9,
      y: -2.3,
    }),
  ).toBe(0)

  const middleUpPos = segmentAtY({
    segments: pair.positive_trace.segments,
    x: -2.4,
    y: 0,
  })
  const middleUpNeg = segmentAtY({
    segments: pair.negative_trace.segments,
    x: -1.8,
    y: 0,
  })
  expect(middleUpPos.start_length_difference_mm).toBeCloseTo(-BEND_SKEW, 5)
  expect(middleUpNeg.start_length_difference_mm).toBeCloseTo(BEND_SKEW, 5)

  expect(
    phaseSkewAtX({
      segments: pair.positive_trace.segments,
      x: -1.3,
      y: 2.3,
    }),
  ).toBe(0)
  expect(
    phaseSkewAtX({
      segments: pair.negative_trace.segments,
      x: -1.3,
      y: 1.7,
    }),
  ).toBe(0)

  const finalDownPos = segmentAtY({
    segments: pair.positive_trace.segments,
    x: -0.2,
    y: 1,
  })
  const finalDownNeg = segmentAtY({
    segments: pair.negative_trace.segments,
    x: -0.8,
    y: 1,
  })
  expect(finalDownPos.start_length_difference_mm).toBeCloseTo(BEND_SKEW, 5)
  expect(finalDownNeg.start_length_difference_mm).toBeCloseTo(-BEND_SKEW, 5)

  expect(
    phaseSkewAtX({
      segments: pair.positive_trace.segments,
      x: 6,
      y: 0.3,
    }),
  ).toBe(0)
  expect(
    phaseSkewAtX({
      segments: pair.negative_trace.segments,
      x: 6,
      y: -0.3,
    }),
  ).toBe(0)

  expect(maximumAbsolutePhaseSkew(pair)).toBeCloseTo(BEND_SKEW, 5)

  await expect(phaseSkewSvg(circuitJson)).toMatchSvgSnapshot(import.meta.path)
})
