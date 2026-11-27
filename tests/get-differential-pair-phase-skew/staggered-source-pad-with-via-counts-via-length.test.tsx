import { expect, test } from "bun:test"
import { cju } from "@tscircuit/circuit-json-util"
import { getDifferentialPairPhaseSkew } from "lib/index"
import { renderCircuit } from "tests/fixtures/render-circuit"

test("staggered source pads include any via at either source pad in the initial phase skew", async () => {
  // DP starts at x = -12 on bottom with a source-pad via up to top and fans
  // past DN's top source pad at x = -11. Across DN's pad, DP has already
  // travelled both its 1.6 mm source via and ~1.25 mm of planar fanout.
  const partnerBehindWithVia = await renderCircuit(
    <board width="30mm" height="8mm" routeRemaining={false}>
      <testpoint
        name="TP_SRC"
        footprintVariant="pad"
        padDiameter="0.3mm"
        doNotPlace
        pcbX={-12}
        pcbY={0.3}
        layer="bottom"
      />
      <testpoint
        name="TP_LOAD"
        footprintVariant="pad"
        padDiameter="0.3mm"
        doNotPlace
        pcbX={12}
        pcbY={0.3}
      />
      <testpoint
        name="TN_SRC"
        footprintVariant="pad"
        padDiameter="0.3mm"
        doNotPlace
        pcbX={-11}
        pcbY={-0.3}
      />
      <testpoint
        name="TN_LOAD"
        footprintVariant="pad"
        padDiameter="0.3mm"
        doNotPlace
        pcbX={12}
        pcbY={-0.3}
      />
      <trace
        name="DP"
        from=".TP_SRC > .pin1"
        to=".TP_LOAD > .pin1"
        thickness="0.15mm"
        pcbPath={[
          { x: 0, y: 0, via: true, fromLayer: "bottom", toLayer: "top" },
          { x: 0.6, y: 0.6 },
          { x: 1.6, y: 0.6 },
          { x: 2.2, y: 0 },
        ]}
      />
      <trace
        name="DN"
        from=".TN_SRC > .pin1"
        to=".TN_LOAD > .pin1"
        thickness="0.15mm"
        pcbPath={[]}
      />
      <differentialpair
        name="PAIR"
        positiveConnection="DP"
        negativeConnection="DN"
        pcbTraceGap="0.45mm"
      />
    </board>,
  )

  const boardThicknessMm =
    cju(partnerBehindWithVia).pcb_board.list()[0]!.thickness
  const [pairBehindWithVia] = getDifferentialPairPhaseSkew({
    circuitJson: partnerBehindWithVia,
  })
  expect(
    pairBehindWithVia!.positive_trace.segments[0]!.start_length_difference_mm,
  ).toBeCloseTo(boardThicknessMm, 5)
  expect(
    pairBehindWithVia!.negative_trace.segments[0]!.start_length_difference_mm,
  ).toBeLessThan(-(boardThicknessMm + 1))

  // Converse: DP starts on top at x = -12 with no via and couples at x = -10
  // right where DN climbs a bottom-to-top via at its staggered pad (-10, -0.3).
  // DP's solo 2 mm lead from x = -12 to x = -10 ramps 0 -> +2 mm before DN's
  // via steps DP down to +0.4 mm and DN starts at -0.4 mm.
  const partnerAheadWithVia = await renderCircuit(
    <board width="30mm" height="8mm" routeRemaining={false}>
      <testpoint
        name="TP_SRC"
        footprintVariant="pad"
        padDiameter="0.3mm"
        doNotPlace
        pcbX={-12}
        pcbY={0.3}
      />
      <testpoint
        name="TP_LOAD"
        footprintVariant="pad"
        padDiameter="0.3mm"
        doNotPlace
        pcbX={12}
        pcbY={0.3}
      />
      <testpoint
        name="TN_SRC"
        footprintVariant="pad"
        padDiameter="0.3mm"
        doNotPlace
        pcbX={-10}
        pcbY={-0.3}
        layer="bottom"
      />
      <testpoint
        name="TN_LOAD"
        footprintVariant="pad"
        padDiameter="0.3mm"
        doNotPlace
        pcbX={12}
        pcbY={-0.3}
      />
      <trace
        name="DP"
        from=".TP_SRC > .pin1"
        to=".TP_LOAD > .pin1"
        thickness="0.15mm"
        pcbPath={[]}
      />
      <trace
        name="DN"
        from=".TN_SRC > .pin1"
        to=".TN_LOAD > .pin1"
        thickness="0.15mm"
        pcbPath={[
          { x: 0, y: 0, via: true, fromLayer: "bottom", toLayer: "top" },
        ]}
      />
      <differentialpair
        name="PAIR"
        positiveConnection="DP"
        negativeConnection="DN"
        pcbTraceGap="0.45mm"
      />
    </board>,
  )

  const [pairAheadWithVia] = getDifferentialPairPhaseSkew({
    circuitJson: partnerAheadWithVia,
  })
  const [leadingPositive, coupledPositive] =
    pairAheadWithVia!.positive_trace.segments
  expect(leadingPositive!.start_length_difference_mm).toBe(0)
  expect(leadingPositive!.end_length_difference_mm).toBeCloseTo(2, 5)
  expect(coupledPositive!.start_length_difference_mm).toBeCloseTo(
    2 - boardThicknessMm,
    5,
  )
  expect(
    pairAheadWithVia!.negative_trace.segments[0]!.start_length_difference_mm,
  ).toBeCloseTo(boardThicknessMm - 2, 5)
})
