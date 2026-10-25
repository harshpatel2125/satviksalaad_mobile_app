import type { Plan } from '@/types/api';

const perUnit = (plan: Plan) => plan.price_paise / plan.bowls_count;

/**
 * "Save ₹600 vs Weekly Salad": what `plan` saves over buying as many items through the dearest
 * smaller plan of the same kind (same category and style), or null when it saves nothing.
 */
export function planSavingsText(plan: Plan, plans: readonly Plan[]): string | null {
  if (plan.is_trial || plan.bowls_count <= 0) return null;
  const smaller = plans.filter(
    (other) =>
      other.id !== plan.id &&
      !other.is_trial &&
      other.category === plan.category &&
      Boolean(other.style_choice) === Boolean(plan.style_choice) &&
      other.bowls_count > 0 &&
      other.bowls_count < plan.bowls_count,
  );
  if (smaller.length === 0) return null;
  const dearest = smaller.reduce((a, b) => (perUnit(b) > perUnit(a) ? b : a));
  const rupees = Math.round(((perUnit(dearest) - perUnit(plan)) * plan.bowls_count) / 100);
  return rupees >= 1 ? `Save ₹${rupees.toLocaleString('en-IN')} vs ${dearest.name}` : null;
}
