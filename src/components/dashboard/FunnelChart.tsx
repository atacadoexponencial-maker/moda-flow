import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronRight } from "lucide-react";

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
  investimento?: number;
}

function fmtCurrency(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

const STAGE_COLORS = [
  "#1e3a8a",
  "#3730a3",
  "#4338ca",
  "#0369a1",
  "#0891b2",
  "#059669",
];

export function FunnelChart({ leads, funil, investimento }: FunnelChartProps) {
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

  const inv = investimento ?? 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Funil de Conversão</CardTitle>
          {inv > 0 && (
            <span className="text-sm font-medium text-muted-foreground">
              Investimento: {fmtCurrency(inv)}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {/* Stages row */}
        <div className="flex items-stretch gap-0 overflow-x-auto pb-2">
          {data.map((stage, i) => {
            const isLast = i === data.length - 1;
            return (
              <div key={stage.name} className="flex items-center shrink-0">
                {/* Stage card */}
                <div
                  className="flex flex-col items-center justify-center rounded-lg px-4 py-3 min-w-[80px] border-t-4"
                  style={{ borderColor: STAGE_COLORS[i] }}
                >
                  <span className="text-xs font-medium text-muted-foreground mb-1">
                    {stage.name}
                  </span>
                  <span className="text-2xl font-bold text-foreground leading-none">
                    {stage.value.toLocaleString("pt-BR")}
                  </span>
                </div>

                {/* Connector + rate */}
                {!isLast && (
                  <div className="flex flex-col items-center mx-1 shrink-0">
                    <span className="text-[11px] font-semibold text-primary leading-none mb-0.5">
                      {data[i + 1].rate}
                    </span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* CPL chips */}
        {inv > 0 && (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t flex-wrap">
            {data.map((d) =>
              d.value > 0 ? (
                <span
                  key={d.name}
                  className="inline-flex items-center gap-1 text-xs bg-muted rounded-full px-2.5 py-1"
                >
                  <span className="font-semibold text-foreground">{fmtCurrency(inv / d.value)}</span>
                  <span className="text-muted-foreground">/{d.name}</span>
                </span>
              ) : null
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
