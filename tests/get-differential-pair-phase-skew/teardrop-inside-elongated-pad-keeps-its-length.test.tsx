import { expect, test } from "bun:test"
import { getDifferentialPairPhaseSkew } from "lib/index"
import { maximumAbsolutePhaseSkew } from "tests/fixtures/phase-skew-endpoints"
import { phaseSkewSvg } from "tests/fixtures/phase-skew-svg"
import { renderSourcePadBoard } from "tests/fixtures/source-pad-board"

test("a teardrop wholly inside an elongated pad keeps its length and widths", async () => {
  // Core gives DP a 1.5 mm teardrop from x = -9 to x = -7.5, narrowing from
  // 0.8 mm to 0.15 mm, inside its 6 mm by 1 mm source pad, which ends at
  // x = -6. DP already runs straight inside the pad, so clipping keeps the
  // teardrop's pieces instead of stretching it to the pad edge.
  const circuitJson = await renderSourcePadBoard({
    sourcePad: (
      <smtpad portHints={["1"]} shape="rect" width="6mm" height="1mm" />
    ),
    positivePath: [],
    pcbTeardrops: true,
  })

  const [pair] = getDifferentialPairPhaseSkew({ circuitJson })
  expect(maximumAbsolutePhaseSkew(pair)).toBe(0)
  const teardropSegments = pair.positive_trace.segments.filter(
    (segment) => segment.end.x <= -7.5 + 1e-9,
  )
  expect(teardropSegments).toHaveLength(65)
  expect(teardropSegments[64].width).toBeCloseTo(0.155, 9)
  const pastTeardrop = pair.positive_trace.segments.find(
    (segment) => segment.start.x < -6.5 && segment.end.x > -6.5,
  )
  expect(pastTeardrop?.width).toBe(0.15)

  await expect(phaseSkewSvg(circuitJson)).toMatchSvgSnapshot(import.meta.path)
})
