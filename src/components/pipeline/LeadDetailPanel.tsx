import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Copy, ExternalLink, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getStageLabel } from '@/lib/constants';
import type { Tables } from '@/integrations/supabase/types';

type Lead = Tables<'leads'>;

function formatDate(d: string | null) {
  if (!d) return '—';
  return format(parseISO(d), 'dd/MM/yyyy', { locale: ptBR });
}

function formatCurrency(v: number | null) {
  if (!v) return 'R$ 0';
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="text-sm text-foreground">{value || '—'}</div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground pt-2">{children}</h4>;
}

function CopyButton({ text }: { text: string }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(text); toast.success('Copiado!'); }}
      className="inline-flex items-center text-muted-foreground hover:text-foreground ml-1.5"
    >
      <Copy className="h-3 w-3" />
    </button>
  );
}

function FlagBadge({ label, active }: { label: string; active: boolean | null }) {
  return active
    ? <Badge className="text-[10px] bg-accent text-accent-foreground">{label}</Badge>
    : <Badge variant="outline" className="text-[10px] opacity-50">{label}</Badge>;
}

interface LeadDetailPanelProps {
  lead: Lead | null;
  open: boolean;
  onClose: () => void;
}

export function LeadDetailPanel({ lead, open, onClose }: LeadDetailPanelProps) {
  if (!lead) return null;

  const waLink = lead.whatsapp ? `https://wa.me/${lead.whatsapp.replace(/\D/g, '')}` : null;

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="flex-row items-center justify-between space-y-0 pr-2">
          <SheetTitle className="text-lg">{lead.nome}</SheetTitle>
          <Button variant="outline" size="sm" disabled>
            <Pencil className="h-3.5 w-3.5 mr-1.5" />
            Editar
          </Button>
        </SheetHeader>

        <div className="space-y-4 mt-4">
          {/* Contato */}
          <SectionTitle>Contato</SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nome" value={lead.nome} />
            <Field label="E-mail" value={
              lead.email ? <span className="flex items-center gap-0">{lead.email}<CopyButton text={lead.email} /></span> : '—'
            } />
            <Field label="WhatsApp" value={
              waLink
                ? <a href={waLink} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline inline-flex items-center gap-1">{lead.whatsapp}<ExternalLink className="h-3 w-3" /></a>
                : '—'
            } />
            <Field label="Instagram" value={
              lead.instagram
                ? <a href={`https://instagram.com/${lead.instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">{lead.instagram}</a>
                : '—'
            } />
          </div>

          <Separator />

          {/* Pipeline */}
          <SectionTitle>Pipeline</SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Status" value={<Badge variant="secondary">{getStageLabel(lead.status)}</Badge>} />
            <div className="flex items-center gap-1.5 flex-wrap pt-4">
              <FlagBadge label="MQL" active={lead.mql} />
              <FlagBadge label="SQL" active={lead.sql_flag} />
              <FlagBadge label="RA" active={lead.ra_flag} />
              <FlagBadge label="RR" active={lead.rr_flag} />
            </div>
            <Field label="Último contato" value={formatDate(lead.data_ultimo_contato)} />
            <Field label="Próximo contato" value={formatDate(lead.data_proximo_contato)} />
            <Field label="Reunião agendada" value={formatDate(lead.data_ra)} />
            <Field label="Produto" value={lead.produto} />
            <Field label="Funil" value={lead.funil} />
          </div>

          <Separator />

          {/* Financeiro */}
          <SectionTitle>Financeiro</SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Faturamento mensal" value={lead.faturamento_mensal} />
            <Field label="Oportunidade" value={formatCurrency(lead.oportunidade)} />
            <Field label="Arrecadado" value={formatCurrency(lead.arrecadado)} />
            {lead.loss_reason && <Field label="Motivo de perda" value={lead.loss_reason} />}
          </div>

          <Separator />

          {/* Perfil */}
          <SectionTitle>Perfil do Lead</SectionTitle>
          <div className="space-y-3">
            <Field label="Justificativa (dor/desafio)" value={lead.justificativa} />
            <Field label="Objetivo" value={lead.objetivo} />
          </div>

          <Separator />

          {/* Origem */}
          <SectionTitle>Origem</SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            <Field label="utm_source" value={lead.utm_source} />
            <Field label="utm_medium" value={lead.utm_medium} />
            <Field label="utm_campaign" value={lead.utm_campaign} />
            <Field label="utm_content" value={lead.utm_content} />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
