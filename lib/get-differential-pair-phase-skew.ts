import {
  type CircuitJsonUtilObjects,
  cju,
  createBoardOwnerMap,
} from "@tscircuit/circuit-json-util"
import type {
  AnyCircuitElement,
  PcbBoard,
  PcbDifferentialPairPhaseSkew,
  PcbPort,
  PcbTrace,
  SourceBus,
} from "circuit-json"
import { pcb_board } from "circuit-json"
import { clipRouteInsidePads } from "./clip-route-inside-pads"
import { cutRouteTapers } from "./cut-route-tapers"
import { findCoupledRuns } from "./find-coupled-runs"
import { getPhaseSkewSegments } from "./get-phase-skew-segments"
import type { LayerChangeBoard } from "./get-layer-change-length"
import { getPhaseSkewTrack } from "./get-phase-skew-track"
import { haveOppositeTraceWalkDirections } from "./have-opposite-trace-walk-directions"
import { reverseWalk, type TraceWalk, walkTrace } from "./walk-trace"

/** Board thickness in mm assumed for a pair that is routed without a board. */
const STANDARD_BOARD_THICKNESS = 1.6

/** Copper layer count assumed for a pair that is routed without a board. */
const STANDARD_COPPER_LAYER_COUNT = 2

/** The board fields a layer change reads, with circuit-json's own `pcb_board` validation and defaults. */
const BOARD_DIMENSIONS_SCHEMA = pcb_board.pick({
  thickness: true,
  num_layers: true,
})

/** The positive and negative walks of a pair, each oriented from its source end. */
type PairWalks = { positive: TraceWalk; negative: TraceWalk }

/**
 * Computes phase skew along every routed differential pair: at each point,
 * how much farther one trace has run than the other, not only at the ends.
 *
 * Each result is a Circuit JSON element with segments where phase skew is
 * known. A pair is measured when its traces run side by side and each side
 * is routed as exactly one `pcb_trace`;
 * a side routed as several doesn't record their order along the signal.
 *
 * Distances are copper length: planar length plus each layer change's
 * Z-distance through the board's stackup, with routing inside the start
 * and end pads and inside vias' pads measured straight from the pad centre
 * to the pad edge, as KiCad does. A pair is skipped, without affecting the others, when either
 * trace has no planar copper, has copper that isn't continuous or has no
 * finite length, or its board's dimensions fail the `pcb_board` schema.
 *
 * Each trace with exactly one end
 * port marked `is_output` is walked from that end; if only one trace has
 * such a port, the other is oriented to match it by end distance; if neither
 * does, distances are measured from the positive trace's first route point
 * and the negative trace is walked from the end that matches it.
 */
export function getDifferentialPairPhaseSkew({
  circuitJson,
}: {
  circuitJson: AnyCircuitElement[]
}): PcbDifferentialPairPhaseSkew[] {
  const db = cju(circuitJson)
  const boardOwnerMap = createBoardOwnerMap(circuitJson)
  const pairs: PcbDifferentialPairPhaseSkew[] = []
  for (const bus of db.source_bus.list()) {
    const differentialPair = bus.differential_pair
    if (differentialPair === undefined || !bus.source_bus_id.trim()) continue
    const { positive_source_trace_id, negative_source_trace_id } =
      differentialPair
    if (positive_source_trace_id === negative_source_trace_id) continue
    const positiveTraces = db.pcb_trace.list({
      source_trace_id: positive_source_trace_id,
    })
    const negativeTraces = db.pcb_trace.list({
      source_trace_id: negative_source_trace_id,
    })
    if (positiveTraces.length !== 1 || negativeTraces.length !== 1) continue
    const [positiveTrace] = positiveTraces
    const [negativeTrace] = negativeTraces
    if (!positiveTrace || !negativeTrace) continue
    const positiveTraceId = positiveTrace.pcb_trace_id.trim()
    const negativeTraceId = negativeTrace.pcb_trace_id.trim()
    if (
      !positiveTraceId ||
      !negativeTraceId ||
      positiveTraceId === negativeTraceId
    )
      continue
    const pairWalks = walkPair({
      positiveTrace,
      negativeTrace,
      db,
      board: boardOwnerMap.get(positiveTrace.pcb_trace_id),
    })
    if (pairWalks === null) continue
    const pair = getPairPhaseSkew({
      bus,
      trace_gap: differentialPair.trace_gap,
      positiveTrace,
      negativeTrace,
      pairWalks,
    })
    if (pair !== null) pairs.push(pair)
  }
  return pairs
}

/** Phase skew for one differential pair routed as one pcb_trace per side. */
function getPairPhaseSkew({
  bus,
  trace_gap,
  positiveTrace,
  negativeTrace,
  pairWalks,
}: {
  bus: SourceBus
  /** The pair's declared edge-to-edge gap in mm, if any. */
  trace_gap: number | undefined
  positiveTrace: PcbTrace
  negativeTrace: PcbTrace
  pairWalks: PairWalks
}): PcbDifferentialPairPhaseSkew | null {
  const { positive, negative } = pairWalks
  const runs = findCoupledRuns({
    positive: positive.steps,
    negative: negative.steps,
    referenceGapMm: trace_gap,
  })
  if (runs.length === 0) return null
  const positiveSegments = getPhaseSkewSegments({
    steps: positive.steps,
    spans: getPhaseSkewTrack({
      runs,
      side: "positive",
      steps: positive.steps,
      partnerSteps: negative.steps,
    }),
  })
  const negativeSegments = getPhaseSkewSegments({
    steps: negative.steps,
    spans: getPhaseSkewTrack({
      runs,
      side: "negative",
      steps: negative.steps,
      partnerSteps: positive.steps,
    }),
  })
  if (positiveSegments.length === 0 || negativeSegments.length === 0) {
    return null
  }
  const pair: PcbDifferentialPairPhaseSkew = {
    type: "pcb_differential_pair_phase_skew",
    pcb_differential_pair_phase_skew_id: `pcb_differential_pair_phase_skew_${bus.source_bus_id}`,
    source_bus_id: bus.source_bus_id,
    positive_trace: {
      pcb_trace_id: positiveTrace.pcb_trace_id,
      segments: positiveSegments,
    },
    negative_trace: {
      pcb_trace_id: negativeTrace.pcb_trace_id,
      segments: negativeSegments,
    },
  }
  if (bus.subcircuit_id !== undefined) pair.subcircuit_id = bus.subcircuit_id
  return pair
}

/**
 * Walks both traces of a pair through their board's stackup, or its
 * thickness without one, and orients each walk from its source end. Null
 * when either trace can't be walked, so the pair is skipped.
 */
function walkPair({
  positiveTrace,
  negativeTrace,
  db,
  board,
}: {
  positiveTrace: PcbTrace
  negativeTrace: PcbTrace
  db: CircuitJsonUtilObjects
  board: PcbBoard | undefined
}): PairWalks | null {
  const layerChangeBoard = getLayerChangeBoard({ db, board })
  if (layerChangeBoard === null) return null
  const positiveWalk = walkTrace({
    route: clipRouteInsidePads({
      route: cutRouteTapers({ route: positiveTrace.route }),
      db,
      pcbTraceId: positiveTrace.pcb_trace_id,
    }),
    ...layerChangeBoard,
  })
  const negativeWalk = walkTrace({
    route: clipRouteInsidePads({
      route: cutRouteTapers({ route: negativeTrace.route }),
      db,
      pcbTraceId: negativeTrace.pcb_trace_id,
    }),
    ...layerChangeBoard,
  })
  if (positiveWalk === null || negativeWalk === null) return null
  let positive = positiveWalk
  let negative = negativeWalk
  const positiveOutput = outputEnd({ trace: positiveTrace, db })
  const negativeOutput = outputEnd({ trace: negativeTrace, db })
  if (positiveOutput === "end") positive = reverseWalk(positive)
  if (negativeOutput === "end") negative = reverseWalk(negative)
  if (positiveOutput !== null && negativeOutput !== null) {
    return { positive, negative }
  }
  if (
    !haveOppositeTraceWalkDirections({
      positiveSteps: positive.steps,
      negativeSteps: negative.steps,
    })
  ) {
    return { positive, negative }
  }
  if (negativeOutput !== null) {
    return { positive: reverseWalk(positive), negative }
  }
  return { positive, negative: reverseWalk(negative) }
}

/**
 * The board's stackup, thickness and copper layer count, or a standard
 * 2-layer board's without a board. Thickness and layer count are read
 * through circuit-json's `pcb_board` schema, so a record that omits them,
 * such as unparsed or older Circuit JSON, gets the schema's defaults. Null
 * when the record's values fail the schema.
 */
function getLayerChangeBoard({
  db,
  board,
}: {
  db: CircuitJsonUtilObjects
  board: PcbBoard | undefined
}): LayerChangeBoard | null {
  if (board === undefined) {
    return {
      pcbStackup: null,
      boardThickness: STANDARD_BOARD_THICKNESS,
      copperLayerCount: STANDARD_COPPER_LAYER_COUNT,
    }
  }
  const boardDimensions = BOARD_DIMENSIONS_SCHEMA.safeParse(board)
  if (!boardDimensions.success) return null
  return {
    pcbStackup: db.pcb_stackup.getWhere({ pcb_board_id: board.pcb_board_id }),
    boardThickness: boardDimensions.data.thickness,
    copperLayerCount: boardDimensions.data.num_layers,
  }
}

/**
 * Which end of `trace` is connected to an output port (`source_port.is_output`),
 * or null unless exactly one end port is an output.
 */
function outputEnd({
  trace,
  db,
}: {
  trace: PcbTrace
  db: CircuitJsonUtilObjects
}): "start" | "end" | null {
  let startPcbPortId: PcbPort["pcb_port_id"] | undefined
  let endPcbPortId: PcbPort["pcb_port_id"] | undefined
  for (const point of trace.route) {
    if (point.route_type !== "wire") continue
    if (startPcbPortId === undefined) startPcbPortId = point.start_pcb_port_id
    if (point.end_pcb_port_id !== undefined) {
      endPcbPortId = point.end_pcb_port_id
    }
  }
  const startIsOutput = isOutputPort({ db, pcbPortId: startPcbPortId })
  const endIsOutput = isOutputPort({ db, pcbPortId: endPcbPortId })
  if (startIsOutput === endIsOutput) return null
  if (startIsOutput) return "start"
  return "end"
}

/** True when a PCB port's source port is marked `is_output`. */
function isOutputPort({
  db,
  pcbPortId,
}: {
  db: CircuitJsonUtilObjects
  pcbPortId: PcbPort["pcb_port_id"] | undefined
}): boolean {
  if (pcbPortId === undefined) return false
  const pcbPort = db.pcb_port.get(pcbPortId)
  if (pcbPort === null) return false
  return db.source_port.get(pcbPort.source_port_id)?.is_output === true
}
