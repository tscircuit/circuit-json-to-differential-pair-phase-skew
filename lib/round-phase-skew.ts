/** Phase skew is rounded to 1/this mm (10 nm), to suppress floating-point noise: a factor in reciprocal millimetres. */
const PHASE_SKEW_ROUNDING_FACTOR_PER_MM = 1e5

/** Rounds a phase skew in mm to 1/{@link PHASE_SKEW_ROUNDING_FACTOR_PER_MM} mm, reporting -0 as 0. */
export function roundPhaseSkew(phaseSkew: number): number {
  const rounded =
    Math.round(Math.abs(phaseSkew) * PHASE_SKEW_ROUNDING_FACTOR_PER_MM) /
    PHASE_SKEW_ROUNDING_FACTOR_PER_MM
  if (!Number.isFinite(rounded)) return phaseSkew
  if (rounded === 0) return 0
  return Math.sign(phaseSkew) * rounded
}
