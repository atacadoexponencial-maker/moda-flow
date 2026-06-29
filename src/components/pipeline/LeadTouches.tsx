import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Tables } from '@/integrations/supabase/types';

type Touch = Tables<'lead_touches'>;

export function LeadTouches({ leadId }: { leadId: string }) {
  const [touches, setTouches] = useState<Touch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const fetchTouches = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('lead_touches')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: true });
      if (active) {
        setTouches(data ?? []);
        setLoading(false);
      }
    };
    fetchTouches();
    return () => { active = false; };
  }, [leadId]);

  const novos = touches.filter(t => t.is_aquisicao).length;
  const retornos = touches.length - novos;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between pt-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Jornada (touches)</h4>
        {!loading && touches.length > 0 && (
          <span className="text-[10px] text-muted-foreground">
            {novos} aquisição{novos === 1 ? '' : 's'} · {retornos} retorno{retornos === 1 ? '' : 's'}
          </span>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2].map(i => <div key={i} className="h-12 rounded bg-muted animate-pulse" />)}
        </div>
      ) : touches.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-3">Nenhum touch registrado.</p>
      ) : (
        <div className="space-y-0 max-h-72 overflow-y-auto">
          {touches.map((t, i) => {
            const isFirst = i === 0;
            const campanha = t.utm_campaign || t.meta_campaign_id;
            return (
              <div key={t.id} className="flex gap-3">
                {/* trilha da timeline */}
                <div className="flex flex-col items-center">
                  <div className={`h-2.5 w-2.5 rounded-full mt-1.5 shrink-0 ${t.is_aquisicao ? 'bg-emerald-500' : 'bg-muted-foreground/40'}`} />
                  {i < touches.length - 1 && <div className="w-px flex-1 bg-border my-0.5" />}
                </div>
                {/* conteúdo */}
                <div className="flex-1 min-w-0 pb-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-foreground">{t.funil || '—'}</span>
                    {t.is_aquisicao ? (
                      <Badge className="text-[10px] bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/15">Aquisição</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px]">Retorno</Badge>
                    )}
                    {isFirst && <Badge variant="secondary" className="text-[10px]">Origem</Badge>}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-[10px] text-muted-foreground">
                      {format(parseISO(t.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </span>
                    {campanha && <span className="text-[10px] text-muted-foreground truncate">· {campanha}</span>}
                    {t.utm_source && <span className="text-[10px] text-muted-foreground">· {t.utm_source}</span>}
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
