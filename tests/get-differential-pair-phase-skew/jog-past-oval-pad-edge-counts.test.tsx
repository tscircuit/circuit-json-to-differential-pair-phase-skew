import { expect, test } from "bun:test"
import { getDifferentialPairPhaseSkew } from "lib/index"
import { maximumAbsolutePhaseSkew } from "tests/fixtures/phase-skew-endpoints"
import { phaseSkewSvg } from "tests/fixtures/phase-skew-svg"
import { renderSourcePadBoard } from "tests/fixtures/source-pad-board"

/** DP's jog from the pad centre: out to (2, 0.9) and back to (2.4, 0), instead of straight to (2.4, 0), in mm. */
const JOG_EXTRA_LENGTH_MM = Math.hypot(2, 0.9) + Math.hypot(0.4, 0.9) - 2.4

test("a jog past an oval pad's elliptical edge counts as routed copper", async () => {
  // DP's source is a 6 mm by 2 mm oval plated pad, which renderers draw as
  // an ellipse. DP jogs out to (2, 0.9) from the pad centre: inside a
  // 6 mm by 2 mm pill, but outside the ellipse. The route has left the pad
  // on its first leg, so the jog is routed copper and adds its length.
  const circuitJson = await renderSourcePadBoard({
    sourcePad: (
      <platedhole
        portHints={["1"]}
        shape="oval"
        outerWidth="6mm"
        outerHeight="2mm"
        holeWidth="0.6mm"
        holeHeight="0.4mm"
      />
    ),
    positivePath: [
      { x: 2, y: 0.9 },
      { x: 2.4, y: 0 },
      { x: 4, y: 0 },
    ],
  })

  const [pair] = getDifferentialPairPhaseSkew({ circuitJson })
  expect(
    pair.positive_trace.segments.at(-1)?.end_length_difference_mm,
  ).toBeCloseTo(JOG_EXTRA_LENGTH_MM, 5)
  expect(maximumAbsolutePhaseSkew(pair)).toBeCloseTo(JOG_EXTRA_LENGTH_MM, 5)

  await expect(phaseSkewSvg(circuitJson)).toMatchSvgSnapshot(import.meta.path)
})
