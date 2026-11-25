import { expect, test } from "bun:test"
import { getDifferentialPairPhaseSkew } from "lib/index"
import { renderPairBoard } from "tests/fixtures/pair-board"
import { phaseSkewSvg } from "tests/fixtures/phase-skew-svg"
import { phaseSkewAtX } from "tests/fixtures/segment-at-x"

test("pad fan-outs include trace width in their coupling limit", async () => {
  // The parallel flare is 3.7 mm apart. The 3 mm pad pitch and 0.15 mm
  // trace widths give a 3.78 mm limit: (3 + 0.15) * 1.2.
  const circuitJson = await renderPairBoard({
    sourcePadHalfPitch: 1.5,
    loadPadHalfPitch: 1.5,
    positivePath: [
      { x: 4, y: 0 },
      { x: 4.5, y: 0.05 },
      { x: 5, y: 0 },
    ],
    negativePath: [
      { x: 1, y: -0.7 },
      { x: 4, y: -0.7 },
      { x: 6, y: 2.4 },
      { x: 18, y: 2.4 },
      { x: 20, y: 0 },
    ],
    pcbTraceGap: "0.45mm",
  })

  const [pair] = getDifferentialPairPhaseSkew({ circuitJson })

  expect(
    phaseSkewAtX({ segments: pair.positive_trace.segments, x: -10 }),
  ).toBeCloseTo(-0.22066, 5)

  await expect(phaseSkewSvg(circuitJson)).toMatchSvgSnapshot(import.meta.path)
})
