"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCcw } from "lucide-react";
import Uploader from "@/components/uploader";
import HeroSpend from "@/components/hero-spend";
import CategoryChart, { CategorySlice } from "@/components/category-chart";
import BudgetBar, { BudgetRow } from "@/components/budget-bar";
import TransactionTable from "@/components/transaction-table";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { CATEGORY_META, categoryLabel, monthKey } from "@/lib/categories";

interface TxApiRow {
  id: string;
  date: string;
  description: string;
  merchant: string | null;
  amount: number;
  category: string;
  sourceType: string;
}

function monthOptions(): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 24; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    out.push({
      key: monthKey(d),
      label: d.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      }),
    });
  }
  return out;
}

export default function DashboardPage() {
  const months = useMemo(monthOptions, []);
  const [month, setMonth] = useState(months[0].key);
  const [txs, setTxs] = useState<TxApiRow[]>([]);
  const [budgetRows, setBudgetRows] = useState<BudgetRow[]>([]);
  const [loading, setLoading] = useState(true);

  const monthLabel = useMemo(
    () => months.find((m) => m.key === month)?.label ?? month,
    [months, month]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [txRes, budgetRes] = await Promise.all([
        fetch(`/api/transactions?month=${month}&limit=5000`),
        fetch(`/api/budgets?month=${month}`),
      ]);
      const txData = await txRes.json();
      const budgetData = await budgetRes.json();
      setTxs(txData.transactions ?? []);
      setBudgetRows(budgetData.categories ?? []);
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    load();
  }, [load]);

  const heroData = useMemo(() => {
    let spent = 0;
    let income = 0;
    for (const t of txs) {
      if (t.amount < 0) spent += Math.abs(t.amount);
      else income += t.amount;
    }
    return { spent, income };
  }, [txs]);

  const categorySlices: CategorySlice[] = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of txs) {
      if (t.amount >= 0) continue; // only expenses in the donut
      const cat = t.category;
      map.set(cat, (map.get(cat) ?? 0) + Math.abs(t.amount));
    }
    return Array.from(map.entries())
      .map(([category, value]) => ({
        category,
        label: categoryLabel(category),
        color: CATEGORY_META[category as keyof typeof CATEGORY_META]?.color ?? "#94a3b8",
        value: Math.round(value * 100) / 100,
      }))
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [txs]);

  async function recategorize(id: string, category: string) {
    await fetch(`/api/transactions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category }),
    });
    load();
  }

  async function deleteTx(id: string) {
    await fetch(`/api/transactions/${id}`, { method: "DELETE" });
    load();
  }

  async function saveBudget(updates: Record<string, number>) {
    // Merge: keep existing budgets, overlay the changed ones.
    const merged = budgetRows.map((r) => ({
      category: r.category,
      amount: updates[r.category] ?? r.budgeted,
    }));
    // Add any new keys not present yet.
    for (const [cat, amt] of Object.entries(updates)) {
      if (!merged.some((r) => r.category === cat)) {
        merged.push({ category: cat, amount: amt });
      }
    }
    await fetch("/api/budgets", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month, budgets: merged }),
    });
    load();
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {/* Header */}
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              LocalFinance Tracker
            </h1>
            <p className="text-sm text-slate-500">
              100% local · your data never leaves this machine
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 focus:border-sky-500 focus:outline-none"
            >
              {months.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </select>
            <button
              onClick={load}
              className="flex h-10 w-10 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
              aria-label="Refresh"
            >
              <RefreshCcw
                className={"h-4 w-4 " + (loading ? "animate-spin" : "")}
              />
            </button>
          </div>
        </header>

        {/* Import / Upload */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Import & parse</CardTitle>
          </CardHeader>
          <CardContent>
            <Uploader onParsed={load} />
          </CardContent>
        </Card>

        {/* Hero + Budget */}
        <section className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <HeroSpend
            totalSpent={heroData.spent}
            totalIncome={heroData.income}
            monthLabel={monthLabel}
          />
        </section>

        {/* Charts */}
        <section className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <CategoryChart data={categorySlices} />
          <BudgetBar rows={budgetRows} onSave={saveBudget} />
        </section>

        {/* Transactions */}
        <Card>
          <CardHeader>
            <CardTitle>Monthly outflow breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <TransactionTable
              rows={txs.map((t) => ({
                id: t.id,
                date: t.date.slice(0, 10),
                description: t.description,
                merchant: t.merchant,
                amount: t.amount,
                category: t.category,
                sourceType: t.sourceType,
              }))}
              onRecategorize={recategorize}
              onDelete={deleteTx}
            />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
