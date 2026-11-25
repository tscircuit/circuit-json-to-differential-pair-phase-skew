import { expect, test } from "bun:test"
import { getDifferentialPairPhaseSkew } from "lib/index"
import { renderPairBoard } from "tests/fixtures/pair-board"
import {
  maximumAbsolutePhaseSkew,
  phaseSkewEndpoints,
} from "tests/fixtures/phase-skew-endpoints"
import { phaseSkewSvg } from "tests/fixtures/phase-skew-svg"
import { phaseSkewAtX } from "tests/fixtures/segment-at-x"

test("an asymmetric via lands as a step at the via instead of smearing across the uncoupled stretch", async () => {
  // DP drops to the bottom layer at x = -6 while DN stays on top until its own
  // via at x = 0; both return to top together at x = 6. Between x = -6 and
  // x = 0, DP has already paid the 1.6 mm via length and DN has not yet.
  const circuitJson = await renderPairBoard({
    positivePath: [
      { x: 6, y: 0, via: true, fromLayer: "top", toLayer: "bottom" },
      { x: 18, y: 0, via: true, fromLayer: "bottom", toLayer: "top" },
    ],
    negativePath: [
      { x: 12, y: 0, via: true, fromLayer: "top", toLayer: "bottom" },
      { x: 18, y: 0, via: true, fromLayer: "bottom", toLayer: "top" },
    ],
    pcbTraceGap: "0.45mm",
  })

  const [pair] = getDifferentialPairPhaseSkew({ circuitJson })

  // Coupled before x = -6 and after x = 0 with zero skew.
  expect(phaseSkewAtX({ segments: pair.positive_trace.segments, x: -9 })).toBe(
    0,
  )
  expect(phaseSkewAtX({ segments: pair.positive_trace.segments, x: 3 })).toBe(0)

  // Between the staggered vias, the via length has stepped in immediately at
  // x = -6 and stays flat across the uncoupled stretch until DN's via at x = 0.
  for (const x of [-5.5, -0.5]) {
    expect(
      phaseSkewAtX({ segments: pair.positive_trace.segments, x }),
    ).toBeCloseTo(1.6, 5)
    expect(
      phaseSkewAtX({ segments: pair.negative_trace.segments, x }),
    ).toBeCloseTo(-1.6, 5)
  }
  expect(Math.max(0, ...phaseSkewEndpoints(pair.positive_trace))).toBe(1.6)
  expect(Math.min(0, ...phaseSkewEndpoints(pair.positive_trace))).toBe(0)
  expect(Math.max(0, ...phaseSkewEndpoints(pair.negative_trace))).toBe(0)
  expect(Math.min(0, ...phaseSkewEndpoints(pair.negative_trace))).toBe(-1.6)
  expect(maximumAbsolutePhaseSkew(pair)).toBeCloseTo(1.6, 5)

  // Routing DN from its load pad must reverse start/end via lengths identically.
  const [reversed] = getDifferentialPairPhaseSkew({
    circuitJson: await renderPairBoard({
      positivePath: [
        { x: 6, y: 0, via: true, fromLayer: "top", toLayer: "bottom" },
        { x: 18, y: 0, via: true, fromLayer: "bottom", toLayer: "top" },
      ],
      negativePath: [
        { x: -6, y: 0, via: true, fromLayer: "top", toLayer: "bottom" },
        { x: -12, y: 0, via: true, fromLayer: "bottom", toLayer: "top" },
      ],
      pcbTraceGap: "0.45mm",
      negativeFromLoad: true,
    }),
  })
  for (const x of [-5.5, -0.5]) {
    expect(
      phaseSkewAtX({ segments: reversed.positive_trace.segments, x }),
    ).toBeCloseTo(1.6, 5)
    expect(
      phaseSkewAtX({ segments: reversed.negative_trace.segments, x }),
    ).toBeCloseTo(-1.6, 5)
  }
  expect(Math.max(0, ...phaseSkewEndpoints(reversed.positive_trace))).toBe(1.6)
  expect(Math.min(0, ...phaseSkewEndpoints(reversed.positive_trace))).toBe(0)
  expect(Math.max(0, ...phaseSkewEndpoints(reversed.negative_trace))).toBe(0)
  expect(Math.min(0, ...phaseSkewEndpoints(reversed.negative_trace))).toBe(-1.6)

  // Mirror: DN drops first at x = -6 while routed from load, so DN's layerChangeLengthAfterMm
  // on the reversed first step is what creates the flat step instead of a ramp.
  const [reversedNegativeFirst] = getDifferentialPairPhaseSkew({
    circuitJson: await renderPairBoard({
      positivePath: [
        { x: 12, y: 0, via: true, fromLayer: "top", toLayer: "bottom" },
        { x: 18, y: 0, via: true, fromLayer: "bottom", toLayer: "top" },
      ],
      negativePath: [
        { x: -6, y: 0, via: true, fromLayer: "top", toLayer: "bottom" },
        { x: -18, y: 0, via: true, fromLayer: "bottom", toLayer: "top" },
      ],
      pcbTraceGap: "0.45mm",
      negativeFromLoad: true,
    }),
  })
  for (const x of [-5.5, -0.5]) {
    expect(
      phaseSkewAtX({
        segments: reversedNegativeFirst.negative_trace.segments,
        x,
      }),
    ).toBeCloseTo(1.6, 5)
  }
  expect(
    Math.max(0, ...phaseSkewEndpoints(reversedNegativeFirst.negative_trace)),
  ).toBe(1.6)
  expect(
    Math.min(0, ...phaseSkewEndpoints(reversedNegativeFirst.negative_trace)),
  ).toBe(0)

  await expect(phaseSkewSvg(circuitJson)).toMatchSvgSnapshot(import.meta.path)
})
