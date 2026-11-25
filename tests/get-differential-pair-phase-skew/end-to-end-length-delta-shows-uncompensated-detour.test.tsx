import { expect, test } from "bun:test"
import { checkPcbBusLengthSkew } from "@tscircuit/checks"
import { getDifferentialPairPhaseSkew } from "lib/index"
import {
  DETOUR_EXTRA_LENGTH,
  renderDifferentialPairBoard,
} from "tests/fixtures/differential-pair-board"
import { phaseSkewSvg } from "tests/fixtures/phase-skew-svg"

test("without the compensating detour, the end-to-end length delta is the detour, as the bus length check reports", async () => {
  const circuitJson = await renderDifferentialPairBoard({ compensated: false })

  const [pair] = getDifferentialPairPhaseSkew({ circuitJson })
  const [lengthSkewError] = checkPcbBusLengthSkew(circuitJson)

  expect(
    pair.positive_trace.segments.at(-1)?.end_length_difference_mm,
  ).toBeCloseTo(DETOUR_EXTRA_LENGTH, 5)
  expect(lengthSkewError.actual_length_skew).toBeCloseTo(DETOUR_EXTRA_LENGTH, 5)
  expect(lengthSkewError.maximum_length_skew).toBe(0.1)
  await expect(phaseSkewSvg(circuitJson)).toMatchSvgSnapshot(import.meta.path)
})
