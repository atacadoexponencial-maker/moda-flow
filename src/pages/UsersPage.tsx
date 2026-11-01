import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getErrorMessage } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2, UserPlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ROLE_OPTIONS, roleLabel, canManageUsers, canEditRole, canDeleteUser } from "@/lib/roles";

interface UserItem {
  id: string;
  email: string;
  created_at: string;
  role: string | null;
}

const UsersPage = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [myRole, setMyRole] = useState<string | null>(null);
  const [myId, setMyId] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    try {
      const [usersRes, authRes] = await Promise.all([
        supabase.functions.invoke("manage-users", { body: { action: "list" } }),
        supabase.auth.getUser(),
      ]);

      if (usersRes.error) throw usersRes.error;
      if (usersRes.data?.error) throw new Error(usersRes.data.error);

      // O papel de cada usuário já vem do servidor junto com a lista.
      const list = (usersRes.data.users || []) as UserItem[];
      const currentUserId = authRes.data?.user?.id ?? null;
      setMyId(currentUserId);
      setMyRole(currentUserId ? (list.find((u) => u.id === currentUserId)?.role ?? null) : null);
      setUsers(list);
    } catch (err) {
      toast.error(getErrorMessage(err, "Erro ao carregar usuários"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-users", {
        body: { action: "invite", email: inviteEmail.trim() },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(`Convite enviado para ${inviteEmail}`);
      setInviteEmail("");
      setDialogOpen(false);
      loadUsers();
    } catch (err) {
      toast.error(getErrorMessage(err, "Erro ao enviar convite"));
    } finally {
      setInviting(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      const existing = users.find((u) => u.id === userId);
      if (existing?.role) {
        await supabase
          .from("user_roles")
          .update({ role: newRole })
          .eq("user_id", userId);
      } else {
        await supabase
          .from("user_roles")
          .insert({ user_id: userId, role: newRole });
      }

      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
      );
      toast.success("Papel atualizado");
    } catch (err) {
      toast.error(getErrorMessage(err, "Erro ao atualizar papel"));
    }
  };

  const handleDelete = async (userId: string) => {
    setDeletingId(userId);
    try {
      await supabase.from("user_roles").delete().eq("user_id", userId);

      const { data, error } = await supabase.functions.invoke("manage-users", {
        body: { action: "delete", user_id: userId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success("Usuário removido");
      setUsers((prev) => prev.filter((u) => u.id !== userId));
    } catch (err) {
      toast.error(getErrorMessage(err, "Erro ao remover usuário"));
    } finally {
      setDeletingId(null);
    }
  };

  const canManage = canManageUsers(myRole);

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/configuracoes")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-foreground">Usuários</h2>
          <p className="text-muted-foreground text-sm mt-0.5">
            Gerencie os usuários e suas permissões.
          </p>
        </div>
        {canManage && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <UserPlus className="h-4 w-4 mr-2" />
                Convidar usuário
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Convidar usuário</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <Label htmlFor="invite-email">Email</Label>
                <Input
                  id="invite-email"
                  type="email"
                  placeholder="usuario@empresa.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleInvite()}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleInvite} disabled={inviting || !inviteEmail.trim()}>
                  {inviting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Enviar convite
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-16 text-sm text-muted-foreground">
              Nenhum usuário encontrado.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Papel</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead className="w-[80px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => {
                  const editable = canEditRole(myRole, user.role);
                  const deletable = canDeleteUser(myRole, user.role, user.id === myId);

                  return (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.email}</TableCell>
                      <TableCell>
                        {editable ? (
                          <Select
                            value={user.role || ""}
                            onValueChange={(v) => handleRoleChange(user.id, v)}
                          >
                            <SelectTrigger className="w-[140px] h-8">
                              <SelectValue placeholder="Sem papel" />
                            </SelectTrigger>
                            <SelectContent>
                              {ROLE_OPTIONS.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge variant="secondary">
                            {roleLabel(user.role)}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(user.created_at), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        {canManage && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => handleDelete(user.id)}
                            disabled={deletingId === user.id || !deletable}
                          >
                            {deletingId === user.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default UsersPage;
