import { expect, test } from "bun:test"
import { cju } from "@tscircuit/circuit-json-util"
import { getDifferentialPairPhaseSkew } from "lib/index"
import { phaseSkewSvg } from "tests/fixtures/phase-skew-svg"
import { renderCircuit } from "tests/fixtures/render-circuit"

test("a source-pad via before an uncoupled fanout starts with the via's phase skew instead of ramping from zero", async () => {
  // DP starts on a bottom pad at (-9, 2) with a via up to top right at the
  // pad, then both traces make the same 2 mm fanout in X to y = ±0.3 before
  // coupling. Because DP has already crossed the board before its first
  // planar segment, its fanout starts ahead by the board thickness rather
  // than ramping from zero across symmetric copper.
  const circuitJson = await renderCircuit(
    <board width="24mm" height="8mm" routeRemaining={false}>
      <testpoint
        name="TP_SRC"
        footprintVariant="pad"
        padDiameter="0.3mm"
        doNotPlace
        pcbX={-9}
        pcbY={2}
        layer="bottom"
      />
      <testpoint
        name="TP_LOAD"
        footprintVariant="pad"
        padDiameter="0.3mm"
        doNotPlace
        pcbX={9}
        pcbY={0.3}
      />
      <testpoint
        name="TN_SRC"
        footprintVariant="pad"
        padDiameter="0.3mm"
        doNotPlace
        pcbX={-9}
        pcbY={-2}
      />
      <testpoint
        name="TN_LOAD"
        footprintVariant="pad"
        padDiameter="0.3mm"
        doNotPlace
        pcbX={9}
        pcbY={-0.3}
      />
      <trace
        name="DP"
        from=".TP_SRC > .pin1"
        to=".TP_LOAD > .pin1"
        thickness="0.15mm"
        pcbPath={[
          { x: 0, y: 0, via: true, fromLayer: "bottom", toLayer: "top" },
          { x: 2, y: -1.7 },
        ]}
      />
      <trace
        name="DN"
        from=".TN_SRC > .pin1"
        to=".TN_LOAD > .pin1"
        thickness="0.15mm"
        pcbPath={[{ x: 2, y: 1.7 }]}
      />
      <differentialpair
        name="PAIR"
        positiveConnection="DP"
        negativeConnection="DN"
        pcbTraceGap="0.45mm"
      />
    </board>,
  )

  const boardThicknessMm = cju(circuitJson).pcb_board.list()[0]!.thickness
  const [pair] = getDifferentialPairPhaseSkew({ circuitJson })

  for (const segment of pair!.positive_trace.segments) {
    expect(segment.start_length_difference_mm).toBeCloseTo(boardThicknessMm, 5)
    expect(segment.end_length_difference_mm).toBeCloseTo(boardThicknessMm, 5)
  }
  for (const segment of pair!.negative_trace.segments) {
    expect(segment.start_length_difference_mm).toBeCloseTo(-boardThicknessMm, 5)
    expect(segment.end_length_difference_mm).toBeCloseTo(-boardThicknessMm, 5)
  }

  await expect(phaseSkewSvg(circuitJson)).toMatchSvgSnapshot(import.meta.path)
})
