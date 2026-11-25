import "bun-match-svg"
import { cju } from "@tscircuit/circuit-json-util"
import {
  type AnyCircuitElement,
  type PcbDifferentialPairPhaseSkewSegment,
  type PcbTraceRoutePoint,
  type Point,
  pcb_differential_pair_phase_skew,
} from "circuit-json"
import { getDifferentialPairPhaseSkew } from "lib/index"
import {
  maximumAbsolutePhaseSkew,
  phaseSkewEndpoints,
} from "./phase-skew-endpoints"

/** Overlay stroke width relative to the trace, matching KiCad's 1.1× inflation. */
const OVERLAY_WIDTH_FACTOR = 1.1

/** SVG pixels per mm. */
const PIXELS_PER_MM = 40

/**
 * Draws the routed copper with each pair's phase skew on top, coloured as
 * KiCad does: white in step, blending to blue where a trace is ahead of its
 * partner and red where it is behind, scaled per trace and sign. Copper
 * without a phase skew segment keeps its original colour.
 */
export function phaseSkewSvg(circuitJson: AnyCircuitElement[]): string {
  const db = cju(circuitJson)
  const differentialPairPhaseSkews = getDifferentialPairPhaseSkew({
    circuitJson,
  }).map((pair) => pcb_differential_pair_phase_skew.parse(pair))
  const traces = db.pcb_trace.list()
  const points = traces.flatMap((trace) =>
    trace.route.flatMap((routePoint) => routePointPositions(routePoint)),
  )
  const minX = Math.min(...points.map(({ x }) => x)) - 1
  const maxX = Math.max(...points.map(({ x }) => x)) + 1
  const minY = Math.min(...points.map(({ y }) => y)) - 1
  const maxY = Math.max(...points.map(({ y }) => y)) + 1
  const width = maxX - minX
  const height = maxY - minY
  const copper = traces.flatMap((trace) =>
    trace.route.flatMap((point, index) => {
      const from = trace.route[index - 1]
      if (
        point.route_type !== "wire" ||
        from?.route_type !== "wire" ||
        from.layer !== point.layer
      ) {
        return []
      }
      return [
        `<line x1="${from.x}" y1="${from.y}" x2="${point.x}" y2="${point.y}" stroke="#8d6448" stroke-width="${point.width}"/>`,
      ]
    }),
  )
  const vias = db.pcb_via
    .list()
    .map(
      (via) =>
        `<circle cx="${via.x}" cy="${via.y}" r="${via.outer_diameter / 2}" fill="none" stroke="#ead9bd" stroke-width="0.07"/>`,
    )
  const phaseSkewTraces = differentialPairPhaseSkews.flatMap((pair) => [
    pair.positive_trace,
    pair.negative_trace,
  ])
  const overlay = phaseSkewTraces.flatMap((trace, traceIndex) => {
    const endpoints = phaseSkewEndpoints(trace)
    const max = Math.max(0, ...endpoints)
    const min = Math.min(0, ...endpoints)
    return trace.segments.map((segment, segmentIndex) =>
      phaseSkewLine({
        segment,
        max,
        min,
        id: `phase-skew-${traceIndex}-${segmentIndex}`,
      }),
    )
  })
  const formattedPeakPhaseSkewsMm = differentialPairPhaseSkews
    .map((pair) => maximumAbsolutePhaseSkew(pair).toFixed(5))
    .join(", ")
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(width * PIXELS_PER_MM)}" height="${Math.ceil(height * PIXELS_PER_MM)}" viewBox="${minX} ${-maxY} ${width} ${height}">
  <rect x="${minX}" y="${-maxY}" width="${width}" height="${height}" fill="#182124"/>
  <g transform="scale(1 -1)">
    ${[...copper, ...overlay, ...vias].join("\n    ")}
  </g>
  <text x="${minX + 0.3}" y="${-maxY + 0.48}" font-family="sans-serif" font-size="0.32" fill="#fff">Peak phase skew magnitude (mm): ${formattedPeakPhaseSkewsMm || "no measurable pairs"}. Blue: ahead. Red: behind. White: in step. Copper: unknown.</text>
</svg>`
}

/** The points a route point passes through: one, or both ends of a through pad. */
function routePointPositions(routePoint: PcbTraceRoutePoint): Point[] {
  if (routePoint.route_type === "through_pad") {
    return [routePoint.start, routePoint.end]
  }
  return [{ x: routePoint.x, y: routePoint.y }]
}

/** One overlay stroke with an SVG gradient between its endpoint colours. */
function phaseSkewLine({
  segment,
  max,
  min,
  id,
}: {
  segment: PcbDifferentialPairPhaseSkewSegment
  max: number
  min: number
  id: string
}): string {
  const {
    start,
    end,
    width,
    start_length_difference_mm,
    end_length_difference_mm,
  } = segment
  const line = `x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}"`
  const startColor = phaseSkewColor({
    lengthDifferenceMm: start_length_difference_mm,
    max,
    min,
  })
  const endColor = phaseSkewColor({
    lengthDifferenceMm: end_length_difference_mm,
    max,
    min,
  })
  if (startColor === endColor) {
    return `<line ${line} stroke-width="${width * OVERLAY_WIDTH_FACTOR}" stroke="${startColor}"/>`
  }
  return `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" ${line}><stop offset="0" stop-color="${startColor}"/><stop offset="1" stop-color="${endColor}"/></linearGradient><line ${line} stroke-width="${width * OVERLAY_WIDTH_FACTOR}" stroke="url(#${id})"/>`
}

/** Colour of a signed length difference relative to the trace's extrema. */
function phaseSkewColor({
  lengthDifferenceMm,
  max,
  min,
}: {
  lengthDifferenceMm: number
  max: number
  min: number
}): string {
  if (lengthDifferenceMm === 0) return "white"
  let color = [0, 0, 255]
  let fraction = lengthDifferenceMm / max
  if (lengthDifferenceMm < 0) {
    color = [255, 0, 0]
    fraction = lengthDifferenceMm / min
  }
  return `rgb(${color.map((channel) => Math.round(255 + (channel - 255) * fraction)).join(",")})`
}
