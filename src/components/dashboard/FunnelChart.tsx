import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer, LabelList } from "recharts";

interface Lead {
  mql: boolean | null;
  sql_flag: boolean | null;
  ra_flag: boolean | null;
  rr_flag: boolean | null;
  status: string;
  funil: string | null;
}

interface FunnelChartProps {
  leads: Lead[];
  funil?: string;
}

const STAGE_COLORS = [
  "hsl(234, 60%, 28%)",
  "hsl(250, 45%, 50%)",
  "hsl(234, 60%, 42%)",
  "hsl(200, 55%, 45%)",
  "hsl(180, 50%, 40%)",
  "hsl(142, 60%, 40%)",
];

export function FunnelChart({ leads, funil }: FunnelChartProps) {
  const data = useMemo(() => {
    const filtered = funil && funil !== "all" ? leads.filter((l) => l.funil === funil) : leads;

    const total = filtered.length;
    const mql = filtered.filter((l) => l.mql).length;
    const sql = filtered.filter((l) => l.sql_flag).length;
    const ra = filtered.filter((l) => l.ra_flag).length;
    const rr = filtered.filter((l) => l.rr_flag).length;
    const won = filtered.filter((l) => l.status === "contrato_assinado").length;

    const convRate = (from: number, to: number) =>
      from > 0 ? `${((to / from) * 100).toFixed(1)}%` : "–";

    return [
      { name: "Leads", value: total, rate: "" },
      { name: "MQL", value: mql, rate: convRate(total, mql) },
      { name: "SQL", value: sql, rate: convRate(mql, sql) },
      { name: "RA", value: ra, rate: convRate(sql, ra) },
      { name: "RR", value: rr, rate: convRate(ra, rr) },
      { name: "Venda", value: won, rate: convRate(rr, won) },
    ];
  }, [leads, funil]);

  const maxValue = Math.max(...data.map((d) => d.value), 1);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Funil de Conversão</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 5, right: 80, left: 10, bottom: 5 }}
            barCategoryGap="20%"
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
        <div className="flex items-center justify-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
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
