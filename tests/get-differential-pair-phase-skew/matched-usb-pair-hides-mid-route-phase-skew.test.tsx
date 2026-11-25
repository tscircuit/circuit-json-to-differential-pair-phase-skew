import { expect, test } from "bun:test"
import { runAllRoutingChecks } from "@tscircuit/checks"
import { cju } from "@tscircuit/circuit-json-util"
import { getDifferentialPairPhaseSkew } from "lib/index"
import { maximumAbsolutePhaseSkew } from "tests/fixtures/phase-skew-endpoints"
import { phaseSkewSvg } from "tests/fixtures/phase-skew-svg"
import { renderCircuit } from "tests/fixtures/render-circuit"

/** Depth of D-'s square detour, so it adds as much length as D+'s triangular one. */
const DETOUR_DEPTH = Math.hypot(0.5, 1) - 0.5

test("matched USB trace totals hide 1.236 mm of mid-route phase skew", async () => {
  const circuitJson = await renderCircuit(
    <board width="30mm" height="8mm" routeRemaining={false}>
      <testpoint
        name="DP_SRC"
        footprintVariant="pad"
        padDiameter={0.3}
        doNotPlace
        pcbX={-12}
        pcbY={0.3}
      />
      <testpoint
        name="DN_SRC"
        footprintVariant="pad"
        padDiameter={0.3}
        doNotPlace
        pcbX={-12}
        pcbY={-0.3}
      />
      <testpoint
        name="DP_LOAD"
        footprintVariant="pad"
        padDiameter={0.3}
        doNotPlace
        pcbX={12}
        pcbY={0.3}
      />
      <testpoint
        name="DN_LOAD"
        footprintVariant="pad"
        padDiameter={0.3}
        doNotPlace
        pcbX={12}
        pcbY={-0.3}
      />
      <trace
        name="USB_DP"
        from=".DP_SRC > .pin1"
        to=".DP_LOAD > .pin1"
        thickness="0.15mm"
        pcbPath={[
          { x: 2, y: 0 },
          { x: 2.5, y: 1 },
          { x: 3, y: 0 },
          { x: 12, y: 0 },
        ]}
      />
      <trace
        name="USB_DN"
        from=".DN_SRC > .pin1"
        to=".DN_LOAD > .pin1"
        thickness="0.15mm"
        pcbPath={[
          { x: 12, y: 0 },
          { x: 20, y: 0 },
          { x: 20, y: -DETOUR_DEPTH },
          { x: 21, y: -DETOUR_DEPTH },
          { x: 21, y: 0 },
        ]}
      />
      <differentialpair
        name="USB"
        positiveConnection="USB_DP"
        negativeConnection="USB_DN"
        pcbTraceGap="0.45mm"
        maxLengthSkew="0.1mm"
      />
    </board>,
  )

  const [positive, negative] = cju(circuitJson).pcb_trace.list()
  expect(positive.trace_length).toBeCloseTo(25.2360679775, 9)
  expect(negative.trace_length).toBeCloseTo(25.2360679775, 9)
  expect(await runAllRoutingChecks(circuitJson)).toEqual([])
  const pairs = getDifferentialPairPhaseSkew({ circuitJson })
  expect(pairs).toHaveLength(1)
  expect(maximumAbsolutePhaseSkew(pairs[0])).toBe(1.23607)
  expect(
    pairs[0].positive_trace.segments.at(-1)?.end_length_difference_mm,
  ).toBe(0)
  await expect(phaseSkewSvg(circuitJson)).toMatchSvgSnapshot(import.meta.path)
})
