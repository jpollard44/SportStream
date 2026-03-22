/**
 * PremiumGate — wraps features that will eventually be gated behind a paid plan.
 *
 * Currently a passthrough: all children render freely.
 * To enable gating for a specific feature, add a case in the switch below and
 * check isPremium(userDoc) from usePlan().
 *
 * Usage:
 *   <PremiumGate feature="stats">
 *     <StatsTable ... />
 *   </PremiumGate>
 */
export default function PremiumGate({ children }) {
  // Passthrough — gates can be activated per-feature without touching every page
  return children
}
