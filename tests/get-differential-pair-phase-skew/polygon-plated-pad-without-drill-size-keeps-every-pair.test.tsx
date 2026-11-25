import { expect, test } from "bun:test"
import { cju } from "@tscircuit/circuit-json-util"
import { getDifferentialPairPhaseSkew } from "lib/index"
import { maximumAbsolutePhaseSkew } from "tests/fixtures/phase-skew-endpoints"
import { phaseSkewSvg } from "tests/fixtures/phase-skew-svg"
import { renderCircuit } from "tests/fixtures/render-circuit"

test("a polygon plated pad without a drill size is clipped by its outline and every pair is measured", async () => {
  // POLYGON_PAIR's positive trace starts in a 2 mm square plated pad whose
  // circular drill has no diameter, which Circuit JSON accepts. It jogs
  // inside the pad before running beside its partner. PAIR is a straight
  // pair below it.
  const circuitJson = await renderCircuit(
    <board width="24mm" height="14mm" routeRemaining={false}>
      <chip
        name="PP_SRC"
        pcbX={-9}
        pcbY={3.3}
        footprint={
          <footprint>
            <platedhole
              shape="hole_with_polygon_pad"
              holeShape="circle"
              holeOffsetX={0}
              holeOffsetY={0}
              portHints={["1"]}
              padOutline={[
                { x: -1, y: -1 },
                { x: 1, y: -1 },
                { x: 1, y: 1 },
                { x: -1, y: 1 },
              ]}
            />
          </footprint>
        }
      />
      <testpoint
        name="PP_LOAD"
        footprintVariant="pad"
        padDiameter="0.3mm"
        doNotPlace
        pcbX={9}
        pcbY={3.3}
      />
      <testpoint
        name="PN_SRC"
        footprintVariant="pad"
        padDiameter="0.3mm"
        doNotPlace
        pcbX={-9}
        pcbY={2.7}
      />
      <testpoint
        name="PN_LOAD"
        footprintVariant="pad"
        padDiameter="0.3mm"
        doNotPlace
        pcbX={9}
        pcbY={2.7}
      />
      <trace
        name="PP"
        from=".PP_SRC > .pin1"
        to=".PP_LOAD > .pin1"
        thickness="0.15mm"
        pcbPath={[
          { x: 0.3, y: 0.3 },
          { x: 0.6, y: 0 },
          { x: 2, y: 0 },
        ]}
      />
      <trace
        name="PN"
        from=".PN_SRC > .pin1"
        to=".PN_LOAD > .pin1"
        thickness="0.15mm"
        pcbPath={[]}
      />
      <differentialpair
        name="POLYGON_PAIR"
        positiveConnection="PP"
        negativeConnection="PN"
        pcbTraceGap="0.45mm"
      />
      <testpoint
        name="TP_SRC"
        footprintVariant="pad"
        padDiameter="0.3mm"
        doNotPlace
        pcbX={-9}
        pcbY={-2.7}
      />
      <testpoint
        name="TP_LOAD"
        footprintVariant="pad"
        padDiameter="0.3mm"
        doNotPlace
        pcbX={9}
        pcbY={-2.7}
      />
      <testpoint
        name="TN_SRC"
        footprintVariant="pad"
        padDiameter="0.3mm"
        doNotPlace
        pcbX={-9}
        pcbY={-3.3}
      />
      <testpoint
        name="TN_LOAD"
        footprintVariant="pad"
        padDiameter="0.3mm"
        doNotPlace
        pcbX={9}
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
  const db = cju(circuitJson)
  expect(db.pcb_plated_hole.list()[0]).toMatchObject({
    shape: "hole_with_polygon_pad",
    hole_shape: "circle",
    hole_diameter: undefined,
  })

  const differentialPairPhaseSkews = getDifferentialPairPhaseSkew({
    circuitJson,
  })
  expect(
    differentialPairPhaseSkews.map(
      (pair) => db.source_bus.get(pair.source_bus_id)?.name,
    ),
  ).toEqual(["POLYGON_PAIR", "PAIR"])
  // The jog stays inside the square pad, so it adds nothing.
  for (const pair of differentialPairPhaseSkews) {
    expect(pair.positive_trace.segments.at(-1)?.end_length_difference_mm).toBe(
      0,
    )
    expect(maximumAbsolutePhaseSkew(pair)).toBe(0)
  }

  await expect(phaseSkewSvg(circuitJson)).toMatchSvgSnapshot(import.meta.path)
})
