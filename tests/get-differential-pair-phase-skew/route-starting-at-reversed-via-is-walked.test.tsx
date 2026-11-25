import { expect, test } from "bun:test"
import { cju } from "@tscircuit/circuit-json-util"
import { getDifferentialPairPhaseSkew } from "lib/index"
import { createBasicAutorouter } from "tests/fixtures/create-basic-autorouter"
import { phaseSkewSvg } from "tests/fixtures/phase-skew-svg"
import { renderCircuit } from "tests/fixtures/render-circuit"

test("a route that starts with a via leaving on its from_layer is walked across the via", async () => {
  // DP's source pad is on bottom. Its router output starts with a via
  // stored from top to bottom, then runs on top, so the route leaves the via
  // on its from_layer. Vias join their two layers either way, so DP is
  // walked from bottom up to top and is ahead of DN by the via's length.
  const circuitJson = await renderCircuit(
    <board
      width="24mm"
      height="6mm"
      autorouter={{
        algorithmFn: createBasicAutorouter(async (simpleRouteJson) =>
          simpleRouteJson.connections.map((connection, index) => {
            const [start, end] = connection.pointsToConnect
            const wire = { route_type: "wire" as const, width: 0.15 }
            if (start.layer === "top") {
              return {
                type: "pcb_trace" as const,
                pcb_trace_id: `trace_${index}`,
                connection_name: connection.name,
                route: [
                  { ...start, ...wire },
                  { ...end, ...wire },
                ],
              }
            }
            return {
              type: "pcb_trace" as const,
              pcb_trace_id: `trace_${index}`,
              connection_name: connection.name,
              route: [
                {
                  route_type: "via" as const,
                  x: start.x,
                  y: start.y,
                  from_layer: "top" as const,
                  to_layer: "bottom" as const,
                },
                { ...wire, x: start.x, y: start.y, layer: "top" as const },
                { ...end, ...wire },
              ],
            }
          }),
        ),
      }}
    >
      <testpoint
        name="TP_SRC"
        footprintVariant="pad"
        padDiameter="0.3mm"
        doNotPlace
        pcbX={-9}
        pcbY={0.3}
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
        pcbY={-0.3}
      />
      <testpoint
        name="TN_LOAD"
        footprintVariant="pad"
        padDiameter="0.3mm"
        doNotPlace
        pcbX={9}
        pcbY={-0.3}
      />
      <trace name="DP" from=".TP_SRC > .pin1" to=".TP_LOAD > .pin1" />
      <trace name="DN" from=".TN_SRC > .pin1" to=".TN_LOAD > .pin1" />
      <differentialpair
        name="PAIR"
        positiveConnection="DP"
        negativeConnection="DN"
        pcbTraceGap="0.45mm"
      />
    </board>,
  )
  const db = cju(circuitJson)
  expect(db.pcb_trace.list()[0].route[0]).toMatchObject({
    route_type: "via",
    from_layer: "top",
  })

  const [pair] = getDifferentialPairPhaseSkew({ circuitJson })
  expect(
    pair.positive_trace.segments.at(-1)?.end_length_difference_mm,
  ).toBeCloseTo(db.pcb_board.list()[0].thickness, 5)

  await expect(phaseSkewSvg(circuitJson)).toMatchSvgSnapshot(import.meta.path)
})
