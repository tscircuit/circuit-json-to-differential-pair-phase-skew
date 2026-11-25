import { expect, test } from "bun:test"
import { cju } from "@tscircuit/circuit-json-util"
import { getDifferentialPairPhaseSkew } from "lib/index"
import { renderPairBoard } from "tests/fixtures/pair-board"
import { maximumAbsolutePhaseSkew } from "tests/fixtures/phase-skew-endpoints"
import { phaseSkewSvg } from "tests/fixtures/phase-skew-svg"
import { phaseSkewAtX } from "tests/fixtures/segment-at-x"

test("a via counts the stackup layer distance and a same-layer via adds nothing", async () => {
  // 4-layer board with a pcb_stackup: DN hops top -> inner1 -> top while DP
  // stays on top with a no-op top -> top via.
  const circuitJson = await renderPairBoard({
    positivePath: [
      { x: 12, y: 0, via: true, fromLayer: "top", toLayer: "top" },
    ],
    negativePath: [
      { x: 6, y: 0, via: true, fromLayer: "top", toLayer: "inner1" },
      { x: 18, y: 0, via: true, fromLayer: "inner1", toLayer: "top" },
    ],
    pcbTraceGap: "0.45mm",
    layers: 4,
    thickness: "1.6mm",
    fabricatorPreset: "jlcpcb_standard",
  })

  const [stackup] = cju(circuitJson).pcb_stackup.list()
  expect(stackup).toBeDefined()
  const top = stackup!.layers.find(
    (layer) => layer.layer_type === "copper" && layer.layer === "top",
  )!
  const prepreg = stackup!.layers[1]
  const inner1 = stackup!.layers.find(
    (layer) => layer.layer_type === "copper" && layer.layer === "inner1",
  )!
  // KiCad rule: full outer copper, all intervening dielectric, half inner copper.
  const expectedViaLength =
    top.thickness! + prepreg.thickness! + inner1.thickness! / 2

  const [pair] = getDifferentialPairPhaseSkew({ circuitJson })

  expect(phaseSkewAtX({ segments: pair.positive_trace.segments, x: -9 })).toBe(
    0,
  )
  expect(
    phaseSkewAtX({ segments: pair.positive_trace.segments, x: 0 }),
  ).toBeCloseTo(-expectedViaLength, 5)
  expect(
    phaseSkewAtX({ segments: pair.positive_trace.segments, x: 9 }),
  ).toBeCloseTo(-2 * expectedViaLength, 5)
  expect(maximumAbsolutePhaseSkew(pair)).toBeCloseTo(2 * expectedViaLength, 5)

  await expect(phaseSkewSvg(circuitJson)).toMatchSvgSnapshot(import.meta.path)
})
