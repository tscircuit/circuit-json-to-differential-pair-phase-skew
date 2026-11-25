import { expect, test } from "bun:test"
import { pcb_differential_pair_phase_skew } from "circuit-json"
import { getDifferentialPairPhaseSkew } from "lib/index"
import { ForumExampleBoard } from "tests/fixtures/forum-example-board"
import { renderCircuit } from "tests/fixtures/render-circuit"

/** Endpoints within 1 nm on the same layer meet at the same copper joint. */
const JOINT_TOLERANCE_MM = 1e-6

/** Phase skew is rounded to the nearest 10 nm. */
const PHASE_SKEW_ROUNDING_MM = 1e-5

test.failing(
  "forum board phase skew is continuous at copper joints on both traces",
  async () => {
    const circuitJson = await renderCircuit(<ForumExampleBoard />)
    const [pair] = getDifferentialPairPhaseSkew({ circuitJson })
    const { positive_trace, negative_trace } =
      pcb_differential_pair_phase_skew.parse(pair)
    const jumps = [positive_trace, negative_trace].flatMap(
      ({ pcb_trace_id, segments }) =>
        segments.flatMap((next, index) => {
          const previous = segments[index - 1]
          if (previous?.layer !== next.layer) return []
          const gapMm = Math.hypot(
            previous.end.x - next.start.x,
            previous.end.y - next.start.y,
          )
          if (gapMm > JOINT_TOLERANCE_MM) return []
          const endMm = previous.end_length_difference_mm
          const startMm = next.start_length_difference_mm
          if (Math.abs(endMm - startMm) > PHASE_SKEW_ROUNDING_MM) {
            return [{ pcb_trace_id, joint: [index - 1, index], endMm, startMm }]
          }
          return []
        }),
    )
    expect(jumps).toEqual([])
  },
)
