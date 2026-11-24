import { expect, spyOn, test } from "bun:test"
import { getDifferentialPairPhaseSkewStrokes } from "lib/index"
import { renderPairBoard } from "tests/fixtures/pair-board"

test("RGB overrides reject incomplete decimals and retain valid exponents", async () => {
  const circuitJson = await renderPairBoard({
    positivePath: [],
    negativePath: [],
  })
  const warn = spyOn(console, "warn").mockImplementation(() => {})
  try {
    for (const zero of [
      "rgb(255., 0, 0)",
      "rgb(0, +2.e2, 0)",
      "rgb(0, 0, -1.e-2)",
    ]) {
      warn.mockClear()
      const strokes = getDifferentialPairPhaseSkewStrokes(circuitJson, {
        colors: { zero },
      })

      expect(strokes.length).toBeGreaterThan(0)
      expect(new Set(strokes.map((stroke) => stroke.color))).toEqual(
        new Set(["rgb(255, 255, 255)"]),
      )
      expect(warn).toHaveBeenCalledTimes(1)
      expect(warn).toHaveBeenCalledWith(
        `Invalid phase skew colour '${zero}', using 'rgb(255, 255, 255)'`,
      )
    }

    for (const [zero, expected] of [
      ["rgb(2.55e2, +.5, -0.5)", "rgb(255, 1, 0)"],
      ["RGB(1E+2, 2.5e1, .5)", "rgb(100, 25, 1)"],
    ]) {
      warn.mockClear()
      const strokes = getDifferentialPairPhaseSkewStrokes(circuitJson, {
        colors: { zero },
      })

      expect(new Set(strokes.map((stroke) => stroke.color))).toEqual(
        new Set([expected]),
      )
      expect(warn).not.toHaveBeenCalled()
    }
  } finally {
    warn.mockRestore()
  }
})
