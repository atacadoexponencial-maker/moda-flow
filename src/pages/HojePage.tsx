import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ExternalLink, Eye, Phone, CalendarClock, AlertTriangle, CalendarDays } from 'lucide-react';
import { format, differenceInDays, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getStageLabel } from '@/lib/constants';
import { LeadDetailPanel } from '@/components/pipeline/LeadDetailPanel';
import type { Tables } from '@/integrations/supabase/types';

type Lead = Tables<'leads'>;

const today = () => format(new Date(), 'yyyy-MM-dd');

function LeadRow({ lead, onView }: { lead: Lead; onView: () => void; badge?: React.ReactNode }) {
  const waLink = lead.whatsapp ? `https://wa.me/${lead.whatsapp.replace(/\D/g, '')}` : null;

  return (
    <div className="flex items-center justify-between gap-3 py-2.5 px-3 rounded-md hover:bg-muted/50 transition-colors">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{lead.nome}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <Badge variant="secondary" className="text-[10px]">{getStageLabel(lead.status)}</Badge>
          {lead.data_proximo_contato && (
            <span className="text-[10px] text-muted-foreground">
              {format(parseISO(lead.data_proximo_contato), 'dd/MM', { locale: ptBR })}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {waLink && (
          <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
            <a href={waLink} target="_blank" rel="noopener noreferrer">
              <Phone className="h-3.5 w-3.5" />
            </a>
          </Button>
        )}
        <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={onView}>
          <Eye className="h-3.5 w-3.5 mr-1" />Ver
        </Button>
      </div>
    </div>
  );
}

function OverdueRow({ lead, onView }: { lead: Lead; onView: () => void }) {
  const days = differenceInDays(new Date(), parseISO(lead.data_proximo_contato!));
  const waLink = lead.whatsapp ? `https://wa.me/${lead.whatsapp.replace(/\D/g, '')}` : null;

  return (
    <div className="flex items-center justify-between gap-3 py-2.5 px-3 rounded-md hover:bg-muted/50 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-foreground truncate">{lead.nome}</p>
          <Badge variant="destructive" className="text-[10px] shrink-0">
            {days}d atrás
          </Badge>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <Badge variant="secondary" className="text-[10px]">{getStageLabel(lead.status)}</Badge>
          <span className="text-[10px] text-muted-foreground">
            {format(parseISO(lead.data_proximo_contato!), 'dd/MM', { locale: ptBR })}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {waLink && (
          <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
            <a href={waLink} target="_blank" rel="noopener noreferrer">
              <Phone className="h-3.5 w-3.5" />
            </a>
          </Button>
        )}
        <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={onView}>
          <Eye className="h-3.5 w-3.5 mr-1" />Ver
        </Button>
      </div>
    </div>
  );
}

export default function HojePage() {
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const todayStr = today();

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['leads-hoje', todayStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .or(`data_proximo_contato.lte.${todayStr},and(data_ra.eq.${todayStr},ra_flag.eq.true)`)
        .not('data_proximo_contato', 'is', null);

      if (error) throw error;

      // Also fetch leads with ra for today separately (in case data_proximo_contato is null)
      const { data: raLeads, error: raErr } = await supabase
        .from('leads')
        .select('*')
        .eq('data_ra', todayStr)
        .eq('ra_flag', true)
        .is('data_proximo_contato', null);

      if (raErr) throw raErr;

      const map = new Map<string, Lead>();
      [...(data ?? []), ...(raLeads ?? [])].forEach(l => map.set(l.id, l));
      return Array.from(map.values());
    },
  });

  const overdue = useMemo(() =>
    leads
      .filter(l => l.data_proximo_contato && l.data_proximo_contato < todayStr)
      .sort((a, b) => (a.data_proximo_contato! < b.data_proximo_contato! ? -1 : 1)),
    [leads, todayStr]
  );

  const forToday = useMemo(() =>
    leads.filter(l => l.data_proximo_contato === todayStr),
    [leads, todayStr]
  );

  const meetings = useMemo(() =>
    leads.filter(l => l.data_ra === todayStr && l.ra_flag),
    [leads, todayStr]
  );

  const isEmpty = overdue.length === 0 && forToday.length === 0 && meetings.length === 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Hoje</h2>
        <p className="text-sm text-muted-foreground">
          {format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })}
        </p>
      </div>

      {isEmpty ? (
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-lg text-muted-foreground">Nenhum follow-up pendente hoje 🎉</p>
            <p className="text-sm text-muted-foreground mt-1">Todos os contatos estão em dia.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Atrasados */}
          {overdue.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  Atrasados
                  <Badge variant="destructive" className="ml-1">{overdue.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-0.5">
                {overdue.map(lead => (
                  <OverdueRow key={lead.id} lead={lead} onView={() => setSelectedLead(lead)} />
                ))}
              </CardContent>
            </Card>
          )}

          {/* Para hoje */}
          {forToday.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <CalendarClock className="h-4 w-4 text-primary" />
                  Para hoje
                  <Badge className="ml-1">{forToday.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-0.5">
                {forToday.map(lead => (
                  <LeadRow key={lead.id} lead={lead} onView={() => setSelectedLead(lead)} />
                ))}
              </CardContent>
            </Card>
          )}

          {/* Reuniões */}
          {meetings.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-primary" />
                  Reuniões de hoje
                  <Badge className="ml-1">{meetings.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-0.5">
                {meetings.map(lead => (
                  <LeadRow key={lead.id} lead={lead} onView={() => setSelectedLead(lead)} />
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}

      <LeadDetailPanel lead={selectedLead} open={!!selectedLead} onClose={() => setSelectedLead(null)} />
    </div>
  );
}
