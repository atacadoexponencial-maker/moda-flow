import { useState, useEffect, useRef } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Copy, ExternalLink, Trash2, CalendarIcon } from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { FUNNEL_STAGES, NO_SHOW_REASONS, getStageLabel } from '@/lib/constants';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { LeadActivities } from '@/components/pipeline/LeadActivities';
import { LeadTouches } from '@/components/pipeline/LeadTouches';
import { useIsMobile } from '@/hooks/use-mobile';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { LeadConversation } from '@/components/whatsapp/LeadConversation';
import { useAuth } from '@/hooks/useAuth';
import { useTeamMembers } from '@/hooks/useTeamMembers';
import { displayName, canAssume, assignPatch, UNASSIGNED_LABEL } from '@/lib/team';
import { LOSS_REASONS, OTHER_LOSS_REASON, resolveLossReason, lossReasonSelectValue, lossReasonOtherText } from '@/lib/loss-reason';
import type { Tables, TablesUpdate } from '@/integrations/supabase/types';

type Lead = Tables<'leads'>;

function formatDate(d: string | null) {
  if (!d) return '—';
  return format(parseISO(d), 'dd/MM/yyyy', { locale: ptBR });
}

function formatCurrency(v: number | null) {
  if (!v) return 'R$ 0';
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 });
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

type StringLeadKey = {
  [K in keyof Lead]: Lead[K] extends string | null ? K : never
}[keyof Lead];

type NumberLeadKey = {
  [K in keyof Lead]: Lead[K] extends number | null ? K : never
}[keyof Lead];

interface InlineTextFieldProps {
  label: string;
  value: string | null;
  fieldKey: StringLeadKey;
  onSave: (key: StringLeadKey, value: string | null) => Promise<void>;
  saving: boolean;
}

function InlineTextField({ label, value, fieldKey, onSave, saving }: InlineTextFieldProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setDraft(value ?? ''); }, [value]);

  const startEdit = () => {
    setDraft(value ?? '');
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const commit = async () => {
    setEditing(false);
    const newVal = draft.trim() === '' ? null : draft.trim();
    if (newVal === (value ?? null)) return;
    await onSave(fieldKey, newVal);
  };

  const cancel = () => {
    setDraft(value ?? '');
    setEditing(false);
  };

  return (
    <div className="space-y-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') cancel(); }}
          className={cn(
            'w-full h-7 px-1.5 text-sm rounded border bg-background outline-none focus:ring-1 focus:ring-ring border-input',
            saving && 'cursor-wait border-primary'
          )}
          disabled={saving}
        />
      ) : (
        <div
          onClick={startEdit}
          className="text-sm text-foreground cursor-pointer hover:bg-muted/50 rounded px-1 -mx-1 min-h-[1.5rem] flex items-center"
          title="Clique para editar"
        >
          {value || <span className="text-muted-foreground/50 italic text-xs">—</span>}
        </div>
      )}
    </div>
  );
}

interface InlineNumberFieldProps {
  label: string;
  value: number | null;
  fieldKey: NumberLeadKey;
  onSave: (key: NumberLeadKey, value: number | null) => Promise<void>;
  saving: boolean;
  format?: (v: number | null) => string;
}

function InlineNumberField({ label, value, fieldKey, onSave, saving, format: fmt }: InlineNumberFieldProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value?.toString() ?? '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setDraft(value?.toString() ?? ''); }, [value]);

  const startEdit = () => {
    setDraft(value?.toString() ?? '');
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const commit = async () => {
    setEditing(false);
    const newVal = draft.trim() === '' ? null : Number(draft);
    if (newVal === value) return;
    await onSave(fieldKey, newVal);
  };

  const cancel = () => {
    setDraft(value?.toString() ?? '');
    setEditing(false);
  };

  const display = fmt ? fmt(value) : (value?.toString() ?? '—');

  return (
    <div className="space-y-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      {editing ? (
        <input
          ref={inputRef}
          type="number"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') cancel(); }}
          className={cn(
            'w-full h-7 px-1.5 text-sm rounded border bg-background outline-none focus:ring-1 focus:ring-ring border-input',
            saving && 'cursor-wait border-primary'
          )}
          disabled={saving}
        />
      ) : (
        <div
          onClick={startEdit}
          className="text-sm text-foreground cursor-pointer hover:bg-muted/50 rounded px-1 -mx-1 min-h-[1.5rem] flex items-center"
          title="Clique para editar"
        >
          {display}
        </div>
      )}
    </div>
  );
}

function DatePickerField({
  label,
  value,
  onSave,
}: {
  label: string;
  value: string | null;
  onSave: (v: string | null) => Promise<void>;
}) {
  const date = value ? parseISO(value) : undefined;
  return (
    <div className="space-y-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className={cn('w-full justify-start text-left font-normal h-7 px-1 -mx-1 hover:bg-muted/50 text-sm', !date && 'text-muted-foreground/50 italic text-xs')}>
            <CalendarIcon className="mr-2 h-3 w-3 shrink-0" />
            {date ? format(date, 'dd/MM/yyyy', { locale: ptBR }) : '—'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            onSelect={(d) => onSave(d ? format(d, 'yyyy-MM-dd') : null)}
            locale={ptBR}
            className={cn('p-3 pointer-events-auto')}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

interface LeadDetailPanelProps {
  lead: Lead | null;
  open: boolean;
  onClose: () => void;
  /** Aba inicial ao abrir (a caixa de entrada abre direto na Conversa). */
  initialTab?: 'dados' | 'conversa';
}

export function LeadDetailPanel({ lead, open, onClose, initialTab = 'dados' }: LeadDetailPanelProps) {
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const { data: members = [] } = useTeamMembers();
  const [localLead, setLocalLead] = useState<Lead | null>(lead);
  const [savingField, setSavingField] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  // No-show só é persistido depois que o motivo for escolhido
  const [noShowPending, setNoShowPending] = useState(false);
  // "Outro" no motivo de perda: a caixa de texto aparece antes de haver texto salvo
  const [lossOtherPending, setLossOtherPending] = useState(false);

  const [tab, setTab] = useState<'dados' | 'conversa'>(initialTab);
  const [unread, setUnread] = useState(0);

  useEffect(() => { setLocalLead(lead); setNoShowPending(false); setLossOtherPending(false); }, [lead]);
  useEffect(() => { if (open) setTab(initialTab); }, [open, lead?.id, initialTab]);

  if (!lead || !localLead) return null;

  const waLink = localLead.whatsapp ? `https://wa.me/${localLead.whatsapp.replace(/\D/g, '')}` : null;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['leads-pipeline'] });
    queryClient.invalidateQueries({ queryKey: ['leads-table'] });
  };

  const saveTextField = async (key: StringLeadKey, value: string | null) => {
    setSavingField(key);
    const { error } = await supabase.from('leads').update({ [key]: value } as TablesUpdate<'leads'>).eq('id', localLead.id);
    setSavingField(null);
    if (error) { toast.error('Erro ao salvar'); return; }
    setLocalLead(prev => prev ? { ...prev, [key]: value } : prev);
    invalidate();
  };

  const saveNumberField = async (key: NumberLeadKey, value: number | null) => {
    setSavingField(key);
    const { error } = await supabase.from('leads').update({ [key]: value } as TablesUpdate<'leads'>).eq('id', localLead.id);
    setSavingField(null);
    if (error) { toast.error('Erro ao salvar'); return; }
    setLocalLead(prev => prev ? { ...prev, [key]: value } : prev);
    invalidate();
  };

  const saveFlag = async (key: 'mql' | 'sql_flag' | 'ra_flag' | 'rr_flag', value: boolean) => {
    const patch: Partial<Lead> = { [key]: value };
    // Ao marcar RR, registra a data da realização (hoje) se ainda não houver
    if (key === 'rr_flag' && value && !localLead.data_rr) {
      patch.data_rr = format(new Date(), 'yyyy-MM-dd');
    }
    const { error } = await supabase.from('leads').update(patch).eq('id', localLead.id);
    if (error) { toast.error('Erro ao salvar'); return; }
    setLocalLead(prev => prev ? { ...prev, ...patch } : prev);
    invalidate();
  };

  const saveNoShow = async (patch: Partial<Lead>) => {
    const { error } = await supabase.from('leads').update(patch).eq('id', localLead.id);
    if (error) { toast.error('Erro ao salvar'); return; }
    setLocalLead(prev => prev ? { ...prev, ...patch } : prev);
    invalidate();
  };

  const toggleNoShow = (value: boolean) => {
    if (value) {
      // exige motivo antes de persistir
      setNoShowPending(true);
    } else {
      setNoShowPending(false);
      saveNoShow({ no_show: false, no_show_motivo: null });
    }
  };

  const saveNoShowReason = async (motivo: string) => {
    await saveNoShow({ no_show: true, no_show_motivo: motivo });
    setNoShowPending(false);
  };

  const saveStatus = async (value: string) => {
    const from = localLead.status;
    const { error } = await supabase.from('leads').update({ status: value }).eq('id', localLead.id);
    if (error) { toast.error('Erro ao salvar'); return; }
    // Mesmo registro de histórico feito pelo drag no pipeline
    const content = `Status alterado de ${getStageLabel(from)} para ${getStageLabel(value)}`;
    await supabase.from('activities').insert({ lead_id: localLead.id, type: 'status_change', content });
    setLocalLead(prev => prev ? { ...prev, status: value } : prev);
    invalidate();
  };

  const UNASSIGNED = '__none__';

  const saveLossReason = async (value: string | null) => {
    if ((localLead.loss_reason ?? null) === value) return;
    setSavingField('loss_reason');
    const { error } = await supabase.from('leads').update({ loss_reason: value }).eq('id', localLead.id);
    setSavingField(null);
    if (error) { toast.error('Erro ao salvar'); return; }
    setLocalLead(prev => prev ? { ...prev, loss_reason: value } : prev);
    invalidate();
  };

  const onLossReasonSelect = (selected: string) => {
    if (selected === OTHER_LOSS_REASON) {
      // mantém o texto livre já gravado (se houver) e abre a caixa de texto
      setLossOtherPending(true);
      return;
    }
    setLossOtherPending(false);
    const resolved = resolveLossReason(selected, '');
    if (resolved) saveLossReason(resolved);
  };

  const onLossOtherText = async (_key: StringLeadKey, text: string | null) => {
    const resolved = resolveLossReason(OTHER_LOSS_REASON, text);
    if (!resolved) return; // vazio: não grava nada até digitar
    await saveLossReason(resolved);
    setLossOtherPending(false);
  };

  const saveAssignedTo = async (value: string | null) => {
    if ((localLead.assigned_to ?? null) === value) return;
    setSavingField('assigned_to');
    const { error } = await supabase.from('leads').update({ assigned_to: value }).eq('id', localLead.id);
    setSavingField(null);
    if (error) { toast.error('Erro ao salvar'); return; }
    setLocalLead(prev => prev ? { ...prev, assigned_to: value } : prev);
    invalidate();
  };

  const saveDateField = async (key: StringLeadKey, value: string | null) => {
    const { error } = await supabase.from('leads').update({ [key]: value } as TablesUpdate<'leads'>).eq('id', localLead.id);
    if (error) { toast.error('Erro ao salvar'); return; }
    setLocalLead(prev => prev ? { ...prev, [key]: value } : prev);
    invalidate();
  };

  const handleDelete = async () => {
    setDeleting(true);
    const { error } = await supabase.from('leads').delete().eq('id', localLead.id);
    setDeleting(false);
    if (error) { toast.error('Erro ao excluir lead'); return; }
    toast.success('Lead excluído');
    invalidate();
    onClose();
  };

  const sheetSide = isMobile ? 'bottom' as const : 'right' as const;

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent
        side={sheetSide}
        className={cn(
          'overflow-y-auto',
          isMobile ? 'h-[100dvh] max-h-[100dvh] w-full rounded-none p-4 pb-8' : 'w-full sm:max-w-2xl'
        )}
      >
        <SheetHeader className="flex-row items-center justify-between space-y-0 pr-2">
          <SheetTitle className="text-lg">{localLead.nome}</SheetTitle>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30"
                disabled={deleting}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                {deleting ? 'Excluindo…' : 'Excluir'}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir lead?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação não pode ser desfeita. O lead <strong>{localLead.nome}</strong> e todas as suas atividades serão removidos permanentemente.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Excluir
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </SheetHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as 'dados' | 'conversa')} className="mt-3">
          <TabsList className="h-8">
            <TabsTrigger value="dados" className="text-xs px-3">Dados</TabsTrigger>
            <TabsTrigger value="conversa" className="text-xs px-3 gap-1.5">
              Conversa
              {unread > 0 && (
                <span className="inline-flex min-w-4 h-4 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] px-1" aria-label={`${unread} não lidas`}>
                  {unread}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="conversa" forceMount className="data-[state=inactive]:hidden mt-3">
            <LeadConversation
              leadId={localLead.id}
              leadFirstName={localLead.nome?.split(' ')[0]}
              active={open && tab === 'conversa'}
              onUnreadChange={setUnread}
            />
          </TabsContent>

          <TabsContent value="dados" className="mt-0">
        <div className="space-y-4 mt-4">
          {/* Contato */}
          <SectionTitle>Contato</SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            <InlineTextField label="Nome" value={localLead.nome} fieldKey="nome" onSave={saveTextField} saving={savingField === 'nome'} />
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground">E-mail</p>
              <div className="flex items-center">
                <InlineTextField label="" value={localLead.email} fieldKey="email" onSave={saveTextField} saving={savingField === 'email'} />
                {localLead.email && <CopyButton text={localLead.email} />}
              </div>
            </div>
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground">WhatsApp</p>
              {waLink ? (
                <div className="flex items-center gap-1">
                  <InlineTextField label="" value={localLead.whatsapp} fieldKey="whatsapp" onSave={saveTextField} saving={savingField === 'whatsapp'} />
                  <a href={waLink} target="_blank" rel="noopener noreferrer" className="text-accent shrink-0">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              ) : (
                <InlineTextField label="" value={localLead.whatsapp} fieldKey="whatsapp" onSave={saveTextField} saving={savingField === 'whatsapp'} />
              )}
            </div>
            <InlineTextField label="Instagram" value={localLead.instagram} fieldKey="instagram" onSave={saveTextField} saving={savingField === 'instagram'} />
          </div>

          <Separator />

          {/* Pipeline */}
          <SectionTitle>Pipeline</SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground">Status</p>
              <Select value={localLead.status ?? ''} onValueChange={saveStatus}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FUNNEL_STAGES.map(s => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground">Responsável</p>
              <div className="flex items-center gap-1.5">
                <Select
                  value={localLead.assigned_to ?? UNASSIGNED}
                  onValueChange={v => saveAssignedTo(v === UNASSIGNED ? null : v)}
                  disabled={savingField === 'assigned_to'}
                >
                  <SelectTrigger className="h-8 text-sm flex-1">
                    <SelectValue placeholder={UNASSIGNED_LABEL} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={UNASSIGNED}>{UNASSIGNED_LABEL}</SelectItem>
                    {members.map(m => (
                      <SelectItem key={m.user_id} value={m.user_id}>{displayName(m.email)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {canAssume(localLead, user?.id) && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs shrink-0"
                    onClick={() => user && saveAssignedTo(assignPatch(user.id).assigned_to)}
                    disabled={savingField === 'assigned_to'}
                  >
                    Assumir
                  </Button>
                )}
              </div>
            </div>
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground">Qualificação</p>
              <div className="flex items-center gap-2 flex-wrap pt-1">
                {([['MQL', 'mql'], ['SQL', 'sql_flag'], ['RA', 'ra_flag'], ['RR', 'rr_flag']] as const).map(([lbl, key]) => (
                  <label key={key} className="flex items-center gap-1 text-xs cursor-pointer">
                    <Switch
                      checked={!!localLead[key]}
                      onCheckedChange={v => saveFlag(key, v)}
                      className="scale-75"
                    />
                    {lbl}
                  </label>
                ))}
              </div>
            </div>
            <DatePickerField
              label="Último contato"
              value={localLead.data_ultimo_contato ?? null}
              onSave={v => saveDateField('data_ultimo_contato', v)}
            />
            <DatePickerField
              label="Próximo contato"
              value={localLead.data_proximo_contato ?? null}
              onSave={v => saveDateField('data_proximo_contato', v)}
            />
            <DatePickerField
              label="Reunião agendada"
              value={localLead.data_ra ?? null}
              onSave={v => saveDateField('data_ra', v)}
            />
            <DatePickerField
              label="Reunião realizada"
              value={localLead.data_rr ?? null}
              onSave={v => saveDateField('data_rr', v)}
            />
            <div className="space-y-0.5 col-span-2">
              <p className="text-xs text-muted-foreground">No-show</p>
              <div className="flex items-center gap-3 flex-wrap pt-1">
                <label className="flex items-center gap-1 text-xs cursor-pointer">
                  <Switch
                    checked={!!localLead.no_show || noShowPending}
                    onCheckedChange={toggleNoShow}
                    className="scale-75"
                  />
                  Faltou à reunião
                </label>
                {(localLead.no_show || noShowPending) && (
                  <Select
                    value={
                      localLead.no_show_motivo
                        ? (NO_SHOW_REASONS as readonly string[]).includes(localLead.no_show_motivo)
                          ? localLead.no_show_motivo
                          : 'Outro'
                        : undefined
                    }
                    onValueChange={saveNoShowReason}
                  >
                    <SelectTrigger className="h-8 text-sm w-[220px]">
                      <SelectValue placeholder="Escolha o motivo…" />
                    </SelectTrigger>
                    <SelectContent>
                      {NO_SHOW_REASONS.map(r => (
                        <SelectItem key={r} value={r}>{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {(localLead.no_show || noShowPending) &&
                  (localLead.no_show_motivo === 'Outro' ||
                    (localLead.no_show_motivo && !(NO_SHOW_REASONS as readonly string[]).includes(localLead.no_show_motivo))) && (
                  <div className="flex-1 min-w-[180px]">
                    <InlineTextField
                      label=""
                      value={localLead.no_show_motivo === 'Outro' ? null : localLead.no_show_motivo}
                      fieldKey="no_show_motivo"
                      onSave={saveTextField}
                      saving={savingField === 'no_show_motivo'}
                    />
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground">Data de Entrada</p>
              <div className="text-sm text-foreground">{formatDate(localLead.data_criada ?? localLead.created_at?.slice(0, 10))}</div>
            </div>
            <InlineTextField label="Produto" value={localLead.produto} fieldKey="produto" onSave={saveTextField} saving={savingField === 'produto'} />
            <InlineTextField label="Funil" value={localLead.funil} fieldKey="funil" onSave={saveTextField} saving={savingField === 'funil'} />
          </div>

          <Separator />

          {/* Financeiro */}
          <SectionTitle>Financeiro</SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            <InlineTextField label="Faturamento mensal" value={localLead.faturamento_mensal} fieldKey="faturamento_mensal" onSave={saveTextField} saving={savingField === 'faturamento_mensal'} />
            <InlineNumberField label="Oportunidade (R$)" value={localLead.oportunidade} fieldKey="oportunidade" onSave={saveNumberField} saving={savingField === 'oportunidade'} format={formatCurrency} />
            <InlineNumberField label="Arrecadado (R$)" value={localLead.arrecadado} fieldKey="arrecadado" onSave={saveNumberField} saving={savingField === 'arrecadado'} format={formatCurrency} />
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground">Motivo de perda</p>
              <Select
                value={lossOtherPending ? OTHER_LOSS_REASON : lossReasonSelectValue(localLead.loss_reason)}
                onValueChange={onLossReasonSelect}
                disabled={savingField === 'loss_reason'}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  {LOSS_REASONS.map(r => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(lossOtherPending || lossReasonSelectValue(localLead.loss_reason) === OTHER_LOSS_REASON) && (
                <InlineTextField
                  label=""
                  value={lossReasonOtherText(localLead.loss_reason) || null}
                  fieldKey="loss_reason"
                  onSave={onLossOtherText}
                  saving={savingField === 'loss_reason'}
                />
              )}
            </div>
          </div>

          <Separator />

          {/* Perfil */}
          <SectionTitle>Perfil do Lead</SectionTitle>
          <div className="space-y-3">
            <InlineTextField label="Justificativa (dor/desafio)" value={localLead.justificativa} fieldKey="justificativa" onSave={saveTextField} saving={savingField === 'justificativa'} />
            <InlineTextField label="Objetivo" value={localLead.objetivo} fieldKey="objetivo" onSave={saveTextField} saving={savingField === 'objetivo'} />
          </div>

          <Separator />

          {/* Origem */}
          <SectionTitle>Origem</SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            <InlineTextField label="utm_source" value={localLead.utm_source} fieldKey="utm_source" onSave={saveTextField} saving={savingField === 'utm_source'} />
            <InlineTextField label="utm_medium" value={localLead.utm_medium} fieldKey="utm_medium" onSave={saveTextField} saving={savingField === 'utm_medium'} />
            <InlineTextField label="utm_campaign" value={localLead.utm_campaign} fieldKey="utm_campaign" onSave={saveTextField} saving={savingField === 'utm_campaign'} />
            <InlineTextField label="utm_content" value={localLead.utm_content} fieldKey="utm_content" onSave={saveTextField} saving={savingField === 'utm_content'} />
          </div>

          <Separator />

          {/* Jornada (touches) */}
          <LeadTouches leadId={localLead.id} />

          <Separator />

          <LeadActivities leadId={localLead.id} />
        </div>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
