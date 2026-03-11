import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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

  const maxValue = Math.max(...data.map((d) => d.value), 1);
  const inv = investimento ?? 0;

  const MIN_WIDTH = 28;

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
        <div className="flex flex-col items-center gap-0 py-2">
          {data.map((stage, i) => {
            const widthPct = Math.max((stage.value / maxValue) * 100, MIN_WIDTH);
            const isLast = i === data.length - 1;

            return (
              <div key={stage.name} className="w-full flex flex-col items-center">
                {/* Funnel bar */}
                <div
                  className="flex items-center justify-between px-3 h-10 rounded transition-all duration-300"
                  style={{
                    width: `${widthPct}%`,
                    backgroundColor: STAGE_COLORS[i],
                    minWidth: 120,
                  }}
                >
                  <span className="text-white font-semibold text-sm truncate">
                    {stage.name}
                  </span>
                  <span className="text-white font-bold text-sm ml-2 shrink-0">
                    {stage.value.toLocaleString("pt-BR")}
                  </span>
                </div>

                {/* Arrow + conversion rate between stages */}
                {!isLast && (
                  <div className="flex flex-col items-center my-0.5">
                    <svg width="20" height="14" viewBox="0 0 20 14" fill="none">
                      <path
                        d="M10 14L0 0H20L10 14Z"
                        fill={STAGE_COLORS[i]}
                        opacity={0.35}
                      />
                    </svg>
                    {data[i + 1].rate !== "" && (
                      <span className="text-xs font-medium text-muted-foreground -mt-0.5">
                        {data[i + 1].rate}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* CPL per stage */}
        {inv > 0 && (
          <div className="flex items-center justify-center gap-4 mt-3 text-xs text-muted-foreground flex-wrap border-t pt-3">
            {data.map((d) =>
              d.value > 0 ? (
                <span key={d.name} className="flex items-center gap-1">
                  <span className="font-medium text-foreground">
                    {fmtCurrency(inv / d.value)}
                  </span>
                  <span>CPL {d.name}</span>
                </span>
              ) : null
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
