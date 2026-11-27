import { expect, test } from "bun:test"
import { getDifferentialPairPhaseSkew } from "lib/index"

test("rejects zero, negative and non-finite sample spacing", () => {
  for (const spacingMm of [0, -1, Infinity, NaN]) {
    expect(() =>
      getDifferentialPairPhaseSkew({
        circuitJson: [],
        sample_spacing_mm: spacingMm,
      }),
    ).toThrow(RangeError)
  }
})
