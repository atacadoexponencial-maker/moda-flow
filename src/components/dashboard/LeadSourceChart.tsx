import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface Lead {
  utm_source: string | null;
  mql: boolean | null;
  sql_flag: boolean | null;
  status: string;
}

interface LeadSourceChartProps {
  leads: Lead[];
}

const COLORS = [
  "hsl(234, 60%, 28%)",
  "hsl(250, 45%, 50%)",
  "hsl(142, 60%, 40%)",
  "hsl(38, 92%, 50%)",
  "hsl(0, 72%, 51%)",
  "hsl(200, 70%, 45%)",
  "hsl(280, 50%, 50%)",
  "hsl(160, 55%, 40%)",
  "hsl(20, 80%, 50%)",
  "hsl(300, 40%, 45%)",
];

interface SourceRow {
  source: string;
  total: number;
  mql: number;
  sql: number;
  won: number;
  closeRate: number;
  percent: number;
}

export function LeadSourceChart({ leads }: LeadSourceChartProps) {
  const { pieData, tableData } = useMemo(() => {
    const map = new Map<string, Lead[]>();
    for (const l of leads) {
      const src = l.utm_source || "(sem fonte)";
      if (!map.has(src)) map.set(src, []);
      map.get(src)!.push(l);
    }

    const total = leads.length || 1;

    const rows: SourceRow[] = Array.from(map.entries())
      .map(([source, items]) => {
        const mql = items.filter((l) => l.mql).length;
        const sql = items.filter((l) => l.mql && l.sql_flag).length;
        const won = items.filter((l) => l.mql && l.sql_flag && l.status === "contrato_assinado").length;
        return {
          source,
          total: items.length,
          mql,
          sql,
          won,
          closeRate: sql > 0 ? (won / sql) * 100 : 0,
          percent: (items.length / total) * 100,
        };
      })
      .sort((a, b) => b.total - a.total);

    const pie = rows.map((r) => ({
      name: r.source,
      value: r.total,
    }));

    return { pieData: pie, tableData: rows };
  }, [leads]);

  const renderLegend = (props: any) => {
    const { payload } = props;
    return (
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-2">
        {(payload || []).map((entry: any, i: number) => (
          <span key={i} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
              style={{ backgroundColor: entry.color }}
            />
            <span>{entry.value}</span>
            <span className="font-medium text-foreground">
              {tableData[i]?.percent.toFixed(1)}%
            </span>
          </span>
        ))}
      </div>
    );
  };

  if (leads.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Origem dos Leads</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">Nenhum lead no período.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Origem dos Leads</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={95}
              paddingAngle={2}
              dataKey="value"
              stroke="none"
            >
              {pieData.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number, name: string) => [
                `${value.toLocaleString("pt-BR")} leads`,
                name,
              ]}
              contentStyle={{
                borderRadius: "8px",
                border: "1px solid hsl(220, 20%, 88%)",
                fontSize: "13px",
              }}
            />
            <Legend content={renderLegend} />
          </PieChart>
        </ResponsiveContainer>

        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fonte</TableHead>
                <TableHead className="text-right">Leads</TableHead>
                <TableHead className="text-right">MQL</TableHead>
                <TableHead className="text-right">SQL</TableHead>
                <TableHead className="text-right">Ganhos</TableHead>
                <TableHead className="text-right">Fechamento</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tableData.map((row, i) => (
                <TableRow key={row.source}>
                  <TableCell className="font-medium flex items-center gap-2">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: COLORS[i % COLORS.length] }}
                    />
                    {row.source}
                  </TableCell>
                  <TableCell className="text-right">{row.total}</TableCell>
                  <TableCell className="text-right">{row.mql}</TableCell>
                  <TableCell className="text-right">{row.sql}</TableCell>
                  <TableCell className="text-right">{row.won}</TableCell>
                  <TableCell className="text-right">
                    {row.closeRate > 0 ? `${row.closeRate.toFixed(1)}%` : "–"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
