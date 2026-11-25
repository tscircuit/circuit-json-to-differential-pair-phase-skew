import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { getDifferentialPairPhaseSkew } from "lib/index"
import type { PairPathPoint } from "tests/fixtures/pair-board"
import { maximumAbsolutePhaseSkew } from "tests/fixtures/phase-skew-endpoints"
import { phaseSkewSvg } from "tests/fixtures/phase-skew-svg"
import { renderSourcePadBoard } from "tests/fixtures/source-pad-board"

/** DP's route from the pad centre: across the notch, up, over and back down to the trace line. */
const NOTCH_CROSSING_PATH: PairPathPoint[] = [
  { x: 1.4, y: 0 },
  { x: 1.4, y: 0.7 },
  { x: 3, y: 0.7 },
  { x: 4, y: 0 },
]

/** The route's extra length over a straight 4 mm run, in mm: it leaves the pad in the notch, so all of it is routed copper. */
const ROUTE_EXTRA_LENGTH_MM = 1.4 + 0.7 + 1.6 + Math.hypot(1, 0.7) - 4

/** Renders the board with DP's source in a 3 mm by 2 mm polygon pad notched from above between x = 0.5 and x = 1. */
function renderNotchedPadBoard(
  positivePath: PairPathPoint[],
): Promise<AnyCircuitElement[]> {
  return renderSourcePadBoard({
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
    positivePath,
  })
}

test("a route crossing the notch of a concave pad leaves the pad there, however it is split", async () => {
  // DP's first leg runs from the pad centre to x = 1.4 through the notch,
  // so it leaves the pad's copper at x = 0.5 and comes back in. Measured by
  // where it first crosses the pad's edge, the whole route is routed copper,
  // the same whether or not the leg has a point in the notch.
  const circuitJson = await renderNotchedPadBoard(NOTCH_CROSSING_PATH)
  const subdividedCircuitJson = await renderNotchedPadBoard([
    { x: 0.75, y: 0 },
    ...NOTCH_CROSSING_PATH,
  ])

  const [pair] = getDifferentialPairPhaseSkew({ circuitJson })
  const [subdividedPair] = getDifferentialPairPhaseSkew({
    circuitJson: subdividedCircuitJson,
  })
  expect(
    pair.positive_trace.segments.at(-1)?.end_length_difference_mm,
  ).toBeCloseTo(ROUTE_EXTRA_LENGTH_MM, 5)
  expect(
    subdividedPair.positive_trace.segments.at(-1)?.end_length_difference_mm,
  ).toBe(pair.positive_trace.segments.at(-1)?.end_length_difference_mm)
  expect(maximumAbsolutePhaseSkew(subdividedPair)).toBe(
    maximumAbsolutePhaseSkew(pair),
  )

  await expect(phaseSkewSvg(circuitJson)).toMatchSvgSnapshot(import.meta.path)
})
