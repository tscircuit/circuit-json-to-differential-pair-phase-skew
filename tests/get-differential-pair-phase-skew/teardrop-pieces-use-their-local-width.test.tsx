import { expect, test } from "bun:test"
import { getDifferentialPairPhaseSkew } from "lib/index"
import { maximumAbsolutePhaseSkew } from "tests/fixtures/phase-skew-endpoints"
import { phaseSkewSvg } from "tests/fixtures/phase-skew-svg"
import { renderCircuit } from "tests/fixtures/render-circuit"

/** Where DP's source teardrop starts and ends, in mm along x. */
const TEARDROP_START_X_MM = -9
const TEARDROP_END_X_MM = -7.5

/**
 * DP's width at `x` along its source teardrop, which narrows quadratically
 * from 0.8 mm to 0.15 mm and is flat at its narrow end, in mm.
 */
function getTeardropWidthMm(x: number): number {
  const fraction =
    (x - TEARDROP_START_X_MM) / (TEARDROP_END_X_MM - TEARDROP_START_X_MM)
  return 0.15 + 0.65 * (1 - fraction) ** 2
}

test("teardrop pieces are matched and drawn at their local width", async () => {
  // Core gives DP a 1.5 mm teardrop from its 1 mm source pad, narrowing from
  // 0.8 mm to its 0.15 mm trace width.
  const circuitJson = await renderCircuit(
    <board width="24mm" height="6mm" routeRemaining={false}>
      <testpoint
        name="TP_SRC"
        footprintVariant="pad"
        padDiameter="1mm"
        doNotPlace
        pcbX={-9}
        pcbY={0.45}
      />
      <testpoint
        name="TP_LOAD"
        footprintVariant="pad"
        padDiameter="0.3mm"
        doNotPlace
        pcbX={9}
        pcbY={0.45}
      />
      <testpoint
        name="TN_SRC"
        footprintVariant="pad"
        padDiameter="0.3mm"
        doNotPlace
        pcbX={-9}
        pcbY={-0.45}
      />
      <testpoint
        name="TN_LOAD"
        footprintVariant="pad"
        padDiameter="0.3mm"
        doNotPlace
        pcbX={9}
        pcbY={-0.45}
      />
      <trace
        name="DP"
        from=".TP_SRC > .pin1"
        to=".TP_LOAD > .pin1"
        thickness="0.15mm"
        pcbTeardrops
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
        pcbTraceGap="0.75mm"
      />
    </board>,
  )

  const [pair] = getDifferentialPairPhaseSkew({ circuitJson })
  expect(maximumAbsolutePhaseSkew(pair)).toBe(0)
  const teardropSegments = pair.positive_trace.segments.filter(
    (segment) => segment.end.x <= TEARDROP_END_X_MM + 1e-9,
  )
  // Cut every 0.01 mm of width change: 65 pieces from 0.8 mm to 0.15 mm.
  expect(teardropSegments).toHaveLength(65)
  expect(teardropSegments[0].width).toBeCloseTo(0.795, 9)
  expect(teardropSegments[64].width).toBeCloseTo(0.155, 9)
  // Each piece is as wide as the teardrop between its two ends.
  for (const segment of teardropSegments) {
    expect(segment.width).toBeLessThanOrEqual(
      getTeardropWidthMm(segment.start.x) + 1e-9,
    )
    expect(segment.width).toBeGreaterThanOrEqual(
      getTeardropWidthMm(segment.end.x) - 1e-9,
    )
  }

  await expect(phaseSkewSvg(circuitJson)).toMatchSvgSnapshot(import.meta.path)
})
