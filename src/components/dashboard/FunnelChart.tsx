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

const SVG_W = 520;
const STAGE_H = 56;
const RATE_GAP = 22;
const MIN_W = 100;

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
  const maxVal = Math.max(data[0].value, 1);

  // Width of each stage bar (proportional to count)
  const widths = data.map((d) => Math.max((d.value / maxVal) * SVG_W, MIN_W));

  const totalSvgH = data.length * STAGE_H + (data.length - 1) * RATE_GAP;

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
        <div className="w-full overflow-x-auto">
          <svg
            viewBox={`0 0 ${SVG_W} ${totalSvgH}`}
            width="100%"
            style={{ maxWidth: SVG_W, display: "block", margin: "0 auto" }}
          >
            {data.map((stage, i) => {
              const topW = widths[i];
              const bottomW = i < data.length - 1 ? widths[i + 1] : widths[i] * 0.88;

              const yTop = i * (STAGE_H + RATE_GAP);
              const yBottom = yTop + STAGE_H;

              const x1 = (SVG_W - topW) / 2;
              const x2 = (SVG_W + topW) / 2;
              const x3 = (SVG_W + bottomW) / 2;
              const x4 = (SVG_W - bottomW) / 2;

              const midX = SVG_W / 2;
              const midY = yTop + STAGE_H / 2;

              // Rate label between this stage and next
              const rateY = yBottom + RATE_GAP / 2 + 1;
              const nextRate = i < data.length - 1 ? data[i + 1].rate : "";

              return (
                <g key={stage.name}>
                  {/* Trapezoid */}
                  <polygon
                    points={`${x1},${yTop} ${x2},${yTop} ${x3},${yBottom} ${x4},${yBottom}`}
                    fill={STAGE_COLORS[i]}
                  />

                  {/* Stage name */}
                  <text
                    x={midX}
                    y={midY - 9}
                    textAnchor="middle"
                    fill="white"
                    fontSize="11"
                    fontWeight="500"
                    opacity="0.85"
                  >
                    {stage.name}
                  </text>

                  {/* Stage value */}
                  <text
                    x={midX}
                    y={midY + 10}
                    textAnchor="middle"
                    fill="white"
                    fontSize="18"
                    fontWeight="700"
                  >
                    {stage.value.toLocaleString("pt-BR")}
                  </text>

                  {/* Conversion rate label between stages */}
                  {nextRate && (
                    <text
                      x={midX}
                      y={rateY}
                      textAnchor="middle"
                      fill="#6b7280"
                      fontSize="11"
                      fontWeight="600"
                    >
                      {nextRate}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
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
