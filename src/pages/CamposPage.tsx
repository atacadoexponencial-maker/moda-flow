import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Pencil, Trash2, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

export type FieldDef = {
  id: string;
  key: string;
  label: string;
  field_type: 'text' | 'number' | 'date' | 'boolean' | 'select';
  options: string[] | null;
  visible: boolean;
  sort_order: number;
  is_system: boolean;
  created_at: string;
};

type FieldType = FieldDef['field_type'];

const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: 'Texto',
  number: 'Número',
  date: 'Data',
  boolean: 'Booleano',
  select: 'Seleção',
};

const EMPTY_FORM = { label: '', field_type: 'text' as FieldType, options: [] as string[] };

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 50);
}

async function fetchFieldDefs(): Promise<FieldDef[]> {
  const { data, error } = await (supabase as any)
    .from('lead_field_definitions')
    .select('*')
    .order('sort_order');
  if (error) throw error;
  return data ?? [];
}

export default function CamposPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: fields = [], isLoading } = useQuery<FieldDef[]>({
    queryKey: ['lead-field-definitions'],
    queryFn: fetchFieldDefs,
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingField, setEditingField] = useState<FieldDef | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [optionInput, setOptionInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<FieldDef | null>(null);

  const systemFields = fields.filter(f => f.is_system);
  const customFields = fields.filter(f => !f.is_system);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['lead-field-definitions'] });

  const toggleVisible = async (field: FieldDef) => {
    const { error } = await (supabase as any)
      .from('lead_field_definitions')
      .update({ visible: !field.visible })
      .eq('id', field.id);
    if (error) {
      toast({ title: 'Erro ao atualizar campo', variant: 'destructive' });
      return;
    }
    invalidate();
  };

  const openNew = () => {
    setEditingField(null);
    setForm(EMPTY_FORM);
    setOptionInput('');
    setDialogOpen(true);
  };

  const openEdit = (field: FieldDef) => {
    setEditingField(field);
    setForm({ label: field.label, field_type: field.field_type, options: field.options ?? [] });
    setOptionInput('');
    setDialogOpen(true);
  };

  const addOption = () => {
    const val = optionInput.trim();
    if (!val || form.options.includes(val)) return;
    setForm(f => ({ ...f, options: [...f.options, val] }));
    setOptionInput('');
  };

  const removeOption = (opt: string) =>
    setForm(f => ({ ...f, options: f.options.filter(o => o !== opt) }));

  const handleSave = async () => {
    if (!form.label.trim()) return;
    setSaving(true);
    try {
      if (editingField) {
        const { error } = await (supabase as any)
          .from('lead_field_definitions')
          .update({
            label: form.label.trim(),
            field_type: form.field_type,
            options: form.field_type === 'select' ? form.options : null,
          })
          .eq('id', editingField.id);
        if (error) throw error;
      } else {
        const key = slugify(form.label);
        const maxOrder = fields.reduce((m, f) => Math.max(m, f.sort_order), -1);
        const { error } = await (supabase as any)
          .from('lead_field_definitions')
          .insert({
            key,
            label: form.label.trim(),
            field_type: form.field_type,
            options: form.field_type === 'select' ? form.options : null,
            visible: true,
            sort_order: maxOrder + 1,
            is_system: false,
          });
        if (error) throw error;
      }
      invalidate();
      setDialogOpen(false);
      toast({ title: editingField ? 'Campo atualizado' : 'Campo criado' });
    } catch {
      toast({ title: 'Erro ao salvar campo', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await (supabase as any)
      .from('lead_field_definitions')
      .delete()
      .eq('id', deleteTarget.id);
    if (error) {
      toast({ title: 'Erro ao deletar campo', variant: 'destructive' });
    } else {
      invalidate();
      toast({ title: 'Campo removido' });
    }
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/configuracoes')}>
          <ChevronLeft className="h-4 w-4 mr-1" />
          Configurações
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Campos do CRM</h2>
          <p className="text-muted-foreground mt-1">
            Gerencie os campos exibidos na tabela de leads e adicione campos personalizados.
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Campo
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-14 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Campos do sistema */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Campos do sistema</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 pt-0">
              {systemFields.map(field => (
                <div key={field.id} className="flex items-center gap-3 py-2.5 px-1 rounded hover:bg-muted/40">
                  <Switch
                    checked={field.visible}
                    onCheckedChange={() => toggleVisible(field)}
                  />
                  <span className="flex-1 text-sm font-medium">{field.label}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {FIELD_TYPE_LABELS[field.field_type]}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Campos personalizados */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Campos personalizados</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {customFields.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Nenhum campo personalizado criado ainda.
                </p>
              ) : (
                <div className="space-y-1">
                  {customFields.map(field => (
                    <div key={field.id} className="flex items-center gap-3 py-2.5 px-1 rounded hover:bg-muted/40">
                      <Switch
                        checked={field.visible}
                        onCheckedChange={() => toggleVisible(field)}
                      />
                      <span className="flex-1 text-sm font-medium">{field.label}</span>
                      <Badge variant="outline" className="text-[10px]">
                        {FIELD_TYPE_LABELS[field.field_type]}
                      </Badge>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(field)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget(field)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Dialog criar/editar campo */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingField ? 'Editar campo' : 'Novo campo personalizado'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Nome do campo</Label>
              <Input
                placeholder="Ex: Observações"
                value={form.label}
                onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select
                value={form.field_type}
                onValueChange={(v: FieldType) => setForm(f => ({ ...f, field_type: v, options: [] }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(FIELD_TYPE_LABELS) as [FieldType, string][]).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {form.field_type === 'select' && (
              <div className="space-y-1.5">
                <Label>Opções</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Adicionar opção…"
                    value={optionInput}
                    onChange={e => setOptionInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addOption(); } }}
                  />
                  <Button type="button" variant="outline" size="sm" onClick={addOption}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {form.options.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {form.options.map(opt => (
                      <Badge key={opt} variant="secondary" className="gap-1">
                        {opt}
                        <button onClick={() => removeOption(opt)} className="hover:text-destructive">
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving || !form.label.trim()}>
              {saving ? 'Salvando…' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog confirmar exclusão */}
      <Dialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Remover campo</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Tem certeza que deseja remover o campo <strong>{deleteTarget?.label}</strong>?
            Os dados armazenados nesse campo serão perdidos.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete}>Remover</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
