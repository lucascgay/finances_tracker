"use client";

import { useMemo, useState } from "react";
import { Search, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { ALLOWED_CATEGORIES, categoryLabel } from "@/lib/categories";

export interface TxRow {
  id: string;
  date: string;
  description: string;
  merchant: string | null;
  amount: number;
  category: string;
  sourceType: string;
}

type SortKey = "date" | "amount" | "description";

export default function TransactionTable({
  rows,
  onRecategorize,
  onDelete,
}: {
  rows: TxRow[];
  onRecategorize: (id: string, category: string) => void;
  onDelete: (id: string) => void;
}) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState<SortKey>("date");
  const [dir, setDir] = useState<"asc" | "desc">("desc");

  const fmt = (n: number) =>
    n.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      signDisplay: "always",
    });

  const filtered = useMemo(() => {
    let list = rows.filter((r) => {
      const matchesQ =
        !q ||
        r.description.toLowerCase().includes(q.toLowerCase()) ||
        (r.merchant ?? "").toLowerCase().includes(q.toLowerCase());
      const matchesCat = filter === "all" || r.category === filter;
      return matchesQ && matchesCat;
    });
    list = list.sort((a, b) => {
      let cmp = 0;
      if (sort === "date") cmp = a.date.localeCompare(b.date);
      else if (sort === "amount") cmp = a.amount - b.amount;
      else cmp = a.description.localeCompare(b.description);
      return dir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [rows, q, filter, sort, dir]);

  function toggleSort(key: SortKey) {
    if (sort === key) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSort(key);
      setDir("desc");
    }
  }

  const SortIcon = ({ k }: { k: SortKey }) =>
    sort === k ? (
      dir === "asc" ? (
        <ChevronUp className="h-3 w-3" />
      ) : (
        <ChevronDown className="h-3 w-3" />
      )
    ) : null;

  return (
    <div>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search transactions…"
            className="h-10 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
          />
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 focus:border-sky-500 focus:outline-none"
        >
          <option value="all">All categories</option>
          {ALLOWED_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {categoryLabel(c)}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr className="text-left text-xs text-slate-500">
              <th
                className="cursor-pointer px-4 py-3 font-medium"
                onClick={() => toggleSort("date")}
              >
                <span className="inline-flex items-center gap-1">
                  Date <SortIcon k="date" />
                </span>
              </th>
              <th
                className="cursor-pointer px-4 py-3 font-medium"
                onClick={() => toggleSort("description")}
              >
                <span className="inline-flex items-center gap-1">
                  Description <SortIcon k="description" />
                </span>
              </th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th
                className="cursor-pointer px-4 py-3 text-right font-medium"
                onClick={() => toggleSort("amount")}
              >
                <span className="inline-flex items-center gap-1">
                  Amount <SortIcon k="amount" />
                </span>
              </th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  No transactions found.
                </td>
              </tr>
            )}
            {filtered.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50">
                <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">
                  {r.date}
                </td>
                <td className="px-4 py-2.5">
                  <div className="font-medium text-slate-800">
                    {r.merchant || r.description}
                  </div>
                  {r.merchant && r.description !== r.merchant && (
                    <div className="text-xs text-slate-400">{r.description}</div>
                  )}
                </td>
                <td className="px-4 py-2.5">
                  <select
                    value={r.category}
                    onChange={(e) => onRecategorize(r.id, e.target.value)}
                    className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:border-sky-500 focus:outline-none"
                  >
                    {ALLOWED_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {categoryLabel(c)}
                      </option>
                    ))}
                  </select>
                </td>
                <td
                  className={
                    "whitespace-nowrap px-4 py-2.5 text-right font-medium " +
                    (r.amount < 0 ? "text-slate-800" : "text-emerald-600")
                  }
                >
                  {fmt(r.amount)}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <button
                    onClick={() => onDelete(r.id)}
                    className="text-slate-300 transition-colors hover:text-rose-500"
                    aria-label="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        {filtered.length} of {rows.length} transactions · change the dropdown to
        re-categorize a row
      </p>
    </div>
  );
}
