import { expect, test } from "bun:test"
import { getDifferentialPairPhaseSkew } from "lib/index"
import { phaseSkewSvg } from "tests/fixtures/phase-skew-svg"
import { renderSourcePadBoard } from "tests/fixtures/source-pad-board"

/** DP's route length over a straight 4 mm run: down, along under the notch, up, out and back to the trace line, in mm. */
const ROUTE_EXTRA_LENGTH_MM = 0.8 + 1.5 + 1.6 + 0.8 + Math.hypot(1.7, 0.8) - 4

test("a route around a concave pad's notch keeps its path inside the pad", async () => {
  // DP's source is a 3 mm by 2 mm polygon pad notched from above between
  // x = 0.5 and x = 1, down to y = -0.5. DP goes down from the centre, under
  // the notch and up again, staying in copper, and leaves the pad's right
  // edge. A straight line from the centre to that exit would cross the
  // empty notch, so the routing inside the pad is kept as drawn.
  const circuitJson = await renderSourcePadBoard({
    sourcePad: (
      <platedhole
        shape="hole_with_polygon_pad"
        portHints={["1"]}
        holeShape="circle"
        holeDiameter="0.4mm"
        holeOffsetX={0}
        holeOffsetY={0}
        padOutline={[
          { x: -1, y: -1 },
          { x: 2, y: -1 },
          { x: 2, y: 1 },
          { x: 1, y: 1 },
          { x: 1, y: -0.5 },
          { x: 0.5, y: -0.5 },
          { x: 0.5, y: 1 },
          { x: -1, y: 1 },
        ]}
      />
    ),
    positivePath: [
      { x: 0, y: -0.8 },
      { x: 1.5, y: -0.8 },
      { x: 1.5, y: 0.8 },
      { x: 2.3, y: 0.8 },
      { x: 4, y: 0 },
    ],
  })

  const [pair] = getDifferentialPairPhaseSkew({ circuitJson })
  // The first leg in the fanout travels down to the horizontal leg under the notch.
  const [entry, firstPositiveSegment] = pair.positive_trace.segments
  expect(entry.start.y).toBeCloseTo(1, 9)
  expect(entry.start_length_difference_mm).toBe(0)
  expect(firstPositiveSegment.start.x).toBeCloseTo(-9, 9)
  expect(firstPositiveSegment.start.y).toBeCloseTo(0.2, 9)
  expect(firstPositiveSegment.end.x).toBeCloseTo(-7.5, 9)
  expect(firstPositiveSegment.end.y).toBeCloseTo(0.2, 9)
  expect(
    pair.positive_trace.segments.at(-1)?.end_length_difference_mm,
  ).toBeCloseTo(ROUTE_EXTRA_LENGTH_MM, 5)

  await expect(phaseSkewSvg(circuitJson)).toMatchSvgSnapshot(import.meta.path)
})
