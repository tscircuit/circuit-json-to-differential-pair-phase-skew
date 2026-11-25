import { expect, test } from "bun:test"
import { getDifferentialPairPhaseSkew } from "lib/index"
import { renderPairBoard } from "tests/fixtures/pair-board"
import { phaseSkewSvg } from "tests/fixtures/phase-skew-svg"
import { phaseSkewAtX } from "tests/fixtures/segment-at-x"

test("a long pass in route order wins over a shorter, nearer return pass", async () => {
  // DN runs 0.6 mm below DP from x = -12 to 10, loops around the load, and
  // comes back above DP, 0.5 mm away, from x = -6 to 6.
  const circuitJson = await renderPairBoard({
    positivePath: [],
    negativePath: [
      { x: 22, y: 0 },
      { x: 22, y: -1.7 },
      { x: 26, y: -1.7 },
      { x: 26, y: 3.3 },
      { x: 6, y: 3.3 },
      { x: 6, y: 1.1 },
      { x: 18, y: 1.1 },
      { x: 18, y: 2.3 },
      { x: 25, y: 2.3 },
      { x: 25, y: 0 },
    ],
    pcbTraceGap: "1mm",
  })
  const [pair] = getDifferentialPairPhaseSkew({ circuitJson })

  for (const x of [-9, 0, 8]) {
    expect(phaseSkewAtX({ segments: pair.positive_trace.segments, x })).toBe(0)
  }

  await expect(phaseSkewSvg(circuitJson)).toMatchSvgSnapshot(import.meta.path)
})
