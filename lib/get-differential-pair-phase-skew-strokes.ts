import type { AnyCircuitElement, LayerRef, PcbTrace, Point } from "circuit-json"
import {
  DEFAULT_PHASE_SKEW_COLORS,
  type PhaseSkewColors,
} from "./default-phase-skew-colors"
import type { PhaseSkewTrace } from "./differential-pair-phase-skew"
import { getDifferentialPairPhaseSkew } from "./get-differential-pair-phase-skew"

/** One opaque overlay stroke, in PCB coordinates and width in mm. */
export type PhaseSkewStroke = {
  /** The trace this stroke covers, so renderers can apply their own visibility filters. */
  pcb_trace_id: PcbTrace["pcb_trace_id"]
  layer: LayerRef
  start: Point
  end: Point
  width: number
  color: string
}

/** Colour channels from 0 to 255, in red, green and blue order. */
type RgbColor = [red: number, green: number, blue: number]

/** One RGB colour for each phase skew state. */
type PhaseSkewPalette = Record<keyof PhaseSkewColors, RgbColor>

/** KiCad widens the overlay so it fully covers the trace. */
const OVERLAY_WIDTH_FACTOR = 1.1

/**
 * Returns coloured strokes for each measured pair's traces. Each trace
 * blends from the zero colour toward the colour for the sign of its phase
 * skew, scaled to that trace's peak for the same sign.
 *
 * Overrides accept #RGB, #RRGGBB and comma-separated numeric rgb(). Invalid
 * overrides warn and use the default for that colour. Strokes use opaque
 * rgb() strings and are ready to draw with round caps.
 */
export function getDifferentialPairPhaseSkewStrokes(
  circuitJson: AnyCircuitElement[],
  { colors }: { colors?: Partial<PhaseSkewColors> } = {},
): PhaseSkewStroke[] {
  const palette: PhaseSkewPalette = {
    positive: getPaletteColor({ colors, key: "positive" }),
    negative: getPaletteColor({ colors, key: "negative" }),
    zero: getPaletteColor({ colors, key: "zero" }),
    unknown: getPaletteColor({ colors, key: "unknown" }),
  }

  return getDifferentialPairPhaseSkew({ circuitJson })
    .flatMap((pair) => [pair.positive_trace, pair.negative_trace])
    .flatMap((trace) =>
      trace.segments.map(({ layer, start, end, width, phase_skew }) => ({
        pcb_trace_id: trace.pcb_trace_id,
        layer,
        start,
        end,
        width: width * OVERLAY_WIDTH_FACTOR,
        color: getStrokeColor({ phase_skew, trace, palette }),
      })),
    )
}

/** Blends a segment's colour using its trace's phase skew range. */
function getStrokeColor({
  phase_skew,
  trace,
  palette,
}: {
  phase_skew: number | undefined
  trace: PhaseSkewTrace
  palette: PhaseSkewPalette
}): string {
  if (phase_skew === undefined) return formatRgb(palette.unknown)
  if (phase_skew === 0) return formatRgb(palette.zero)

  let peakColor = palette.positive
  let peakPhaseSkew = trace.max_phase_skew
  if (phase_skew < 0) {
    peakColor = palette.negative
    peakPhaseSkew = trace.min_phase_skew
  }
  const fraction = phase_skew / peakPhaseSkew
  return formatRgb(
    ([0, 1, 2] as const).map((index) => {
      const channel = palette.zero[index]
      return channel + (peakColor[index] - channel) * fraction
    }),
  )
}

/** Formats RGB channels as an opaque CSS colour. */
function formatRgb(channels: number[]): string {
  return `rgb(${channels.map(Math.round).join(", ")})`
}

/** Parses a palette override or uses the built-in colour for that state. */
function getPaletteColor({
  colors,
  key,
}: {
  colors?: Partial<PhaseSkewColors>
  key: keyof PhaseSkewColors
}): RgbColor {
  const cssColor = colors?.[key]
  const defaultCssColor = DEFAULT_PHASE_SKEW_COLORS[key]
  if (cssColor !== undefined) {
    const rgb = parseRgb(cssColor)
    if (rgb !== null) return rgb
    console.warn(
      `Invalid phase skew colour '${cssColor}', using '${defaultCssColor}'`,
    )
  }
  return parseRgb(defaultCssColor)!
}

/** Parses numeric rgb() and short or long hex colours. */
function parseRgb(cssColor: string): RgbColor | null {
  const rgb = cssColor.trim().toLowerCase()
  if (rgb.startsWith("#")) {
    let hex = rgb.slice(1)
    if (hex.length !== 3 && hex.length !== 6) return null
    if (Array.from(hex).some((digit) => !"0123456789abcdef".includes(digit))) {
      return null
    }
    if (hex.length === 3) {
      hex = Array.from(hex, (digit) => digit + digit).join("")
    }
    return [
      Number.parseInt(hex.slice(0, 2), 16),
      Number.parseInt(hex.slice(2, 4), 16),
      Number.parseInt(hex.slice(4, 6), 16),
    ]
  }

  if (!rgb.startsWith("rgb(") || !rgb.endsWith(")")) return null
  const channels = rgb.slice(4, -1).split(",")
  if (channels.length !== 3) return null
  const [red, green, blue] = channels.map(parseRgbChannel)
  if (
    typeof red !== "number" ||
    typeof green !== "number" ||
    typeof blue !== "number"
  ) {
    return null
  }
  return [red, green, blue]
}

/** Parses a numeric RGB channel and clamps it to the CSS range. */
function parseRgbChannel(channel: string): number | null {
  const digits = channel.trim()
  if (
    digits.length === 0 ||
    digits.endsWith(".") ||
    digits.includes(".e") ||
    Array.from(digits).some((digit) => !"0123456789+-.e".includes(digit))
  ) {
    return null
  }
  const intensity = Number(digits)
  if (!Number.isFinite(intensity)) return null
  return Math.max(0, Math.min(255, intensity))
}
