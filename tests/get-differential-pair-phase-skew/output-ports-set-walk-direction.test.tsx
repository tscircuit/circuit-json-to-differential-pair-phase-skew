import { expect, test } from "bun:test"
import { getDifferentialPairPhaseSkew } from "lib/index"
import {
  DETOUR_EXTRA_LENGTH,
  renderDirectedPairBoard,
} from "tests/fixtures/directed-pair-board"
import { phaseSkewSvg } from "tests/fixtures/phase-skew-svg"
import { phaseSkewAtX } from "tests/fixtures/segment-at-x"

test("when each trace has one output end port, both traces walk from the output end", async () => {
  // Both DP and DN are stored receiver (x = -12) -> output driver (x = 12),
  // with DP detouring right after the driver at x = 9..10.
  const circuitJson = await renderDirectedPairBoard()
  const [pair] = getDifferentialPairPhaseSkew({ circuitJson })

  // Walking from U_TX (x = 12) to U_RX (x = -12): skew is 0 before DP's
  // detour (x = 11) and +DETOUR_EXTRA_LENGTH from x = 9 all the way to U_RX.
  expect(phaseSkewAtX({ segments: pair.positive_trace.segments, x: 11 })).toBe(
    0,
  )
  expect(
    phaseSkewAtX({ segments: pair.positive_trace.segments, x: 0 }),
  ).toBeCloseTo(DETOUR_EXTRA_LENGTH, 5)
  expect(
    phaseSkewAtX({ segments: pair.negative_trace.segments, x: 0 }),
  ).toBeCloseTo(-DETOUR_EXTRA_LENGTH, 5)
  expect(
    phaseSkewAtX({ segments: pair.positive_trace.segments, x: -11 }),
  ).toBeCloseTo(DETOUR_EXTRA_LENGTH, 5)

  // Mixed stored directions (DP reversed, DN already from output) also walk from U_TX.
  const [mixed] = getDifferentialPairPhaseSkew({
    circuitJson: await renderDirectedPairBoard({ negativeFromOutput: true }),
  })
  expect(phaseSkewAtX({ segments: mixed.positive_trace.segments, x: 11 })).toBe(
    0,
  )
  expect(
    phaseSkewAtX({ segments: mixed.positive_trace.segments, x: 0 }),
  ).toBeCloseTo(DETOUR_EXTRA_LENGTH, 5)

  // When both ends are marked output (ambiguous), fall back to stored positive order.
  const [ambiguous] = getDifferentialPairPhaseSkew({
    circuitJson: await renderDirectedPairBoard({ bothEndsOutput: true }),
  })
  expect(
    phaseSkewAtX({ segments: ambiguous.positive_trace.segments, x: 0 }),
  ).toBe(0)
  expect(
    phaseSkewAtX({ segments: ambiguous.positive_trace.segments, x: 11 }),
  ).toBeCloseTo(DETOUR_EXTRA_LENGTH, 5)

  await expect(phaseSkewSvg(circuitJson)).toMatchSvgSnapshot(import.meta.path)
})
