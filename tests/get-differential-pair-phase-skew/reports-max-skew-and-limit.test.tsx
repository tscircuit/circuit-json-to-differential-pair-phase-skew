import { expect, test } from "bun:test"
import { cju } from "@tscircuit/circuit-json-util"
import { getDifferentialPairPhaseSkew } from "lib/index"
import {
  DETOUR_EXTRA_LENGTH,
  renderDifferentialPairBoard,
} from "tests/fixtures/differential-pair-board"
import { maximumAbsolutePhaseSkew } from "tests/fixtures/phase-skew-endpoints"
import { phaseSkewSvg } from "tests/fixtures/phase-skew-svg"

test("reports the pair's largest phase skew and its maxLengthSkew", async () => {
  const circuitJson = await renderDifferentialPairBoard({ compensated: true })
  const pairs = getDifferentialPairPhaseSkew({ circuitJson })

  expect(pairs).toHaveLength(1)
  const [bus] = cju(circuitJson).source_bus.list()
  expect(pairs[0].source_bus_id).toBe(bus.source_bus_id)
  expect(maximumAbsolutePhaseSkew(pairs[0])).toBeCloseTo(DETOUR_EXTRA_LENGTH, 5)
  expect(bus.max_length_skew).toBe(0.1)

  await expect(phaseSkewSvg(circuitJson)).toMatchSvgSnapshot(import.meta.path)
})
