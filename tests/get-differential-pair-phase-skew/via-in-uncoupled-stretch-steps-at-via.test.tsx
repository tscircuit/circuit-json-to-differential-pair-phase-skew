import { expect, test } from "bun:test"
import { getDifferentialPairPhaseSkew } from "lib/index"
import { renderPairBoard } from "tests/fixtures/pair-board"
import { phaseSkewSvg } from "tests/fixtures/phase-skew-svg"
import { phaseSkewAtX } from "tests/fixtures/segment-at-x"

test("vias inside an uncoupled stretch between two coupled runs step at each via", async () => {
  const circuitJson = await renderPairBoard({
    positivePath: [
      { x: 6, y: 0 },
      { x: 6, y: 1 },
      { x: 9, y: 1, via: true, fromLayer: "top", toLayer: "bottom" },
      { x: 15, y: 1, via: true, fromLayer: "bottom", toLayer: "top" },
      { x: 18, y: 1 },
      { x: 18, y: 0 },
    ],
    negativePath: [],
    pcbTraceGap: "0.45mm",
  })

  const [pair] = getDifferentialPairPhaseSkew({ circuitJson })
  expect(pair).toBeDefined()
  if (!pair) return

  const segments = pair.positive_trace.segments
  const firstViaIndex = segments.findIndex(
    (segment) => segment.end.x === -3 && segment.end.y === 1.3,
  )
  const secondViaIndex = segments.findIndex(
    (segment) => segment.end.x === 3 && segment.end.y === 1.3,
  )
  const beforeFirstVia = segments[firstViaIndex]
  const afterFirstVia = segments[firstViaIndex + 1]
  const beforeSecondVia = segments[secondViaIndex]
  const afterSecondVia = segments[secondViaIndex + 1]
  expect(beforeFirstVia?.layer).toBe("top")
  expect(afterFirstVia?.layer).toBe("bottom")
  expect(beforeSecondVia?.layer).toBe("bottom")
  expect(afterSecondVia?.layer).toBe("top")
  if (
    !beforeFirstVia ||
    !afterFirstVia ||
    !beforeSecondVia ||
    !afterSecondVia
  ) {
    return
  }

  expect(
    afterFirstVia.start_length_difference_mm -
      beforeFirstVia.end_length_difference_mm,
  ).toBeCloseTo(1.6, 5)
  expect(
    afterSecondVia.start_length_difference_mm -
      beforeSecondVia.end_length_difference_mm,
  ).toBeCloseTo(1.6, 5)
  expect(
    phaseSkewAtX({ segments: pair.positive_trace.segments, x: 9 }),
  ).toBeCloseTo(5.2, 5)

  await expect(phaseSkewSvg(circuitJson)).toMatchSvgSnapshot(import.meta.path)
})
