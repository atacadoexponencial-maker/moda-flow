import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Bookmark, BookmarkPlus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useSavedViews } from '@/hooks/useSavedViews';
import type { LeadsFilterState } from '@/components/leads/LeadsFilters';
import {
  builtInViews, isBuiltInView, lastViewKey, readLastView, rememberLastView, normalizeViewName, type ViewPage,
} from '@/lib/saved-views';

interface Props {
  page: ViewPage;
  filters: LeadsFilterState;
  funis: string[];
  onApply: (filters: LeadsFilterState) => void;
}

const NONE = '__none__';

export function SavedViewsSelect({ page, filters, funis, onApply }: Props) {
  const { user } = useAuth();
  const { views: mine, isLoading, save, rename, remove } = useSavedViews(page);
  const [selected, setSelected] = useState<string>(NONE);
  const [dialog, setDialog] = useState<'save' | 'rename' | null>(null);
  const [nameDraft, setNameDraft] = useState('');
  const restored = useRef(false);

  const builtIns = useMemo(() => builtInViews(funis), [funis]);
  const all = useMemo(() => [...builtIns, ...mine], [builtIns, mine]);

  const storageKey = user ? lastViewKey(user.id, page) : null;

  // Reabre a última visão usada (uma vez, quando as visões próprias carregarem)
  useEffect(() => {
    if (restored.current || !storageKey || isLoading) return;
    restored.current = true;
    const last = readLastView(window.localStorage, storageKey);
    if (!last) return;
    const v = all.find(x => x.id === last);
    if (v) { setSelected(v.id); onApply(v.filters); }
  }, [storageKey, isLoading, all, onApply]);

  const applyView = (id: string) => {
    setSelected(id);
    if (storageKey) rememberLastView(window.localStorage, storageKey, id === NONE ? null : id);
    if (id === NONE) return;
    const v = all.find(x => x.id === id);
    if (v) onApply(v.filters);
  };

  const current = all.find(x => x.id === selected);
  const canEdit = !!current && !isBuiltInView(current.id);

  const submit = async () => {
    const name = normalizeViewName(nameDraft);
    if (!name) { toast.error('Dê um nome de até 60 caracteres'); return; }
    try {
      if (dialog === 'save') {
        const id = await save.mutateAsync({ name, filters });
        toast.success('Visão salva');
        applyView(id);
      } else if (dialog === 'rename' && current) {
        await rename.mutateAsync({ id: current.id, name });
        toast.success('Visão renomeada');
      }
      setDialog(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      toast.error(msg.includes('duplicate') ? 'Já existe uma visão com esse nome' : 'Erro ao salvar visão');
    }
  };

  const onDelete = async () => {
    if (!current || !canEdit) return;
    try {
      await remove.mutateAsync(current.id);
      toast.success('Visão excluída');
      applyView(NONE);
    } catch {
      toast.error('Erro ao excluir visão');
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      <Select value={selected} onValueChange={applyView}>
        <SelectTrigger className="h-9 w-[200px] text-xs" aria-label="Visões salvas">
          <Bookmark className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
          <SelectValue placeholder="Visões" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>Sem visão</SelectItem>
          <SelectSeparator />
          <SelectGroup>
            <SelectLabel>Prontas</SelectLabel>
            {builtIns.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
          </SelectGroup>
          {mine.length > 0 && (
            <>
              <SelectSeparator />
              <SelectGroup>
                <SelectLabel>Minhas</SelectLabel>
                {mine.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
              </SelectGroup>
            </>
          )}
        </SelectContent>
      </Select>

      <Button variant="outline" size="sm" className="h-9" title="Salvar filtros atuais como visão" onClick={() => { setNameDraft(''); setDialog('save'); }}>
        <BookmarkPlus className="h-3.5 w-3.5" />
      </Button>
      {canEdit && (
        <>
          <Button variant="ghost" size="sm" className="h-9 px-2" title="Renomear visão" onClick={() => { setNameDraft(current!.name); setDialog('rename'); }}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" className="h-9 px-2 text-muted-foreground hover:text-destructive" title="Excluir visão" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </>
      )}

      <Dialog open={dialog !== null} onOpenChange={o => { if (!o) setDialog(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{dialog === 'rename' ? 'Renomear visão' : 'Salvar visão'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="view-name">Nome</Label>
            <Input
              id="view-name"
              value={nameDraft}
              onChange={e => setNameDraft(e.target.value)}
              placeholder="Ex.: Workshop quente"
              maxLength={60}
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') submit(); }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Cancelar</Button>
            <Button onClick={submit} disabled={save.isPending || rename.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
