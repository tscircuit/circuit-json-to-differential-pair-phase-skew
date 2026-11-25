import { expect, test } from "bun:test"
import { getDifferentialPairPhaseSkew } from "lib/index"
import { renderPairBoard } from "tests/fixtures/pair-board"
import { phaseSkewSvg } from "tests/fixtures/phase-skew-svg"
import { phaseSkewAtX } from "tests/fixtures/segment-at-x"

test("a stretch where the traces are on different layers is not coupled", async () => {
  // DN drops to the bottom layer between x = -6 and x = 6, with a 2 mm
  // detour at x = 2; DP stays on top.
  const circuitJson = await renderPairBoard({
    positivePath: [],
    negativePath: [
      { x: 6, y: 0, via: true, fromLayer: "top", toLayer: "bottom" },
      { x: 14, y: 0 },
      { x: 14, y: -1 },
      { x: 16, y: -1 },
      { x: 16, y: 0 },
      { x: 18, y: 0, via: true, fromLayer: "bottom", toLayer: "top" },
    ],
    pcbTraceGap: "0.45mm",
  })
  const [pair] = getDifferentialPairPhaseSkew({ circuitJson })

  expect(phaseSkewAtX({ segments: pair.positive_trace.segments, x: -9 })).toBe(
    0,
  )
  // Measured, x = 0 would be the first via's 1.6 mm, before the detour.
  // Uncoupled, the skew ramps from -1.6 mm to -3.6 mm across DP's 12 mm.
  expect(
    phaseSkewAtX({ segments: pair.positive_trace.segments, x: 0 }),
  ).toBeCloseTo(-2.6, 2)

  await expect(phaseSkewSvg(circuitJson)).toMatchSvgSnapshot(import.meta.path)
})
