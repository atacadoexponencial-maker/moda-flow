import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { FileText, Phone, CalendarDays, ArrowRightLeft, Send } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Tables } from '@/integrations/supabase/types';

type Activity = Tables<'activities'>;

const TYPE_CONFIG: Record<string, { icon: React.ElementType; label: string }> = {
  note: { icon: FileText, label: 'Nota' },
  call: { icon: Phone, label: 'Ligação' },
  meeting: { icon: CalendarDays, label: 'Reunião' },
  status_change: { icon: ArrowRightLeft, label: 'Mudança' },
};

const CREATABLE_TYPES = [
  { value: 'note', label: 'Nota' },
  { value: 'call', label: 'Ligação' },
  { value: 'meeting', label: 'Reunião' },
];

export function LeadActivities({ leadId }: { leadId: string }) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [newType, setNewType] = useState('note');
  const [newContent, setNewContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchActivities = async () => {
    const { data } = await supabase
      .from('activities')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false });
    setActivities(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    fetchActivities();
  }, [leadId]);

  const handleSubmit = async () => {
    if (!newContent.trim()) return;
    setSubmitting(true);
    const { error } = await supabase.from('activities').insert({
      lead_id: leadId,
      type: newType,
      content: newContent.trim(),
    });
    setSubmitting(false);
    if (error) {
      toast.error('Erro ao registrar atividade');
      return;
    }
    toast.success('Atividade registrada');
    setNewContent('');
    fetchActivities();
  };

  return (
    <div className="space-y-3">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground pt-2">Atividades</h4>

      {/* New activity form */}
      <div className="flex gap-2">
        <Select value={newType} onValueChange={setNewType}>
          <SelectTrigger className="w-28 h-9 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CREATABLE_TYPES.map(t => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          placeholder="Descreva a atividade…"
          value={newContent}
          onChange={e => setNewContent(e.target.value)}
          className="h-9 text-sm flex-1"
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
        />
        <Button size="sm" className="h-9 px-3" onClick={handleSubmit} disabled={submitting || !newContent.trim()}>
          <Send className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Activity list */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2].map(i => <div key={i} className="h-12 rounded bg-muted animate-pulse" />)}
        </div>
      ) : activities.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-3">Nenhuma atividade registrada.</p>
      ) : (
        <div className="space-y-1.5 max-h-64 overflow-y-auto">
          {activities.map(act => {
            const cfg = TYPE_CONFIG[act.type ?? 'note'] ?? TYPE_CONFIG.note;
            const Icon = cfg.icon;
            return (
              <div key={act.id} className="flex gap-2.5 p-2 rounded-md bg-muted/50 hover:bg-muted transition-colors">
                <div className="mt-0.5 shrink-0">
                  <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground leading-snug">{act.content}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-muted-foreground">
                      {formatDistanceToNow(parseISO(act.created_at), { addSuffix: true, locale: ptBR })}
                    </span>
                    <span className="text-[10px] text-muted-foreground">· {cfg.label}</span>
                    {act.created_by && <span className="text-[10px] text-muted-foreground">· {act.created_by}</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
