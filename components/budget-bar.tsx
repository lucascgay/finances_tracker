"use client";

import { useState } from "react";
import { Target } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export interface BudgetRow {
  category: string;
  label: string;
  budgeted: number;
  spent: number;
}

export default function BudgetBar({
  rows,
  onSave,
}: {
  rows: BudgetRow[];
  onSave: (updates: Record<string, number>) => void;
}) {
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const totalBudgeted = rows.reduce((s, r) => s + r.budgeted, 0);
  const totalSpent = rows.reduce((s, r) => s + r.spent, 0);
  const pct = totalBudgeted > 0 ? (totalSpent / totalBudgeted) * 100 : 0;
  const fmt = (n: number) =>
    n.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    });

  const barColor =
    pct <= 85 ? "bg-emerald-500" : pct <= 100 ? "bg-amber-500" : "bg-rose-500";

  const hasEdits = Object.keys(draft).length > 0;

  function change(category: string, value: string) {
    setDraft((d) => ({ ...d, [category]: value }));
  }

  async function saveAll() {
    setSaving(true);
    try {
      const updates: Record<string, number> = {};
      for (const [cat, v] of Object.entries(draft)) {
        const n = parseFloat(v);
        updates[cat] = Number.isFinite(n) && n >= 0 ? n : 0;
      }
      onSave(updates);
      setDraft({});
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-4 w-4 text-sky-500" /> Budget vs. actual
        </CardTitle>
        <CardDescription>
          {fmt(totalSpent)} of {fmt(totalBudgeted)} used ({pct.toFixed(0)}%)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-5">
          <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className={cn("h-full rounded-full transition-all", barColor)}
              style={{ width: `${Math.min(pct, 100)}%` }}
            />
          </div>
          <p
            className={cn(
              "mt-1.5 text-xs",
              pct > 100 ? "text-rose-600" : "text-slate-500"
            )}
          >
            {pct > 100
              ? `${fmt(totalSpent - totalBudgeted)} over budget`
              : `${fmt(totalBudgeted - totalSpent)} remaining`}
          </p>
        </div>

        <div className="space-y-3">
          {rows
            .slice()
            .sort((a, b) => b.spent - a.spent)
            .map((r) => {
              const rpct = r.budgeted > 0 ? (r.spent / r.budgeted) * 100 : 0;
              const current = draft[r.category] ?? String(r.budgeted || "");
              return (
                <div key={r.category} className="text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-600">{r.label}</span>
                    <span className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={current}
                        placeholder="—"
                        onChange={(e) => change(r.category, e.target.value)}
                        className="h-7 w-24 rounded-md border border-slate-200 bg-white px-2 text-right text-xs text-slate-800 focus:border-sky-500 focus:outline-none"
                      />
                      <span className="w-16 text-right tabular-nums font-medium text-slate-800">
                        {fmt(r.spent)}
                      </span>
                    </span>
                  </div>
                  {r.budgeted > 0 ? (
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          rpct > 100 ? "bg-rose-500" : "bg-sky-500"
                        )}
                        style={{ width: `${Math.min(rpct, 100)}%` }}
                      />
                    </div>
                  ) : (
                    <p className="mt-0.5 text-xs text-slate-400">
                      Set a budget to track this category
                    </p>
                  )}
                </div>
              );
            })}
        </div>

        {hasEdits && (
          <div className="mt-4">
            <button
              onClick={saveAll}
              disabled={saving}
              className="inline-flex h-9 items-center justify-center rounded-md bg-sky-600 px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-sky-700 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save budgets"}
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
