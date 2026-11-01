import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { FileText, Phone, CalendarDays, ArrowRightLeft, Send, UserCheck, Paperclip, X, File as FileIcon } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Tables } from '@/integrations/supabase/types';
import {
  ATTACHMENTS_BUCKET,
  ALLOWED_ATTACHMENT_MIME,
  MAX_ATTACHMENTS_PER_ACTIVITY,
  validateAttachments,
  canSubmitActivity,
  isImageMime,
  formatBytes,
  buildAttachmentPath,
} from '@/lib/attachments';

type Activity = Tables<'activities'>;
type Attachment = Tables<'activity_attachments'>;

const TYPE_CONFIG: Record<string, { icon: React.ElementType; label: string }> = {
  note: { icon: FileText, label: 'Nota' },
  call: { icon: Phone, label: 'Ligação' },
  meeting: { icon: CalendarDays, label: 'Reunião' },
  status_change: { icon: ArrowRightLeft, label: 'Mudança' },
  assignment: { icon: UserCheck, label: 'Responsável' },
};

const CREATABLE_TYPES = [
  { value: 'note', label: 'Nota' },
  { value: 'call', label: 'Ligação' },
  { value: 'meeting', label: 'Reunião' },
];

const SIGNED_URL_SECONDS = 60 * 60;

export function LeadActivities({ leadId }: { leadId: string }) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [newType, setNewType] = useState('note');
  const [newContent, setNewContent] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [preview, setPreview] = useState<{ url: string; name: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchActivities = useCallback(async () => {
    const [{ data: acts }, { data: atts }] = await Promise.all([
      supabase.from('activities').select('*').eq('lead_id', leadId).order('created_at', { ascending: false }),
      supabase.from('activity_attachments').select('*').eq('lead_id', leadId).order('created_at', { ascending: true }),
    ]);
    setActivities(acts ?? []);
    const list = atts ?? [];
    setAttachments(list);
    if (list.length > 0) {
      const { data: signed } = await supabase.storage
        .from(ATTACHMENTS_BUCKET)
        .createSignedUrls(list.map(a => a.path), SIGNED_URL_SECONDS);
      const map: Record<string, string> = {};
      for (const s of signed ?? []) {
        if (s.path && s.signedUrl) map[s.path] = s.signedUrl;
      }
      setSignedUrls(map);
    } else {
      setSignedUrls({});
    }
    setLoading(false);
  }, [leadId]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  const addFiles = (incoming: FileList | File[] | null) => {
    if (!incoming) return;
    const { accepted, rejected } = validateAttachments(files.length, Array.from(incoming));
    for (const r of rejected) toast.error(`${r.name}: ${r.reason}`);
    if (accepted.length) setFiles(prev => [...prev, ...accepted]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (idx: number) => setFiles(prev => prev.filter((_, i) => i !== idx));

  const handleSubmit = async () => {
    const text = newContent.trim();
    if (!canSubmitActivity(text, files.length)) return;
    setSubmitting(true);

    const { data: created, error } = await supabase
      .from('activities')
      .insert({ lead_id: leadId, type: newType, content: text || null })
      .select('id')
      .single();
    if (error || !created) {
      setSubmitting(false);
      toast.error('Erro ao registrar atividade');
      return;
    }

    let failed = 0;
    if (files.length > 0) {
      setProgress({ done: 0, total: files.length });
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        const path = buildAttachmentPath(leadId, created.id, f.name, crypto.randomUUID().slice(0, 8));
        const up = await supabase.storage.from(ATTACHMENTS_BUCKET).upload(path, f, { contentType: f.type, upsert: false });
        if (up.error) { failed++; setProgress({ done: i + 1, total: files.length }); continue; }
        const row = await supabase.from('activity_attachments').insert({
          activity_id: created.id, lead_id: leadId, path, name: f.name, mime: f.type, size: f.size,
        });
        if (row.error) {
          failed++;
          await supabase.storage.from(ATTACHMENTS_BUCKET).remove([path]);
        }
        setProgress({ done: i + 1, total: files.length });
      }
      setProgress(null);
    }

    setSubmitting(false);
    if (failed > 0) toast.error(`${failed} arquivo(s) não puderam ser anexados`);
    else toast.success('Atividade registrada');
    setNewContent('');
    setFiles([]);
    fetchActivities();
  };

  const attachmentsOf = (activityId: string) => attachments.filter(a => a.activity_id === activityId);

  return (
    <div className="space-y-3">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground pt-2">Atividades</h4>

      {/* New activity form */}
      <div
        className="space-y-2"
        onDragOver={e => { e.preventDefault(); }}
        onDrop={e => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
      >
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
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ALLOWED_ATTACHMENT_MIME.join(',')}
            className="hidden"
            onChange={e => addFiles(e.target.files)}
            data-testid="activity-file-input"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 px-3"
            title={`Anexar arquivos (até ${MAX_ATTACHMENTS_PER_ACTIVITY})`}
            onClick={() => fileInputRef.current?.click()}
            disabled={submitting || files.length >= MAX_ATTACHMENTS_PER_ACTIVITY}
          >
            <Paperclip className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            className="h-9 px-3"
            onClick={handleSubmit}
            disabled={submitting || !canSubmitActivity(newContent, files.length)}
          >
            <Send className="h-3.5 w-3.5" />
          </Button>
        </div>

        {files.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {files.map((f, i) => (
              <span key={`${f.name}-${i}`} className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-[11px] text-foreground">
                {isImageMime(f.type) ? <Paperclip className="h-3 w-3" /> : <FileIcon className="h-3 w-3" />}
                <span className="max-w-[160px] truncate">{f.name}</span>
                <span className="text-muted-foreground">{formatBytes(f.size)}</span>
                <button type="button" onClick={() => removeFile(i)} className="text-muted-foreground hover:text-foreground" aria-label={`Remover ${f.name}`}>
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        {progress && (
          <p className="text-[11px] text-muted-foreground">Enviando anexos… {progress.done}/{progress.total}</p>
        )}
      </div>

      {/* Activity list */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2].map(i => <div key={i} className="h-12 rounded bg-muted animate-pulse" />)}
        </div>
      ) : activities.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-3">Nenhuma atividade registrada.</p>
      ) : (
        <div className="space-y-1.5 max-h-80 overflow-y-auto">
          {activities.map(act => {
            const cfg = TYPE_CONFIG[act.type ?? 'note'] ?? TYPE_CONFIG.note;
            const Icon = cfg.icon;
            const atts = attachmentsOf(act.id);
            return (
              <div key={act.id} className="flex gap-2.5 p-2 rounded-md bg-muted/50 hover:bg-muted transition-colors">
                <div className="mt-0.5 shrink-0">
                  <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  {act.content && <p className="text-sm text-foreground leading-snug">{act.content}</p>}
                  {atts.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {atts.map(a => {
                        const url = signedUrls[a.path];
                        if (isImageMime(a.mime)) {
                          return (
                            <button
                              key={a.id}
                              type="button"
                              onClick={() => url && setPreview({ url, name: a.name })}
                              className="h-16 w-16 rounded-md overflow-hidden border bg-background hover:opacity-90"
                              title={a.name}
                            >
                              {url ? <img src={url} alt={a.name} className="h-full w-full object-cover" /> : <span className="text-[10px]">…</span>}
                            </button>
                          );
                        }
                        return (
                          <a
                            key={a.id}
                            href={url ?? '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-md border bg-background px-2 py-1 text-[11px] hover:bg-muted"
                          >
                            <FileIcon className="h-3 w-3" />
                            <span className="max-w-[180px] truncate">{a.name}</span>
                            <span className="text-muted-foreground">{formatBytes(a.size)}</span>
                          </a>
                        );
                      })}
                    </div>
                  )}
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

      <Dialog open={!!preview} onOpenChange={o => { if (!o) setPreview(null); }}>
        <DialogContent className="max-w-3xl p-2">
          <DialogTitle className="sr-only">{preview?.name ?? 'Anexo'}</DialogTitle>
          {preview && <img src={preview.url} alt={preview.name} className="max-h-[80vh] w-full object-contain rounded" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
