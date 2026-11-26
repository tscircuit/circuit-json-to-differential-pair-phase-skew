import { expect, test } from "bun:test"
import { getDifferentialPairPhaseSkew } from "lib/index"
import { maximumAbsolutePhaseSkew } from "tests/fixtures/phase-skew-endpoints"
import { phaseSkewSvg } from "tests/fixtures/phase-skew-svg"
import { renderCircuit } from "tests/fixtures/render-circuit"

test("jogs inside the source and load pads add no phase skew, as KiCad clips routing inside pads", async () => {
  // DP leaves the centre of its 2 mm source pad with a 0.3 mm triangular jog
  // that stays inside the pad, runs beside DN, and ends with the same jog
  // inside its 2 mm load pad. KiCad measures the copper inside a pad as a
  // straight line from the pad centre to where the route leaves it, so the
  // jogs add nothing.
  const circuitJson = await renderCircuit(
    <board width="25mm" height="10mm" routeRemaining={false}>
      <testpoint
        name="TP_SRC"
        footprintVariant="pad"
        padDiameter="2mm"
        doNotPlace
        pcbX={-8}
        pcbY={1.5}
      />
      <testpoint
        name="TP_LOAD"
        footprintVariant="pad"
        padDiameter="2mm"
        doNotPlace
        pcbX={8}
        pcbY={1.5}
      />
      <testpoint
        name="TN_SRC"
        footprintVariant="pad"
        padDiameter="0.45mm"
        doNotPlace
        pcbX={-8}
        pcbY={-1.5}
      />
      <testpoint
        name="TN_LOAD"
        footprintVariant="pad"
        padDiameter="0.45mm"
        doNotPlace
        pcbX={8}
        pcbY={-1.5}
      />
      <trace
        name="DP"
        from=".TP_SRC > .pin1"
        to=".TP_LOAD > .pin1"
        thickness="0.15mm"
        pcbPath={[
          { x: 0.3, y: 0.3 },
          { x: 0.6, y: 0 },
          { x: 2, y: 0 },
          { x: 3.2, y: -1.2 },
          { x: 12.8, y: -1.2 },
          { x: 14, y: 0 },
          { x: 15.4, y: 0 },
          { x: 15.7, y: 0.3 },
        ]}
      />
      <trace
        name="DN"
        from=".TN_SRC > .pin1"
        to=".TN_LOAD > .pin1"
        thickness="0.15mm"
        pcbPath={[
          { x: 2, y: 0 },
          { x: 3.2, y: 1.2 },
          { x: 12.8, y: 1.2 },
          { x: 14, y: 0 },
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

  const [pair] = getDifferentialPairPhaseSkew({ circuitJson })
  expect(pair.end_to_end_length_difference_mm).toBe(0)
  expect(pair.positive_trace.segments.at(-1)?.end_length_difference_mm).toBe(0)
  expect(maximumAbsolutePhaseSkew(pair)).toBe(0)
  // DP's copper inside each pad is measured straight from the pad edge, at
  // x = -7 and x = 7, to the pad centre, carrying on straight to x = -6 and
  // from x = 6.
  const positiveSegments = pair.positive_trace.segments
  const firstPositiveSegment = positiveSegments[0]
  const lastPositiveSegment = positiveSegments[positiveSegments.length - 1]
  expect(firstPositiveSegment.start).toEqual({ x: -8, y: 1.5 })
  expect(firstPositiveSegment.end.x).toBeCloseTo(-6, 9)
  expect(firstPositiveSegment.end.y).toBeCloseTo(1.5, 9)
  expect(lastPositiveSegment.start.x).toBeCloseTo(6, 9)
  expect(lastPositiveSegment.start.y).toBeCloseTo(1.5, 9)
  expect(lastPositiveSegment.end).toEqual({ x: 8, y: 1.5 })

  await expect(phaseSkewSvg(circuitJson)).toMatchSvgSnapshot(import.meta.path)
})
