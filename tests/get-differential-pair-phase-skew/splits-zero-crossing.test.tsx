import { expect, test } from "bun:test"
import { pcb_differential_pair_phase_skew } from "circuit-json"
import { getDifferentialPairPhaseSkew } from "lib/index"
import { renderPairBoard } from "tests/fixtures/pair-board"
import { phaseSkewSvg } from "tests/fixtures/phase-skew-svg"

test("a linear span that crosses zero is stored as two valid Circuit JSON segments", async () => {
  const circuitJson = await renderPairBoard({
    positivePath: [
      { x: 3, y: 0 },
      { x: 3, y: 1 },
      { x: 5, y: 1 },
      { x: 5, y: 0 },
    ],
    negativePath: [
      { x: 8, y: 0 },
      { x: 8, y: -2 },
      { x: 16, y: -2 },
      { x: 16, y: 0 },
    ],
    pcbTraceGap: "0.45mm",
  })

  const pairs = getDifferentialPairPhaseSkew({ circuitJson })
  expect(pairs).toHaveLength(1)
  const pair = pcb_differential_pair_phase_skew.parse(pairs[0])
  expect(pair).toEqual(pairs[0])
  const ramp = pair.positive_trace.segments.filter(
    ({ start, end }) => start.x >= -4 && end.x <= 4,
  )
  expect(ramp).toHaveLength(2)
  expect(ramp[0].end).toEqual(ramp[1].start)
  expect(ramp[0].end.x).toBeCloseTo(0, 9)
  expect(ramp[0].start_length_difference_mm).toBe(2)
  expect(ramp[0].end_length_difference_mm).toBe(0)
  expect(ramp[1].start_length_difference_mm).toBe(0)
  expect(ramp[1].end_length_difference_mm).toBe(-2)

  await expect(phaseSkewSvg(circuitJson)).toMatchSvgSnapshot(import.meta.path)
})
