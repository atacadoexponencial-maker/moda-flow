import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { getStageLabel } from "@/lib/constants";
import { Search, X } from "lucide-react";
import { LeadDetailPanel } from "@/components/pipeline/LeadDetailPanel";
import type { Tables } from "@/integrations/supabase/types";

type Lead = Tables<"leads">;

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  // Auto-focus
  useEffect(() => {
    if (open) {
      setQuery("");
      setResults([]);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Search
  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }

    const timeout = setTimeout(async () => {
      setLoading(true);
      const pattern = `%${query}%`;
      const { data } = await supabase
        .from("leads")
        .select("*")
        .or(
          `nome.ilike.${pattern},email.ilike.${pattern},whatsapp.ilike.${pattern},instagram.ilike.${pattern}`
        )
        .limit(10);
      setResults((data as Lead[]) || []);
      setLoading(false);
    }, 250);

    return () => clearTimeout(timeout);
  }, [query]);

  const handleSelect = (lead: Lead) => {
    setOpen(false);
    setSelectedLead(lead);
  };

  const formatCurrency = (v: number | null) => {
    if (!v) return "—";
    return v.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  };

  return (
    <>
      {/* Trigger button in header */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 h-8 px-3 rounded-md border border-border bg-background text-muted-foreground text-sm hover:bg-muted transition-colors"
      >
        <Search className="h-3.5 w-3.5" />
        <span className="hidden md:inline">Buscar leads...</span>
        <kbd className="hidden md:inline-flex h-5 items-center gap-0.5 rounded border border-border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground">
          ⌘K
        </kbd>
      </button>

      {/* Modal overlay */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
          onClick={() => setOpen(false)}
        >
          <div className="fixed inset-0 bg-black/50" />
          <div
            className="relative z-10 w-full max-w-lg rounded-xl border border-border bg-card shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Search input */}
            <div className="flex items-center gap-3 px-4 border-b border-border">
              <Search className="h-4 w-4 text-muted-foreground shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por nome, email, WhatsApp ou Instagram..."
                className="flex-1 h-12 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
              />
              {query && (
                <button onClick={() => setQuery("")} className="text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Results */}
            <div className="max-h-[320px] overflow-y-auto">
              {query.length < 2 && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Digite pelo menos 2 caracteres para buscar.
                </p>
              )}

              {query.length >= 2 && loading && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Buscando...
                </p>
              )}

              {query.length >= 2 && !loading && results.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nenhum lead encontrado.
                </p>
              )}

              {results.map((lead) => (
                <button
                  key={lead.id}
                  onClick={() => handleSelect(lead)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors text-left border-b border-border last:border-0"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {lead.nome}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {lead.email || lead.whatsapp || lead.instagram || "—"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    <span className="text-xs text-muted-foreground">
                      {formatCurrency(lead.faturamento_mensal ? parseFloat(lead.faturamento_mensal) : null)}
                    </span>
                    <Badge variant="secondary" className="text-[10px]">
                      {getStageLabel(lead.status)}
                    </Badge>
                  </div>
                </button>
              ))}
            </div>

            {/* Footer hint */}
            <div className="px-4 py-2 border-t border-border flex items-center gap-4 text-[10px] text-muted-foreground">
              <span>
                <kbd className="px-1 py-0.5 rounded border border-border bg-muted font-mono">Esc</kbd> para fechar
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Lead detail panel */}
      <LeadDetailPanel
        lead={selectedLead}
        open={!!selectedLead}
        onClose={() => setSelectedLead(null)}
      />
    </>
  );
}
