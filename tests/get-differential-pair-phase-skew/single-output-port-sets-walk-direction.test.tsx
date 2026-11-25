import { expect, test } from "bun:test"
import { getDifferentialPairPhaseSkew } from "lib/index"
import {
  DETOUR_EXTRA_LENGTH,
  renderDirectedPairBoard,
} from "tests/fixtures/directed-pair-board"
import { phaseSkewSvg } from "tests/fixtures/phase-skew-svg"
import { phaseSkewAtX } from "tests/fixtures/segment-at-x"

test("when only one trace has an output port, that trace walks from its output and the partner aligns by end distance", async () => {
  // Both DP and DN are stored receiver (x = -12) -> driver (x = 12), with DP
  // detouring near the driver at x = 9..10. Even when only one trace carries
  // `is_output`, both traces must walk from U_TX (x = 12) toward U_RX (x = -12).
  const positiveOnlyJson = await renderDirectedPairBoard({
    outputSide: "positive",
  })
  const negativeOnlyJson = await renderDirectedPairBoard({
    outputSide: "negative",
  })

  for (const circuitJson of [
    positiveOnlyJson,
    negativeOnlyJson,
    await renderDirectedPairBoard({
      outputSide: "positive",
      negativeFromOutput: true,
    }),
    await renderDirectedPairBoard({
      outputSide: "negative",
      negativeFromOutput: true,
    }),
  ]) {
    const [pair] = getDifferentialPairPhaseSkew({ circuitJson })
    expect(
      phaseSkewAtX({ segments: pair.positive_trace.segments, x: 11 }),
    ).toBe(0)
    expect(
      phaseSkewAtX({ segments: pair.positive_trace.segments, x: 0 }),
    ).toBeCloseTo(DETOUR_EXTRA_LENGTH, 5)
    expect(
      phaseSkewAtX({ segments: pair.negative_trace.segments, x: 0 }),
    ).toBeCloseTo(-DETOUR_EXTRA_LENGTH, 5)
    expect(
      phaseSkewAtX({ segments: pair.positive_trace.segments, x: -11 }),
    ).toBeCloseTo(DETOUR_EXTRA_LENGTH, 5)
  }

  await expect(phaseSkewSvg(positiveOnlyJson)).toMatchSvgSnapshot(
    import.meta.path,
  )
})
