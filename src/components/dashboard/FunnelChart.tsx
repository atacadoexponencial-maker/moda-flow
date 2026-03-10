import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer, LabelList } from "recharts";

interface Lead {
  mql: boolean | null;
  sql_flag: boolean | null;
  status: string;
}

interface FunnelChartProps {
  leads: Lead[];
}

const STAGE_COLORS = [
  "hsl(234, 60%, 28%)",   // primary
  "hsl(250, 45%, 50%)",   // accent
  "hsl(234, 60%, 42%)",
  "hsl(142, 60%, 40%)",   // success
];

export function FunnelChart({ leads }: FunnelChartProps) {
  const data = useMemo(() => {
    const total = leads.length;
    const mql = leads.filter((l) => l.mql).length;
    const sql = leads.filter((l) => l.mql && l.sql_flag).length;
    const won = leads.filter((l) => l.mql && l.sql_flag && l.status === "contrato_assinado").length;

    const convRate = (from: number, to: number) =>
      from > 0 ? `${((to / from) * 100).toFixed(1)}%` : "–";

    return [
      { name: "Leads", value: total, rate: "" },
      { name: "MQL", value: mql, rate: convRate(total, mql) },
      { name: "SQL", value: sql, rate: convRate(mql, sql) },
      { name: "Ganho", value: won, rate: convRate(sql, won) },
    ];
  }, [leads]);

  const maxValue = Math.max(...data.map((d) => d.value), 1);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Funil de Conversão</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 5, right: 80, left: 10, bottom: 5 }}
            barCategoryGap="28%"
          >
            <XAxis type="number" hide domain={[0, maxValue]} />
            <YAxis
              type="category"
              dataKey="name"
              axisLine={false}
              tickLine={false}
              width={50}
              tick={{ fontSize: 13, fill: "hsl(220, 15%, 46%)" }}
            />
            <Tooltip
              formatter={(value: number) => [value.toLocaleString("pt-BR"), "Leads"]}
              contentStyle={{
                borderRadius: "8px",
                border: "1px solid hsl(220, 20%, 88%)",
                fontSize: "13px",
              }}
            />
            <Bar dataKey="value" radius={[0, 6, 6, 0]} maxBarSize={36}>
              {data.map((_, i) => (
                <Cell key={i} fill={STAGE_COLORS[i]} />
              ))}
              <LabelList
                dataKey="value"
                position="right"
                formatter={(v: number) => v.toLocaleString("pt-BR")}
                style={{ fontSize: 13, fontWeight: 600, fill: "hsl(224, 50%, 10%)" }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        {/* Conversion rates */}
        <div className="flex items-center justify-center gap-6 mt-2 text-xs text-muted-foreground">
          {data.slice(1).map((d, i) => (
            <span key={d.name} className="flex items-center gap-1">
              <span className="font-medium text-foreground">{d.rate}</span>
              <span>
                {data[i].name} → {d.name}
              </span>
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
