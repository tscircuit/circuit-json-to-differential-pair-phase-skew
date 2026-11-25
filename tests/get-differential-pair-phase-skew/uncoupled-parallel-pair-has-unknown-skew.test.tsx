import { expect, test } from "bun:test"
import { getDifferentialPairPhaseSkew } from "lib/index"
import { renderPairBoard } from "tests/fixtures/pair-board"
import { phaseSkewSvg } from "tests/fixtures/phase-skew-svg"

// Geometry check inspired by KiCad QA test `DRCSkew` (`skew_within_diff_pairs_drc` /NET_3P and /NET_3N in test_drc_skew.cpp); dimensions and expected values are our own.
test("fully uncoupled parallel pair with unequal lengths produces no phase skew element", async () => {
  // With pcbTraceGap = 0.45 mm and 0.15 mm traces, maxOffset = (0.45 + 0.15) * 1.2 = 0.72 mm.
  // The parallel horizontal runs sit at y = 2.7 and y = -0.95 (3.65 mm apart > 0.72 mm),
  // and the vertical risers at x = -12 and x = 12 run in opposite directions (antiparallel).
  // Total lengths differ by 3.5 mm, yet no coupled run exists anywhere on the pair.
  const circuitJson = await renderPairBoard({
    positivePath: [
      { x: 0, y: 2.4 },
      { x: 24, y: 2.4 },
    ],
    negativePath: [
      { x: 0, y: -0.65 },
      { x: 24, y: -0.65 },
    ],
    pcbTraceGap: "0.45mm",
  })
  expect(getDifferentialPairPhaseSkew({ circuitJson })).toEqual([])

  await expect(phaseSkewSvg(circuitJson)).toMatchSvgSnapshot(import.meta.path)
})
