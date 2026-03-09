import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Copy, ExternalLink, Pencil, Save, X, CalendarIcon } from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { FUNNEL_STAGES, getStageLabel } from '@/lib/constants';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { LeadActivities } from '@/components/pipeline/LeadActivities';
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

function EditField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      {children}
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

function DatePickerField({ value, onChange, label }: { value: string | null; onChange: (v: string | null) => void; label: string }) {
  const date = value ? parseISO(value) : undefined;
  return (
    <EditField label={label}>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className={cn('w-full justify-start text-left font-normal h-9', !date && 'text-muted-foreground')}>
            <CalendarIcon className="mr-2 h-3.5 w-3.5" />
            {date ? format(date, 'dd/MM/yyyy', { locale: ptBR }) : 'Selecionar'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            onSelect={(d) => onChange(d ? format(d, 'yyyy-MM-dd') : null)}
            locale={ptBR}
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>
    </EditField>
  );
}

interface LeadDetailPanelProps {
  lead: Lead | null;
  open: boolean;
  onClose: () => void;
}

export function LeadDetailPanel({ lead, open, onClose }: LeadDetailPanelProps) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<Lead>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (lead) setForm({ ...lead });
    setEditing(false);
  }, [lead]);

  if (!lead) return null;

  const waLink = lead.whatsapp ? `https://wa.me/${lead.whatsapp.replace(/\D/g, '')}` : null;

  const set = <K extends keyof Lead>(key: K, val: Lead[K]) => setForm(prev => ({ ...prev, [key]: val }));

  const handleSave = async () => {
    setSaving(true);
    const { id, created_at, ...rest } = form as Lead;
    const { error } = await supabase.from('leads').update(rest).eq('id', lead.id);
    setSaving(false);
    if (error) {
      toast.error('Erro ao salvar');
      return;
    }
    toast.success('Lead atualizado');
    setEditing(false);
    queryClient.invalidateQueries({ queryKey: ['leads-pipeline'] });
    queryClient.invalidateQueries({ queryKey: ['leads-table'] });
  };

  const handleCancel = () => {
    setForm({ ...lead });
    setEditing(false);
  };

  // ── VIEW MODE ──
  if (!editing) {
    return (
      <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader className="flex-row items-center justify-between space-y-0 pr-2">
            <SheetTitle className="text-lg">{lead.nome}</SheetTitle>
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Pencil className="h-3.5 w-3.5 mr-1.5" />
              Editar
            </Button>
          </SheetHeader>

          <div className="space-y-4 mt-4">
            <SectionTitle>Contato</SectionTitle>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nome" value={lead.nome} />
              <Field label="E-mail" value={lead.email ? <span className="flex items-center gap-0">{lead.email}<CopyButton text={lead.email} /></span> : '—'} />
              <Field label="WhatsApp" value={waLink ? <a href={waLink} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline inline-flex items-center gap-1">{lead.whatsapp}<ExternalLink className="h-3 w-3" /></a> : '—'} />
              <Field label="Instagram" value={lead.instagram ? <a href={`https://instagram.com/${lead.instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">{lead.instagram}</a> : '—'} />
            </div>
            <Separator />
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
              <Field label="Data de Entrada" value={formatDate((lead as any).data_criada ?? lead.created_at?.slice(0, 10))} />
              <Field label="Produto" value={lead.produto} />
              <Field label="Funil" value={lead.funil} />
            </div>
            <Separator />
            <SectionTitle>Financeiro</SectionTitle>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Faturamento mensal" value={lead.faturamento_mensal} />
              <Field label="Oportunidade" value={formatCurrency(lead.oportunidade)} />
              <Field label="Arrecadado" value={formatCurrency(lead.arrecadado)} />
              {lead.loss_reason && <Field label="Motivo de perda" value={lead.loss_reason} />}
            </div>
            <Separator />
            <SectionTitle>Perfil do Lead</SectionTitle>
            <div className="space-y-3">
              <Field label="Justificativa (dor/desafio)" value={lead.justificativa} />
              <Field label="Objetivo" value={lead.objetivo} />
            </div>
            <Separator />
            <SectionTitle>Origem</SectionTitle>
            <div className="grid grid-cols-2 gap-3">
              <Field label="utm_source" value={lead.utm_source} />
              <Field label="utm_medium" value={lead.utm_medium} />
              <Field label="utm_campaign" value={lead.utm_campaign} />
              <Field label="utm_content" value={lead.utm_content} />
            </div>
            <Separator />
            <LeadActivities leadId={lead.id} />
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  // ── EDIT MODE ──
  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) { handleCancel(); onClose(); } }}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="flex-row items-center justify-between space-y-0 pr-2">
          <SheetTitle className="text-lg">Editando Lead</SheetTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleCancel} disabled={saving}>
              <X className="h-3.5 w-3.5 mr-1" />Cancelar
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              <Save className="h-3.5 w-3.5 mr-1" />{saving ? 'Salvando…' : 'Salvar'}
            </Button>
          </div>
        </SheetHeader>

        <div className="space-y-4 mt-4">
          {/* Contato */}
          <SectionTitle>Contato</SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            <EditField label="Nome">
              <Input value={form.nome ?? ''} onChange={e => set('nome', e.target.value)} className="h-9" />
            </EditField>
            <EditField label="E-mail">
              <Input value={form.email ?? ''} onChange={e => set('email', e.target.value)} className="h-9" />
            </EditField>
            <EditField label="WhatsApp">
              <Input value={form.whatsapp ?? ''} onChange={e => set('whatsapp', e.target.value)} className="h-9" />
            </EditField>
            <EditField label="Instagram">
              <Input value={form.instagram ?? ''} onChange={e => set('instagram', e.target.value)} className="h-9" />
            </EditField>
          </div>

          <Separator />

          {/* Pipeline */}
          <SectionTitle>Pipeline</SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            <EditField label="Status">
              <Select value={form.status ?? ''} onValueChange={v => set('status', v)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FUNNEL_STAGES.map(s => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </EditField>
            <div className="grid grid-cols-2 gap-2 pt-5">
              {([['MQL', 'mql'], ['SQL', 'sql_flag'], ['RA', 'ra_flag'], ['RR', 'rr_flag']] as const).map(([label, key]) => (
                <label key={key} className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <Switch checked={!!form[key]} onCheckedChange={v => set(key, v)} className="scale-75" />
                  {label}
                </label>
              ))}
            </div>
            <DatePickerField label="Último contato" value={form.data_ultimo_contato ?? null} onChange={v => set('data_ultimo_contato', v)} />
            <DatePickerField label="Próximo contato" value={form.data_proximo_contato ?? null} onChange={v => set('data_proximo_contato', v)} />
            <DatePickerField label="Reunião agendada" value={form.data_ra ?? null} onChange={v => set('data_ra', v)} />
            <DatePickerField label="Data de Entrada" value={(form as any).data_criada ?? null} onChange={v => setForm(prev => ({ ...prev, data_criada: v } as any))} />
            <EditField label="Produto">
              <Input value={form.produto ?? ''} onChange={e => set('produto', e.target.value)} className="h-9" />
            </EditField>
            <EditField label="Funil">
              <Input value={form.funil ?? ''} onChange={e => set('funil', e.target.value)} className="h-9" />
            </EditField>
          </div>

          <Separator />

          {/* Financeiro */}
          <SectionTitle>Financeiro</SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            <EditField label="Faturamento mensal">
              <Input value={form.faturamento_mensal ?? ''} onChange={e => set('faturamento_mensal', e.target.value)} className="h-9" />
            </EditField>
            <EditField label="Oportunidade (R$)">
              <Input type="number" value={form.oportunidade ?? ''} onChange={e => set('oportunidade', Number(e.target.value))} className="h-9" />
            </EditField>
            <EditField label="Arrecadado (R$)">
              <Input type="number" value={form.arrecadado ?? ''} onChange={e => set('arrecadado', Number(e.target.value))} className="h-9" />
            </EditField>
            <EditField label="Motivo de perda">
              <Input value={form.loss_reason ?? ''} onChange={e => set('loss_reason', e.target.value)} className="h-9" />
            </EditField>
          </div>

          <Separator />

          {/* Perfil */}
          <SectionTitle>Perfil do Lead</SectionTitle>
          <div className="space-y-3">
            <EditField label="Justificativa (dor/desafio)">
              <Input value={form.justificativa ?? ''} onChange={e => set('justificativa', e.target.value)} className="h-9" />
            </EditField>
            <EditField label="Objetivo">
              <Input value={form.objetivo ?? ''} onChange={e => set('objetivo', e.target.value)} className="h-9" />
            </EditField>
          </div>

          <Separator />

          {/* Origem */}
          <SectionTitle>Origem</SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            <EditField label="utm_source">
              <Input value={form.utm_source ?? ''} onChange={e => set('utm_source', e.target.value)} className="h-9" />
            </EditField>
            <EditField label="utm_medium">
              <Input value={form.utm_medium ?? ''} onChange={e => set('utm_medium', e.target.value)} className="h-9" />
            </EditField>
            <EditField label="utm_campaign">
              <Input value={form.utm_campaign ?? ''} onChange={e => set('utm_campaign', e.target.value)} className="h-9" />
            </EditField>
            <EditField label="utm_content">
              <Input value={form.utm_content ?? ''} onChange={e => set('utm_content', e.target.value)} className="h-9" />
            </EditField>
          </div>
          <Separator />
          <LeadActivities leadId={lead.id} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
