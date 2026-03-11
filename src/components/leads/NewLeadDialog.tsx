import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { FUNNEL_STAGES } from '@/lib/constants';

const FATURAMENTO_OPTIONS = [
  'Menos de R$ 20 mil',
  'R$ 20 mil – R$ 50 mil',
  'R$ 50 mil – R$ 100 mil',
  'R$ 100 mil – R$ 300 mil',
  'Acima de R$ 300 mil',
];

export function NewLeadDialog() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    nome: '',
    email: '',
    whatsapp: '',
    instagram: '',
    status: 'leads_entrada',
    faturamento_mensal: '',
    oportunidade: 0,
    mql: false,
    sql_flag: false,
  });

  const set = (key: string, val: string | number) => setForm(prev => ({ ...prev, [key]: val }));

  const handleSave = async () => {
    if (!form.nome.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }
    setSaving(true);
    const today = new Date().toISOString().slice(0, 10);
    const { error } = await supabase.from('leads').insert({
      nome: form.nome.trim(),
      email: form.email || null,
      whatsapp: form.whatsapp || null,
      instagram: form.instagram || null,
      status: form.status,
      faturamento_mensal: form.faturamento_mensal || null,
      oportunidade: form.oportunidade || 0,
      data_criada: today,
    });
    setSaving(false);
    if (error) {
      toast.error('Erro ao criar lead');
      return;
    }
    toast.success('Lead criado com sucesso');
    setOpen(false);
    setForm({ nome: '', email: '', whatsapp: '', instagram: '', status: 'leads_entrada', faturamento_mensal: '', oportunidade: 0 });
    queryClient.invalidateQueries({ queryKey: ['leads-table'] });
    queryClient.invalidateQueries({ queryKey: ['leads-pipeline'] });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Novo Lead
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo Lead</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Nome *</Label>
            <Input value={form.nome} onChange={e => set('nome', e.target.value)} placeholder="Nome do lead" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>E-mail</Label>
              <Input value={form.email} onChange={e => set('email', e.target.value)} placeholder="email@exemplo.com" />
            </div>
            <div className="space-y-1.5">
              <Label>WhatsApp</Label>
              <Input value={form.whatsapp} onChange={e => set('whatsapp', e.target.value)} placeholder="+5511999999999" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Instagram</Label>
              <Input value={form.instagram} onChange={e => set('instagram', e.target.value)} placeholder="@perfil" />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => set('status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FUNNEL_STAGES.map(s => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Faturamento Mensal</Label>
              <Input value={form.faturamento_mensal} onChange={e => set('faturamento_mensal', e.target.value)} placeholder="Ex: Menos de 20 Mil" />
            </div>
            <div className="space-y-1.5">
              <Label>Oportunidade (R$)</Label>
              <Input type="number" value={form.oportunidade || ''} onChange={e => set('oportunidade', Number(e.target.value))} placeholder="0" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Salvando…' : 'Criar Lead'}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
