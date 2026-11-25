import { expect, test } from "bun:test"
import { getDifferentialPairPhaseSkew } from "lib/index"
import { renderPairBoard } from "tests/fixtures/pair-board"
import { maximumAbsolutePhaseSkew } from "tests/fixtures/phase-skew-endpoints"
import { phaseSkewSvg } from "tests/fixtures/phase-skew-svg"
import { phaseSkewAtX } from "tests/fixtures/segment-at-x"

/** Extra length added by each 0.9 mm square detour on the fan-in/fan-out. */
const FANOUT_DETOUR_EXTRA = 2 * 0.9

test("parallel stretches leaving wider source and load pads couple at each end's own pad separation", async () => {
  // Source pads are 3.0 mm apart (y = ±1.5), load pads 1.2 mm apart (y = ±0.6),
  // both wider than the 0.45 mm trace gap's 0.72 mm coupling limit. Using the
  // load separation at the source (1.2 * 1.2 = 1.44 < 3.0) would uncouple the
  // start fan-in; using the source separation at the load (3.0 * 1.2 = 3.6)
  // would wrongly couple DN's flat detour top at 2.1 mm separation (x = 8.75).
  const circuitJson = await renderPairBoard({
    sourcePadHalfPitch: 1.5,
    loadPadHalfPitch: 0.6,
    positivePath: [
      { x: 3, y: 0 },
      { x: 3, y: 0.9 },
      { x: 3.5, y: 0.9 },
      { x: 3.5, y: 0 },
      { x: 4, y: 0 },
      { x: 6, y: -1.2 },
      { x: 18, y: -1.2 },
      { x: 20, y: -0.9 },
    ],
    negativePath: [
      { x: 4, y: 0 },
      { x: 6, y: 1.2 },
      { x: 18, y: 1.2 },
      { x: 20, y: 0.9 },
      { x: 20.5, y: 0.9 },
      { x: 20.5, y: 0 },
      { x: 21, y: 0 },
      { x: 21, y: 0.9 },
    ],
    pcbTraceGap: "0.45mm",
  })

  const [pair] = getDifferentialPairPhaseSkew({ circuitJson })

  expect(
    phaseSkewAtX({
      segments: pair.positive_trace.segments,
      x: -10.5,
    }),
  ).toBe(0)
  expect(
    phaseSkewAtX({ segments: pair.positive_trace.segments, x: 0 }),
  ).toBeCloseTo(FANOUT_DETOUR_EXTRA, 5)
  // Uncoupled, DN's detour ramps in instead of being measured right away.
  expect(
    phaseSkewAtX({
      segments: pair.positive_trace.segments,
      x: 8.75,
    }),
  ).toBeGreaterThan(0)
  expect(
    phaseSkewAtX({
      segments: pair.positive_trace.segments,
      x: 8.75,
    }),
  ).toBeLessThan(FANOUT_DETOUR_EXTRA)
  expect(
    phaseSkewAtX({
      segments: pair.positive_trace.segments,
      x: 10.5,
    }),
  ).toBe(0)
  expect(maximumAbsolutePhaseSkew(pair)).toBeCloseTo(FANOUT_DETOUR_EXTRA, 5)

  await expect(phaseSkewSvg(circuitJson)).toMatchSvgSnapshot(import.meta.path)
})
