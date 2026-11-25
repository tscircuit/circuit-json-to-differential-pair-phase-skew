import { expect, test } from "bun:test"
import { getDifferentialPairPhaseSkew } from "lib/index"
import { maximumAbsolutePhaseSkew } from "tests/fixtures/phase-skew-endpoints"
import { phaseSkewSvg } from "tests/fixtures/phase-skew-svg"
import { renderSourcePadBoard } from "tests/fixtures/source-pad-board"

test("a jog out to a plated pad's ring and back across its drill adds no phase skew", async () => {
  // DP steps back from the centre of a 2.2 mm plated pad into its copper
  // ring, crosses the 1 mm drill and leaves the pad. Measured against the
  // pad's outer outline, the whole jog is inside the pad, so it is clipped
  // straight from the centre to the outer edge rather than at the drill
  // wall.
  const circuitJson = await renderSourcePadBoard({
    sourcePad: (
      <platedhole
        portHints={["1"]}
        shape="circle"
        outerDiameter="2.2mm"
        holeDiameter="1mm"
      />
    ),
    positivePath: [
      { x: -0.7, y: 0 },
      { x: 0.2, y: 0 },
      { x: 4, y: 0 },
    ],
  })

  const [pair] = getDifferentialPairPhaseSkew({ circuitJson })
  expect(pair.positive_trace.segments.at(-1)?.end_length_difference_mm).toBe(0)
  expect(maximumAbsolutePhaseSkew(pair)).toBe(0)

  await expect(phaseSkewSvg(circuitJson)).toMatchSvgSnapshot(import.meta.path)
})
