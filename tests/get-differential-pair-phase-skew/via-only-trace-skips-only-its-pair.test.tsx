import { expect, test } from "bun:test"
import { cju } from "@tscircuit/circuit-json-util"
import { getDifferentialPairPhaseSkew } from "lib/index"
import { maximumAbsolutePhaseSkew } from "tests/fixtures/phase-skew-endpoints"
import { phaseSkewSvg } from "tests/fixtures/phase-skew-svg"
import { renderCircuit } from "tests/fixtures/render-circuit"

test("a pair with a via-only trace is skipped and the other pair is still measured", async () => {
  // VIA_PAIR's positive trace joins a top pad to a bottom pad at the same
  // point with a via in pad, so it has no planar copper. PAIR is a straight
  // pair beside it.
  const circuitJson = await renderCircuit(
    <board width="30mm" height="12mm" routeRemaining={false}>
      <testpoint
        name="VP_SRC"
        footprintVariant="pad"
        padDiameter="0.45mm"
        doNotPlace
        pcbX={-8}
        pcbY={3.3}
      />
      <testpoint
        name="VP_LOAD"
        footprintVariant="pad"
        padDiameter="0.45mm"
        doNotPlace
        pcbX={-8}
        pcbY={3.3}
        layer="bottom"
      />
      <testpoint
        name="VN_SRC"
        footprintVariant="pad"
        padDiameter="0.45mm"
        doNotPlace
        pcbX={-8}
        pcbY={2.7}
      />
      <testpoint
        name="VN_LOAD"
        footprintVariant="pad"
        padDiameter="0.45mm"
        doNotPlace
        pcbX={8}
        pcbY={2.7}
      />
      <trace
        name="VP"
        from=".VP_SRC > .pin1"
        to=".VP_LOAD > .pin1"
        thickness="0.15mm"
        pcbPath={[
          { x: 0, y: 0, via: true, fromLayer: "top", toLayer: "bottom" },
        ]}
      />
      <trace
        name="VN"
        from=".VN_SRC > .pin1"
        to=".VN_LOAD > .pin1"
        thickness="0.15mm"
        pcbPath={[]}
      />
      <differentialpair
        name="VIA_PAIR"
        positiveConnection="VP"
        negativeConnection="VN"
        pcbTraceGap="0.45mm"
      />
      <testpoint
        name="TP_SRC"
        footprintVariant="pad"
        padDiameter="0.3mm"
        doNotPlace
        pcbX={-8}
        pcbY={-2.7}
      />
      <testpoint
        name="TP_LOAD"
        footprintVariant="pad"
        padDiameter="0.3mm"
        doNotPlace
        pcbX={8}
        pcbY={-2.7}
      />
      <testpoint
        name="TN_SRC"
        footprintVariant="pad"
        padDiameter="0.3mm"
        doNotPlace
        pcbX={-8}
        pcbY={-3.3}
      />
      <testpoint
        name="TN_LOAD"
        footprintVariant="pad"
        padDiameter="0.3mm"
        doNotPlace
        pcbX={8}
        pcbY={-3.3}
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

  const differentialPairPhaseSkews = getDifferentialPairPhaseSkew({
    circuitJson,
  })
  expect(differentialPairPhaseSkews).toHaveLength(1)
  const [pair] = differentialPairPhaseSkews
  expect(cju(circuitJson).source_bus.get(pair.source_bus_id)?.name).toBe("PAIR")
  expect(maximumAbsolutePhaseSkew(pair)).toBe(0)

  await expect(phaseSkewSvg(circuitJson)).toMatchSvgSnapshot(import.meta.path)
})
