"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export interface CategorySlice {
  category: string;
  label: string;
  color: string;
  value: number;
}

export default function CategoryChart({ data }: { data: CategorySlice[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const fmt = (n: number) =>
    n.toLocaleString("en-US", { style: "currency", currency: "USD" });

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Spending by category</CardTitle>
        <CardDescription>{data.length} categories this month</CardDescription>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <div className="flex h-56 items-center justify-center text-sm text-slate-400">
            No spending recorded yet.
          </div>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={2}
                  strokeWidth={2}
                >
                  {data.map((d) => (
                    <Cell key={d.category} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) =>
                    fmt(typeof value === "number" ? value : Number(value))
                  }
                  contentStyle={{
                    borderRadius: 8,
                    border: "1px solid #e2e8f0",
                    fontSize: 13,
                  }}
                />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  formatter={(label) => (
                    <span className="text-xs text-slate-600">{label}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
        <div className="mt-2 space-y-1.5">
          {data
            .slice()
            .sort((a, b) => b.value - a.value)
            .slice(0, 6)
            .map((d) => (
              <div
                key={d.category}
                className="flex items-center justify-between text-sm"
              >
                <span className="flex items-center gap-2 text-slate-600">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: d.color }}
                  />
                  {d.label}
                </span>
                <span className="font-medium text-slate-800">{fmt(d.value)}</span>
              </div>
            ))}
        </div>
      </CardContent>
    </Card>
  );
}
