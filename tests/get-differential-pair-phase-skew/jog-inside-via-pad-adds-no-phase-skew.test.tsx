import { expect, test } from "bun:test"
import { cju } from "@tscircuit/circuit-json-util"
import { getDifferentialPairPhaseSkew } from "lib/index"
import { renderPairBoard } from "tests/fixtures/pair-board"
import { maximumAbsolutePhaseSkew } from "tests/fixtures/phase-skew-endpoints"
import { phaseSkewSvg } from "tests/fixtures/phase-skew-svg"

test("a jog inside a via's pad adds no phase skew, as KiCad clips routing inside vias", async () => {
  // Both traces drop through a via at x = 0. Just before its 0.3 mm pad, DP
  // jogs up by 0.07 mm, inside the pad. KiCad measures the copper inside a
  // via's pad as a straight line from the pad's edge to the via centre, so
  // the jog adds nothing and both traces keep the via's layer change.
  const via = {
    x: 12,
    y: 0,
    via: true,
    fromLayer: "top",
    toLayer: "bottom",
  } as const
  const circuitJson = await renderPairBoard({
    positivePath: [{ x: 11.87, y: 0 }, { x: 11.9, y: 0.07 }, via],
    negativePath: [{ x: 11.87, y: 0 }, via],
    pcbTraceGap: "0.45mm",
  })
  expect(cju(circuitJson).pcb_via.list()[0].outer_diameter).toBe(0.3)

  const [pair] = getDifferentialPairPhaseSkew({ circuitJson })
  expect(pair.positive_trace.segments.at(-1)?.end_length_difference_mm).toBe(0)
  expect(maximumAbsolutePhaseSkew(pair)).toBe(0)

  await expect(phaseSkewSvg(circuitJson)).toMatchSvgSnapshot(import.meta.path)
})
