import { expect, test } from "bun:test"
import { cju } from "@tscircuit/circuit-json-util"
import { getDifferentialPairPhaseSkew } from "lib/index"
import { roundPhaseSkew } from "lib/round-phase-skew"
import { walkTrace } from "lib/walk-trace"
import { renderPairBoard } from "tests/fixtures/pair-board"
import { phaseSkewSvg } from "tests/fixtures/phase-skew-svg"
import { phaseSkewAtX } from "tests/fixtures/segment-at-x"

test("phase skew runs from zero at the source to the walk difference at the load pad", async () => {
  // DP runs straight on top; DN drops to bottom at x = -6, returns to top at
  // x = 10, and jogs 2 mm away so it never recouples. The coupled run on
  // [-12, -6] has zero skew, but DN's asymmetric ending via at x = -6 adds
  // a known 1.6 mm step right after the run.
  const circuitJson = await renderPairBoard({
    positivePath: [],
    negativePath: [
      { x: 6, y: 0, via: true, fromLayer: "top", toLayer: "bottom" },
      { x: 22, y: 0, via: true, fromLayer: "bottom", toLayer: "top" },
      { x: 22, y: -2 },
      { x: 24, y: -2 },
    ],
    pcbTraceGap: "0.45mm",
  })

  const [pair] = getDifferentialPairPhaseSkew({ circuitJson })

  expect(phaseSkewAtX({ segments: pair.positive_trace.segments, x: -9 })).toBe(
    0,
  )
  const db = cju(circuitJson)
  const [board] = db.pcb_board.list()
  const traces = [pair.positive_trace, pair.negative_trace]
  const [positiveWalk, negativeWalk] = traces.map(({ pcb_trace_id }) => {
    const trace = db.pcb_trace.get(pcb_trace_id)
    if (trace === null) throw new Error(`Missing trace ${pcb_trace_id}`)
    // The routes in this fixture are straight through their terminal pads.
    const walk = walkTrace({
      route: trace.route,
      pcbStackup: null,
      boardThickness: board.thickness,
      copperLayerCount: board.num_layers,
    })
    if (walk === null) throw new Error(`Cannot walk trace ${pcb_trace_id}`)
    return walk
  })
  const padDifference = roundPhaseSkew(
    positiveWalk.length - negativeWalk.length,
  )
  expect(padDifference).toBe(-7.2)
  for (const { segments } of traces) {
    expect(segments[0].start_length_difference_mm).toBe(0)
    expect(segments[segments.length - 1].end.x).toBe(12)
  }
  const [positive, negative] = traces
  expect(
    positive.segments[positive.segments.length - 1].end_length_difference_mm,
  ).toBe(padDifference)
  expect(
    negative.segments[negative.segments.length - 1].end_length_difference_mm,
  ).toBe(-padDifference)

  await expect(phaseSkewSvg(circuitJson)).toMatchSvgSnapshot(import.meta.path)
})
