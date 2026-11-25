import { expect, test } from "bun:test"
import { getDifferentialPairPhaseSkew } from "lib/index"
import { renderPairBoard } from "tests/fixtures/pair-board"
import {
  maximumAbsolutePhaseSkew,
  phaseSkewEndpoints,
} from "tests/fixtures/phase-skew-endpoints"
import { phaseSkewSvg } from "tests/fixtures/phase-skew-svg"
import { phaseSkewAtX } from "tests/fixtures/segment-at-x"

test("a detour right after aligned vias does not double-count the partner's single via", async () => {
  // Both traces run together on top to x = 0 and drop through symmetric 1.6 mm
  // vias to bottom. DN immediately continues coupled along [0, 6] on bottom
  // (no copper gap between its two coupled runs, only the single via at x = 0).
  // DP takes a 4 mm (1 x 1 mm) loop on bottom at x = 0 before rejoining DN.
  // DN's single via was already balanced by DP's via at the end of the top run,
  // so DP's skew ramps from 0 to 4.0 mm across the loop — never 5.6 mm.
  const circuitJson = await renderPairBoard({
    positivePath: [
      { x: 12, y: 0, via: true, fromLayer: "top", toLayer: "bottom" },
      { x: 11, y: 0 },
      { x: 11, y: 1 },
      { x: 12, y: 1 },
      { x: 12, y: 0 },
      { x: 18, y: 0, via: true, fromLayer: "bottom", toLayer: "top" },
    ],
    negativePath: [
      { x: 12, y: 0, via: true, fromLayer: "top", toLayer: "bottom" },
      { x: 18, y: 0, via: true, fromLayer: "bottom", toLayer: "top" },
    ],
    pcbTraceGap: "0.45mm",
  })

  const [pair] = getDifferentialPairPhaseSkew({ circuitJson })

  expect(phaseSkewAtX({ segments: pair.positive_trace.segments, x: -6 })).toBe(
    0,
  )
  expect(
    phaseSkewAtX({ segments: pair.positive_trace.segments, x: 3 }),
  ).toBeCloseTo(4, 5)
  expect(
    phaseSkewAtX({ segments: pair.negative_trace.segments, x: 3 }),
  ).toBeCloseTo(-4, 5)

  // At x = -0.5, y = 1.3 (2.5 mm along the 4 mm loop), skew is 2.5 mm (not 3.5 mm).

  expect(
    phaseSkewAtX({
      segments: pair.positive_trace.segments,
      x: -0.5,
      y: 1.3,
    }),
  ).toBeCloseTo(2.5, 2)

  expect(Math.max(0, ...phaseSkewEndpoints(pair.positive_trace))).toBe(4)
  expect(Math.min(0, ...phaseSkewEndpoints(pair.positive_trace))).toBe(0)
  expect(maximumAbsolutePhaseSkew(pair)).toBeCloseTo(4, 5)

  await expect(phaseSkewSvg(circuitJson)).toMatchSvgSnapshot(import.meta.path)
})
