import { expect, test } from "bun:test"
import { getDifferentialPairPhaseSkew } from "lib/index"
import { maximumAbsolutePhaseSkew } from "tests/fixtures/phase-skew-endpoints"
import { phaseSkewSvg } from "tests/fixtures/phase-skew-svg"
import { renderSourcePadBoard } from "tests/fixtures/source-pad-board"

test("a jog inside a plated pad's drill adds no phase skew", async () => {
  // DP leaves the centre of a 2 mm plated pad with a 1.2 mm drill through a
  // small jog inside the drill, then runs beside DN. The drill is part of
  // the pad, so the copper inside the pad is measured straight from its
  // centre to its outer edge at x = -8.
  const circuitJson = await renderSourcePadBoard({
    sourcePad: (
      <platedhole
        portHints={["1"]}
        shape="circle"
        outerDiameter="2mm"
        holeDiameter="1.2mm"
      />
    ),
    positivePath: [
      { x: 0.14, y: 0.14 },
      { x: 0.3, y: 0 },
      { x: 4, y: 0 },
    ],
  })

  const [pair] = getDifferentialPairPhaseSkew({ circuitJson })
  expect(pair.positive_trace.segments.at(-1)?.end_length_difference_mm).toBe(0)
  expect(maximumAbsolutePhaseSkew(pair)).toBe(0)
  const [firstPositiveSegment] = pair.positive_trace.segments
  expect(firstPositiveSegment.start).toEqual({ x: -9, y: 1 })
  expect(firstPositiveSegment.end.y).toBeCloseTo(1, 9)

  await expect(phaseSkewSvg(circuitJson)).toMatchSvgSnapshot(import.meta.path)
})
