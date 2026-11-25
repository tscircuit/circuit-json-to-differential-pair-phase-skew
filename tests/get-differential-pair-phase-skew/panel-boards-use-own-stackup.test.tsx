import { expect, test } from "bun:test"
import { cju } from "@tscircuit/circuit-json-util"
import type { AnyCircuitElement } from "circuit-json"
import { getDifferentialPairPhaseSkew } from "lib/index"
import {
  PairBoard,
  type PairPathPoint,
  renderPairBoard,
} from "tests/fixtures/pair-board"
import { maximumAbsolutePhaseSkew } from "tests/fixtures/phase-skew-endpoints"
import { phaseSkewSvg } from "tests/fixtures/phase-skew-svg"
import { renderCircuit } from "tests/fixtures/render-circuit"

const VIA_HOP: PairPathPoint[] = [
  { x: 6, y: 0, via: true, fromLayer: "top", toLayer: "bottom" },
  { x: 18, y: 0, via: true, fromLayer: "bottom", toLayer: "top" },
]

/** Renders a two-board panel: one 1.6 mm JLCPCB preset board and one plain 0.8 mm board. */
function renderPanel({
  stackupFirst,
  subcircuitName,
}: {
  stackupFirst: boolean
  subcircuitName?: string
}): Promise<AnyCircuitElement[]> {
  const stackupBoard = (
    <PairBoard
      pairName="STACKUP"
      positivePath={[]}
      negativePath={VIA_HOP}
      pcbTraceGap="0.45mm"
      thickness="1.6mm"
      fabricatorPreset="jlcpcb_standard"
    />
  )
  const plainBoard = (
    <PairBoard
      pairName="PLAIN"
      subcircuitName={subcircuitName}
      positivePath={[]}
      negativePath={VIA_HOP}
      pcbTraceGap="0.45mm"
      thickness="0.8mm"
    />
  )
  let boards = [stackupBoard, plainBoard]
  if (!stackupFirst) boards = [plainBoard, stackupBoard]
  return renderCircuit(
    <panel width="100mm" height="50mm" layoutMode="grid">
      {boards[0]}
      {boards[1]}
    </panel>,
  )
}

test("each board in a panel uses only its own stackup or thickness, never a neighbour's", async () => {
  // JLCPCB 2-layer 1.6 mm stackup: 0.03 + 1.43 + 0.03 = 1.49 mm per via -> 2.98 mm.
  // Plain 0.8 mm board with no stackup: 0.80 mm per via -> 1.60 mm.
  const stackupFirstJson = await renderPanel({ stackupFirst: true })
  const plainFirstJson = await renderPanel({ stackupFirst: false })

  for (const circuitJson of [
    stackupFirstJson,
    plainFirstJson,
    await renderPanel({ stackupFirst: true, subcircuitName: "G" }),
  ]) {
    const pairs = getDifferentialPairPhaseSkew({ circuitJson })
    const db = cju(circuitJson)
    const stackupBus = db.source_bus.getWhere({ name: "STACKUP" })
    const plainBus = db.source_bus.getWhere({ name: "PLAIN" })
    const stackupPair = pairs.find(
      (pair) => pair.source_bus_id === stackupBus?.source_bus_id,
    )
    const plainPair = pairs.find(
      (pair) => pair.source_bus_id === plainBus?.source_bus_id,
    )
    expect(stackupPair && maximumAbsolutePhaseSkew(stackupPair)).toBeCloseTo(
      2.98,
      5,
    )
    expect(plainPair && maximumAbsolutePhaseSkew(plainPair)).toBeCloseTo(1.6, 5)
  }

  const nestedPairJson = await renderPairBoard({
    subcircuitName: "G",
    positivePath: [],
    negativePath: VIA_HOP,
    pcbTraceGap: "0.45mm",
    thickness: "0.8mm",
  })
  expect(
    getDifferentialPairPhaseSkew({ circuitJson: nestedPairJson })[0] &&
      maximumAbsolutePhaseSkew(
        getDifferentialPairPhaseSkew({ circuitJson: nestedPairJson })[0],
      ),
  ).toBeCloseTo(1.6, 5)

  await expect(phaseSkewSvg(stackupFirstJson)).toMatchSvgSnapshot(
    import.meta.path,
  )
})
