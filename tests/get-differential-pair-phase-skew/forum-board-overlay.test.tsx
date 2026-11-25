import { expect, test } from "bun:test"
import { ForumExampleBoard } from "tests/fixtures/forum-example-board"
import { phaseSkewSvg } from "tests/fixtures/phase-skew-svg"
import { renderCircuit } from "tests/fixtures/render-circuit"

test("renders phase skew on the forum board", async () => {
  const circuitJson = await renderCircuit(<ForumExampleBoard />)
  await expect(phaseSkewSvg(circuitJson)).toMatchSvgSnapshot(import.meta.path)
})
