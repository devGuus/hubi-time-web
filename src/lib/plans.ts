/**
 * Planos de assinatura. Precos fixos no codigo por enquanto - vira tabela no
 * banco quando precisarmos mudar preco sem redeploy (nao antes disso).
 */
import { Decimal } from "decimal.js";

export type PlanId = "free" | "monthly" | "semestral" | "annual";
export type PaidPlanId = Exclude<PlanId, "free">;

export interface PlanDefinition {
  id: PaidPlanId;
  label: string;
  price: Decimal;
  periodMonths: number;
}

export const PAID_PLANS: Record<PaidPlanId, PlanDefinition> = {
  monthly: { id: "monthly", label: "Mensal", price: new Decimal("14.90"), periodMonths: 1 },
  semestral: { id: "semestral", label: "Semestral", price: new Decimal("78.90"), periodMonths: 6 },
  annual: { id: "annual", label: "Anual", price: new Decimal("134.90"), periodMonths: 12 },
};

export function isPaidPlanId(value: string): value is PaidPlanId {
  return value === "monthly" || value === "semestral" || value === "annual";
}

export function monthlyEquivalent(plan: PlanDefinition): Decimal {
  return plan.price.dividedBy(plan.periodMonths);
}

/** Economia em relação a pagar o plano mensal pelo mesmo periodo. null se não houver desconto (plano mensal). */
export function savingsVsMonthly(plan: PlanDefinition): { amount: Decimal; percent: number } | null {
  if (plan.periodMonths === 1) return null;
  const monthlyTotal = PAID_PLANS.monthly.price.times(plan.periodMonths);
  const amount = monthlyTotal.minus(plan.price);
  if (!amount.isPositive()) return null;
  const percent = amount.dividedBy(monthlyTotal).times(100).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();
  return { amount, percent };
}
