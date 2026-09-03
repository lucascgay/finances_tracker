import type { Category } from "@prisma/client";

// Display metadata for every category in the app (single source of truth).
// Order matters for donut legends and tables.
export const CATEGORY_META: Record<
  Category,
  { label: string; color: string }
> = {
  Rent: { label: "Rent", color: "#0ea5e9" },
  Gas_Transportation: { label: "Gas & Transportation", color: "#f59e0b" },
  Groceries: { label: "Groceries", color: "#10b981" },
  Dining_Coffee: { label: "Dining Out & Coffee", color: "#ef4444" },
  Home_Supplies: { label: "Home Supplies", color: "#8b5cf6" },
  Utilities_Housing: { label: "Utilities & Housing", color: "#06b6d4" },
  Subscriptions_Gym: { label: "Subscriptions & Gym", color: "#ec4899" },
  Entertainment_Personal: {
    label: "Entertainment & Personal",
    color: "#f97316",
  },
  Income_Credit: { label: "Income / Credit", color: "#22c55e" },
  Uncategorized: { label: "Uncategorized", color: "#94a3b8" },
};

export const CATEGORIES = Object.keys(CATEGORY_META) as Category[];

export function categoryLabel(c: Category | string): string {
  return CATEGORY_META[c as Category]?.label ?? c;
}

export function categoryColor(c: Category | string): string {
  return CATEGORY_META[c as Category]?.color ?? "#94a3b8";
}

// The categories the LLM is allowed to choose from (kept in sync with the enum).
export const ALLOWED_CATEGORIES = Object.keys(CATEGORY_META) as Category[];

// Friendly month keys like the Budget model uses: "2026-09".
export function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
