import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { getStageLabel } from '@/lib/constants';

const LOSS_REASONS = [
  'Sem dinheiro no momento',
  'Não viu valor no produto',
  'Foi para o concorrente',
  'Sem tempo agora',
  'Não respondeu mais',
  'Outro',
] as const;

export type MoveDialogType = 'arrecadado' | 'loss_reason' | 'data_proximo_contato' | 'data_ra';

interface MoveDialogProps {
  open: boolean;
  type: MoveDialogType;
  targetStage: string;
  onConfirm: (data: Record<string, unknown>) => void;
  onCancel: () => void;
}

export function MoveDialog({ open, type, targetStage, onConfirm, onCancel }: MoveDialogProps) {
  const [arrecadado, setArrecadado] = useState('');
  const [lossReason, setLossReason] = useState('');
  const [otherReason, setOtherReason] = useState('');
  const [date, setDate] = useState<Date>();

  const stageLabel = getStageLabel(targetStage);

  const handleConfirm = () => {
    if (type === 'arrecadado') {
      const val = parseFloat(arrecadado.replace(/[^\d.,]/g, '').replace(',', '.'));
      if (!val || isNaN(val)) return;
      onConfirm({ arrecadado: val });
    } else if (type === 'loss_reason') {
      const reason = lossReason === 'Outro' ? otherReason.trim() : lossReason;
      if (!reason) return;
      onConfirm({ loss_reason: reason });
    } else if (type === 'data_proximo_contato') {
      if (!date) return;
      onConfirm({ data_proximo_contato: format(date, 'yyyy-MM-dd') });
    } else if (type === 'data_ra') {
      if (!date) return;
      onConfirm({ data_ra: format(date, 'yyyy-MM-dd') });
    }
  };

  const isValid = () => {
    if (type === 'arrecadado') {
      const val = parseFloat(arrecadado.replace(/[^\d.,]/g, '').replace(',', '.'));
      return !!val && !isNaN(val);
    }
    if (type === 'loss_reason') return lossReason === 'Outro' ? otherReason.trim().length > 0 : lossReason.length > 0;
    return !!date;
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mover para {stageLabel}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {type === 'arrecadado' && (
            <div className="space-y-2">
              <Label>Valor arrecadado (R$) *</Label>
              <Input
                placeholder="Ex: 15000"
                value={arrecadado}
                onChange={(e) => setArrecadado(e.target.value)}
                autoFocus
              />
            </div>
          )}

          {type === 'loss_reason' && (
            <div className="space-y-3">
              <Label>Motivo da perda *</Label>
              <RadioGroup value={lossReason} onValueChange={setLossReason}>
                {LOSS_REASONS.map((r) => (
                  <div key={r} className="flex items-center space-x-2">
                    <RadioGroupItem value={r} id={r} />
                    <Label htmlFor={r} className="font-normal cursor-pointer">{r}</Label>
                  </div>
                ))}
              </RadioGroup>
              {lossReason === 'Outro' && (
                <Input
                  placeholder="Descreva o motivo"
                  value={otherReason}
                  onChange={(e) => setOtherReason(e.target.value)}
                  autoFocus
                />
              )}
            </div>
          )}

          {(type === 'data_proximo_contato' || type === 'data_ra') && (
            <div className="space-y-2">
              <Label>{type === 'data_ra' ? 'Data da reunião *' : 'Data do próximo contato *'}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !date && 'text-muted-foreground')}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "dd/MM/yyyy", { locale: ptBR }) : 'Selecione uma data'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={date} onSelect={setDate} locale={ptBR} className={cn("p-3 pointer-events-auto")} />
                </PopoverContent>
              </Popover>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={!isValid()}>Confirmar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
