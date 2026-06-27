import { useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const CONFIRM_PHRASE = "LIMPAR CRM";

type ClearCrmResult = {
  success: boolean;
  deleted: { activities: number; leads: number };
};

const LimparCrmCard = () => {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const queryClient = useQueryClient();

  const isConfirmEnabled = confirmText === CONFIRM_PHRASE;

  const clearCrmMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("clear-crm");
      if (error) throw error;
      if (!data || data.success !== true) {
        throw new Error("Resposta inválida do servidor.");
      }
      return data as ClearCrmResult;
    },
    onSuccess: (data) => {
      setConfirmText("");
      setOpen(false);
      toast.success(
        `CRM limpo: ${data.deleted.leads} leads e ${data.deleted.activities} atividades removidos.`,
      );
      queryClient.invalidateQueries({ queryKey: ["leads-pipeline"] });
      queryClient.invalidateQueries({ queryKey: ["leads-table"] });
      queryClient.invalidateQueries({ queryKey: ["leads-hoje"] });
    },
    onError: () => {
      toast.error("Não foi possível limpar o CRM. Tente novamente.");
    },
  });

  const isLoading = clearCrmMutation.isPending;

  const handleOpenChange = (next: boolean) => {
    // Bloqueia fechamento enquanto processa a limpeza
    if (isLoading) return;
    if (!next) setConfirmText("");
    setOpen(next);
  };

  const handleConfirm = () => {
    if (!isConfirmEnabled || isLoading) return;
    clearCrmMutation.mutate();
  };

  return (
    <Card className="border-destructive/50">
      <CardContent className="flex items-center gap-4 py-5">
        <AlertTriangle className="h-8 w-8 text-destructive" />
        <div>
          <p className="font-medium text-destructive">Limpar CRM</p>
          <p className="text-sm text-muted-foreground">
            Apaga permanentemente todos os leads e atividades de todos os usuários. Esta ação não pode ser desfeita.
          </p>
        </div>
        <Button
          variant="destructive"
          className="ml-auto"
          size="sm"
          onClick={() => setOpen(true)}
        >
          Limpar CRM
        </Button>
      </CardContent>

      <AlertDialog open={open} onOpenChange={handleOpenChange}>
        <AlertDialogContent
          onEscapeKeyDown={(e) => {
            if (isLoading) e.preventDefault();
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Apagar todos os leads e atividades?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta operação é permanente e irreversível. Ela apaga todos os leads e atividades de
              todos os usuários e não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-2">
            <Label htmlFor="confirm-limpar-crm">
              Para confirmar, digite{" "}
              <span className="font-semibold text-destructive">{CONFIRM_PHRASE}</span> abaixo:
            </Label>
            <Input
              id="confirm-limpar-crm"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={CONFIRM_PHRASE}
              disabled={isLoading}
              autoComplete="off"
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>Cancelar</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={handleConfirm}
              disabled={!isConfirmEnabled || isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Limpando...
                </>
              ) : (
                "Limpar CRM"
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};

export default LimparCrmCard;
