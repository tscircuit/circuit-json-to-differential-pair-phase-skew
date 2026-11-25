import { expect, test } from "bun:test"
import { getDifferentialPairPhaseSkew } from "lib/index"
import {
  DETOUR_EXTRA_LENGTH,
  renderDifferentialPairBoard,
} from "tests/fixtures/differential-pair-board"
import { phaseSkewSvg } from "tests/fixtures/phase-skew-svg"
import { phaseSkewAtX } from "tests/fixtures/segment-at-x"

test("positive trace is longer by the detour length between the detours", async () => {
  const circuitJson = await renderDifferentialPairBoard({ compensated: true })
  const [pair] = getDifferentialPairPhaseSkew({ circuitJson })

  expect(
    phaseSkewAtX({ segments: pair.positive_trace.segments, x: 0 }),
  ).toBeCloseTo(DETOUR_EXTRA_LENGTH, 5)
  expect(
    phaseSkewAtX({ segments: pair.negative_trace.segments, x: 0 }),
  ).toBeCloseTo(-DETOUR_EXTRA_LENGTH, 5)

  await expect(phaseSkewSvg(circuitJson)).toMatchSvgSnapshot(import.meta.path)
})
