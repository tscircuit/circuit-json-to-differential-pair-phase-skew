import type { PhaseSkewSpan, SideRun } from "./get-phase-skew-track"
import { roundPhaseSkew } from "./round-phase-skew"
import { MIN_OVERLAP } from "./select-coupled-runs"

/** Half of KiCad’s default 0.05 mm overlay sample interval. */
const JOINT_BLEND_HALF_LENGTH_MM = 0.025

/**
 * Replaces coincident copper anchors with a short interpolation from the
 * previous partner distance to the next. Via lengths still step at the via.
 */
export function blendTouchingRuns({
  previous,
  next,
}: {
  previous: SideRun
  next: SideRun
}): PhaseSkewSpan | null {
  if (
    Math.abs(next.startWalkDistanceMm - previous.endWalkDistanceMm) >
      MIN_OVERLAP ||
    previous.layerChangeLengthAfterMm > 0 ||
    next.layerChangeLengthBeforeMm > 0 ||
    previous.partnerLayerChangeLengthAfterMm > 0 ||
    next.partnerLayerChangeLengthBeforeMm > 0 ||
    roundPhaseSkew(previous.endPhaseSkewMm) ===
      roundPhaseSkew(next.startPhaseSkewMm)
  ) {
    return null
  }

  const previousLengthMm =
    previous.endWalkDistanceMm - previous.startWalkDistanceMm
  const nextLengthMm = next.endWalkDistanceMm - next.startWalkDistanceMm
  // Keep the middle of each coupled run even if both its ends need blending.
  const halfLengthMm = Math.min(
    JOINT_BLEND_HALF_LENGTH_MM,
    previousLengthMm / 4,
    nextLengthMm / 4,
  )
  if (halfLengthMm <= MIN_OVERLAP) {
    // With no room for an emitted ramp, share one partner distance at the joint.
    const jointPhaseSkewMm =
      (previous.endPhaseSkewMm + next.startPhaseSkewMm) / 2
    return {
      startWalkDistanceMm: previous.endWalkDistanceMm,
      endWalkDistanceMm: next.startWalkDistanceMm,
      startPhaseSkewMm: jointPhaseSkewMm,
      endPhaseSkewMm: jointPhaseSkewMm,
    }
  }

  return {
    startWalkDistanceMm: previous.endWalkDistanceMm - halfLengthMm,
    endWalkDistanceMm: next.startWalkDistanceMm + halfLengthMm,
    startPhaseSkewMm:
      previous.endPhaseSkewMm +
      (previous.startPhaseSkewMm - previous.endPhaseSkewMm) *
        (halfLengthMm / previousLengthMm),
    endPhaseSkewMm:
      next.startPhaseSkewMm +
      (next.endPhaseSkewMm - next.startPhaseSkewMm) *
        (halfLengthMm / nextLengthMm),
  }
}
