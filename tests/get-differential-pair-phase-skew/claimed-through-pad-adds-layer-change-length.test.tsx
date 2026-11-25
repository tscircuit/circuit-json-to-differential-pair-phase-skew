import { expect, test } from "bun:test"
import { cju } from "@tscircuit/circuit-json-util"
import { getDifferentialPairPhaseSkew } from "lib/index"
import { createBasicAutorouter } from "tests/fixtures/create-basic-autorouter"
import { maximumAbsolutePhaseSkew } from "tests/fixtures/phase-skew-endpoints"
import { phaseSkewSvg } from "tests/fixtures/phase-skew-svg"
import { renderCircuit } from "tests/fixtures/render-circuit"

test("a claimed via, routed as a through pad, adds its layer change length to phase skew", async () => {
  const circuitJson = await renderCircuit(
    <board
      width="22mm"
      height="6mm"
      autorouter={{
        algorithmFn: createBasicAutorouter(async (simpleRouteJson) => {
          const via = simpleRouteJson.obstacles.find(
            (obstacle) => obstacle.netIsAssignable,
          )!
          return simpleRouteJson.connections.map((connection) => {
            const [start, end] = connection.pointsToConnect
            if (start.layer === end.layer) {
              return {
                type: "pcb_trace",
                pcb_trace_id: "trace_dn",
                connection_name: connection.name,
                route: [
                  { ...start, route_type: "wire", width: 0.15 },
                  { ...end, route_type: "wire", width: 0.15 },
                ],
              }
            }
            return {
              type: "pcb_trace",
              pcb_trace_id: "trace_dp",
              connection_name: connection.name,
              route: [
                { ...start, route_type: "wire", width: 0.15 },
                {
                  x: -4,
                  y: 0.4,
                  route_type: "wire",
                  width: 0.15,
                  layer: "top",
                },
                {
                  route_type: "through_obstacle",
                  start: { x: -4, y: 0.4 },
                  end: { x: -4, y: 0.4 },
                  from_layer: "top",
                  to_layer: "bottom",
                  width: 0.15,
                  circuitJsonMetadata: via.circuitJsonMetadata,
                },
                {
                  x: -4,
                  y: 0.4,
                  route_type: "wire",
                  width: 0.15,
                  layer: "bottom",
                },
                { ...end, route_type: "wire", width: 0.15 },
              ],
            }
          })
        }),
      }}
    >
      <testpoint
        name="P1"
        footprintVariant="pad"
        padDiameter={0.3}
        doNotPlace
        pcbX={-9}
        pcbY={0.4}
      />
      <testpoint
        name="P2"
        footprintVariant="pad"
        padDiameter={0.3}
        doNotPlace
        layer="bottom"
        pcbX={9}
        pcbY={0.4}
      />
      <testpoint
        name="N1"
        footprintVariant="pad"
        padDiameter={0.3}
        doNotPlace
        layer="bottom"
        pcbX={-9}
        pcbY={-0.4}
      />
      <testpoint
        name="N2"
        footprintVariant="pad"
        padDiameter={0.3}
        doNotPlace
        layer="bottom"
        pcbX={9}
        pcbY={-0.4}
      />
      <via
        pcbX={-4}
        pcbY={0.4}
        fromLayer="top"
        toLayer="bottom"
        holeDiameter={0.2}
        outerDiameter={0.4}
        netIsAssignable
      />
      <trace name="DP" from=".P1 > .pin1" to=".P2 > .pin1" />
      <trace name="DN" from=".N1 > .pin1" to=".N2 > .pin1" />
      <differentialpair
        name="PAIR"
        positiveConnection="DP"
        negativeConnection="DN"
        pcbTraceGap="0.65mm"
      />
      <pcbnotetext
        pcbY={2}
        fontSize={0.4}
        text="DP drops to bottom through a claimed via"
      />
    </board>,
  )
  const db = cju(circuitJson)

  const [dp] = db.pcb_trace.list()
  expect(dp.route.map((point) => point.route_type)).toContain("through_pad")
  // DP is ahead by the board thickness once both traces are on bottom, the
  // same as when the route uses a via (routed-via-adds-layer-change-length).
  const [pair] = getDifferentialPairPhaseSkew({ circuitJson })
  expect(pair).toMatchObject({})
  expect(maximumAbsolutePhaseSkew(pair)).toBe(db.pcb_board.list()[0].thickness)
  await expect(phaseSkewSvg(circuitJson)).toMatchSvgSnapshot(import.meta.path)
})
