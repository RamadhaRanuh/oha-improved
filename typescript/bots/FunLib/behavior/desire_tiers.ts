/**
 * Desire tiers (docs/specs/smarter-bot-behaviour.md section 3.2).
 *
 * New behaviour code returns one of these values, or interpolates between two adjacent tiers
 * with RemapValClamped. Nothing new returns more than 1.
 */
export const DesireTier = {
    /** About to die, standing in a lethal zone. */
    SURVIVE: 0.96,
    /** Team committed to a fight, defending high ground or the ancient. */
    FORCED: 0.9,
    /** Joining an engagement, assigned group push or defence, laning last hit or deny due now. */
    HIGH: 0.75,
    /** Laning baseline, farming, gank approach. */
    MODERATE: 0.5,
    /** Fill-in activity. */
    LOW: 0.25,
    NONE: 0,
} as const;
