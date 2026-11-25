import { expect, test } from "bun:test"
import { getDifferentialPairPhaseSkew } from "lib/index"
import { createBasicAutorouter } from "tests/fixtures/create-basic-autorouter"
import { phaseSkewSvg } from "tests/fixtures/phase-skew-svg"
import { renderCircuit } from "tests/fixtures/render-circuit"

test("each phase skew segment takes the width of its start route point, like the copper", async () => {
  const circuitJson = await renderCircuit(
    <board
      width="22mm"
      height="6mm"
      autorouter={{
        algorithmFn: createBasicAutorouter(async (simpleRouteJson) =>
          simpleRouteJson.connections.map((connection, index) => {
            const [start, end] = connection.pointsToConnect
            return {
              type: "pcb_trace",
              pcb_trace_id: `trace_${index}`,
              connection_name: connection.name,
              route: [
                { ...start, route_type: "wire", width: 0.15 },
                {
                  x: 0,
                  y: start.y,
                  layer: "top",
                  route_type: "wire",
                  width: 0.8,
                },
                { ...end, route_type: "wire", width: 0.15 },
              ],
            }
          }),
        ),
      }}
    >
      <testpoint
        name="P1"
        footprintVariant="pad"
        padDiameter={0.3}
        doNotPlace
        pcbX={-9}
        pcbY={0.6}
      />
      <testpoint
        name="P2"
        footprintVariant="pad"
        padDiameter={0.3}
        doNotPlace
        pcbX={9}
        pcbY={0.6}
      />
      <testpoint
        name="N1"
        footprintVariant="pad"
        padDiameter={0.3}
        doNotPlace
        pcbX={-9}
        pcbY={-0.6}
      />
      <testpoint
        name="N2"
        footprintVariant="pad"
        padDiameter={0.3}
        doNotPlace
        pcbX={9}
        pcbY={-0.6}
      />
      <trace name="DP" from=".P1 > .pin1" to=".P2 > .pin1" />
      <trace name="DN" from=".N1 > .pin1" to=".N2 > .pin1" />
      <differentialpair
        name="PAIR"
        positiveConnection="DP"
        negativeConnection="DN"
        pcbTraceGap="0.6mm"
      />
      <pcbnotetext
        pcbY={2}
        fontSize={0.4}
        text="0.15 mm from x = -9, 0.8 mm from x = 0"
      />
    </board>,
  )
  const [pair] = getDifferentialPairPhaseSkew({ circuitJson })
  expect(pair).toMatchObject({
    positive_trace: { segments: [{ width: 0.15 }, { width: 0.8 }] },
    negative_trace: { segments: [{ width: 0.15 }, { width: 0.8 }] },
  })
  await expect(phaseSkewSvg(circuitJson)).toMatchSvgSnapshot(import.meta.path)
})
