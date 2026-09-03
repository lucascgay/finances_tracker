"use client";

import { ArrowDownRight, ArrowUpRight, Wallet } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function HeroSpend({
  totalSpent,
  totalIncome,
  monthLabel,
}: {
  totalSpent: number;
  totalIncome: number;
  monthLabel: string;
}) {
  const net = totalIncome - totalSpent;
  const fmt = (n: number) =>
    n.toLocaleString("en-US", { style: "currency", currency: "USD" });

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-slate-500">Total spending · {monthLabel}</p>
            <p className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
              {fmt(totalSpent)}
            </p>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-sky-100 text-sky-600">
            <Wallet className="h-5 w-5" />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4">
          <div>
            <div className="flex items-center gap-1 text-xs text-slate-500">
              <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500" /> Income
            </div>
            <p className="mt-0.5 text-sm font-semibold text-emerald-600">
              {fmt(totalIncome)}
            </p>
          </div>
          <div>
            <div className="flex items-center gap-1 text-xs text-slate-500">
              <ArrowDownRight className="h-3.5 w-3.5 text-slate-400" /> Net
            </div>
            <p
              className={
                "mt-0.5 text-sm font-semibold " +
                (net >= 0 ? "text-emerald-600" : "text-rose-600")
              }
            >
              {fmt(net)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
