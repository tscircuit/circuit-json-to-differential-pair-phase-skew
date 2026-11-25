import { expect, test } from "bun:test"
import type { PcbDifferentialPairPhaseSkewSegment } from "circuit-json"
import { getDifferentialPairPhaseSkew } from "lib/index"
import { createBasicAutorouter } from "tests/fixtures/create-basic-autorouter"
import { phaseSkewSvg } from "tests/fixtures/phase-skew-svg"
import { renderCircuit } from "tests/fixtures/render-circuit"

/** Tapers are cut every 0.01 mm of width change, so a piece is within half that of the copper, in mm. */
const TAPER_PIECE_WIDTH_TOLERANCE_MM = 0.005

/** DP's copper width at `x` along its two linear tapers, which cross the 2 mm pads' edges at x = ±8, in mm. */
function getPositiveCopperWidthMm(x: number): number {
  if (x < 0) return 1 - (0.85 * (x + 8.75)) / 2
  return 0.15 + (0.85 * (x - 6.75)) / 2
}

/** The segment that covers `x`. */
function segmentCoveringX({
  segments,
  x,
}: {
  segments: PcbDifferentialPairPhaseSkewSegment[]
  x: number
}): PcbDifferentialPairPhaseSkewSegment {
  const segment = segments.find(
    (candidate) =>
      Math.min(candidate.start.x, candidate.end.x) <= x &&
      Math.max(candidate.start.x, candidate.end.x) >= x,
  )
  if (segment === undefined) throw new Error(`No segment covers x = ${x}`)
  return segment
}

test("tapers that cross the pad edges keep the copper's local width after clipping", async () => {
  // DP jogs inside its 2 mm source pad, narrows linearly from 1 mm at
  // x = -8.75 to 0.15 mm at x = -6.75, widens back to 1 mm from x = 6.75 to
  // 8.75, and jogs again inside its 2 mm load pad. The jogs make clipping
  // straighten the routing inside both pads, which must not restart either
  // taper at the pad edges, x = -8 and x = 8.
  const circuitJson = await renderCircuit(
    <board
      width="25mm"
      height="10mm"
      autorouter={{
        algorithmFn: createBasicAutorouter(async (simpleRouteJson) =>
          simpleRouteJson.connections.map((connection, index) => {
            const [start, end] = connection.pointsToConnect
            const first = {
              ...start,
              route_type: "wire" as const,
              width: 0.15,
              start_pcb_port_id: start.pcb_port_id,
            }
            const last = {
              ...end,
              route_type: "wire" as const,
              width: 0.15,
              end_pcb_port_id: end.pcb_port_id,
            }
            if (start.y < 0) {
              return {
                type: "pcb_trace" as const,
                pcb_trace_id: `trace_${index}`,
                connection_name: connection.name,
                route: [first, last],
              }
            }
            const wire = {
              route_type: "wire" as const,
              y: start.y,
              layer: start.layer,
            }
            return {
              type: "pcb_trace" as const,
              pcb_trace_id: `trace_${index}`,
              connection_name: connection.name,
              route: [
                first,
                { ...wire, x: -8.9, y: start.y + 0.1, width: 1 },
                {
                  ...wire,
                  x: -8.75,
                  width: 1,
                  start_width: 1,
                  end_width: 0.15,
                  width_interpolation_mode: "linear" as const,
                },
                { ...wire, x: -6.75, width: 0.15 },
                {
                  ...wire,
                  x: 6.75,
                  width: 0.15,
                  start_width: 0.15,
                  end_width: 1,
                  width_interpolation_mode: "linear" as const,
                },
                { ...wire, x: 8.75, width: 1 },
                { ...wire, x: 8.9, y: start.y + 0.1, width: 1 },
                last,
              ],
            }
          }),
        ),
      }}
    >
      <testpoint
        name="TP_SRC"
        footprintVariant="pad"
        padDiameter="2mm"
        doNotPlace
        pcbX={-9}
        pcbY={1}
      />
      <testpoint
        name="TP_LOAD"
        footprintVariant="pad"
        padDiameter="2mm"
        doNotPlace
        pcbX={9}
        pcbY={1}
      />
      <testpoint
        name="TN_SRC"
        footprintVariant="pad"
        padDiameter="0.3mm"
        doNotPlace
        pcbX={-9}
        pcbY={-1}
      />
      <testpoint
        name="TN_LOAD"
        footprintVariant="pad"
        padDiameter="0.3mm"
        doNotPlace
        pcbX={9}
        pcbY={-1}
      />
      <trace name="DP" from=".TP_SRC > .pin1" to=".TP_LOAD > .pin1" />
      <trace name="DN" from=".TN_SRC > .pin1" to=".TN_LOAD > .pin1" />
      <differentialpair
        name="PAIR"
        positiveConnection="DP"
        negativeConnection="DN"
        pcbTraceGap="1.85mm"
      />
    </board>,
  )

  const [pair] = getDifferentialPairPhaseSkew({ circuitJson })
  expect(pair.positive_trace.segments.at(-1)?.end_length_difference_mm).toBe(0)
  for (const x of [-7.95, -7.5, -7, 7, 7.5, 7.95]) {
    const segment = segmentCoveringX({
      segments: pair.positive_trace.segments,
      x,
    })
    expect(
      Math.abs(segment.width - getPositiveCopperWidthMm(x)),
    ).toBeLessThanOrEqual(TAPER_PIECE_WIDTH_TOLERANCE_MM + 1e-9)
  }

  await expect(phaseSkewSvg(circuitJson)).toMatchSvgSnapshot(import.meta.path)
})
