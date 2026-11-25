import { expect, test } from "bun:test"
import { cju } from "@tscircuit/circuit-json-util"
import { getDifferentialPairPhaseSkew } from "lib/index"
import { walkTrace } from "lib/walk-trace"
import { renderPairBoard } from "tests/fixtures/pair-board"
import { maximumAbsolutePhaseSkew } from "tests/fixtures/phase-skew-endpoints"
import { phaseSkewSvg } from "tests/fixtures/phase-skew-svg"
import { phaseSkewAtX } from "tests/fixtures/segment-at-x"

test("colocated vias keep their full skew step between straight runs", async () => {
  const circuitJson = await renderPairBoard({
    positivePath: [],
    negativePath: [
      { x: 10, y: 0, via: true, fromLayer: "top", toLayer: "bottom" },
      { x: 10, y: 0, via: true, fromLayer: "bottom", toLayer: "top" },
    ],
    pcbTraceGap: "0.45mm",
    thickness: "0.8mm",
  })
  const [pair] = getDifferentialPairPhaseSkew({ circuitJson })

  expect(phaseSkewAtX({ segments: pair.positive_trace.segments, x: -4 })).toBe(
    0,
  )
  expect(
    phaseSkewAtX({ segments: pair.positive_trace.segments, x: 0 }),
  ).toBeCloseTo(-1.6, 5)
  expect(maximumAbsolutePhaseSkew(pair)).toBeCloseTo(1.6, 5)

  const trace = cju(circuitJson).pcb_trace.get(pair.negative_trace.pcb_trace_id)
  if (trace === null) throw new Error("Missing negative trace")
  const walk = walkTrace({
    route: trace.route,
    pcbStackup: null,
    boardThickness: 0.8,
    copperLayerCount: 2,
  })
  if (walk === null) throw new Error("Negative trace has no planar copper")
  const { steps } = walk
  expect(steps).toHaveLength(2)
  expect(steps[0].layerChangeLengthAfterMm).toBeCloseTo(1.6, 5)
  expect(steps[1].layerChangeLengthBeforeMm).toBeCloseTo(1.6, 5)

  await expect(phaseSkewSvg(circuitJson)).toMatchSvgSnapshot(import.meta.path)
})
