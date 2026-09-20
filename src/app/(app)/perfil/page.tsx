"use client";

/** Tela 'Meu Perfil': dados pessoais, alteracao de senha e atalhos. */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { useAuth } from "@/lib/auth/auth-provider";
import { avatarGradient } from "@/lib/avatar-color";
import { UserRepository } from "@/lib/repositories/user-repository";
import { createClient } from "@/lib/supabase/client";
import { passwordsMatch, validatePassword } from "@/lib/validators";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export default function ProfilePage() {
  const router = useRouter();
  const { user, profile, refreshProfile, changePassword, signOut } = useAuth();

  const [name, setName] = useState("");
  const [savingName, setSavingName] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    // sincroniza o rascunho editavel quando o perfil carrega/atualiza
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (profile) setName(profile.name);
  }, [profile]);

  async function handleSaveName() {
    if (!user || !name.trim()) {
      toast.error("Informe seu nome.");
      return;
    }
    setSavingName(true);
    try {
      const supabase = createClient();
      const repo = new UserRepository(supabase);
      await repo.updateProfileName(user.id, name.trim());
      await refreshProfile();
      toast.success("Nome atualizado com sucesso.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar.");
    } finally {
      setSavingName(false);
    }
  }

  async function handleChangePassword() {
    const result = validatePassword(newPassword);
    if (!result.isValid) {
      toast.error(result.errors.join(" "));
      return;
    }
    if (!passwordsMatch(newPassword, confirmPassword)) {
      toast.error("As senhas informadas nao coincidem.");
      return;
    }
    setSavingPassword(true);
    try {
      await changePassword(newPassword);
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Senha alterada com sucesso.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao alterar senha.");
    } finally {
      setSavingPassword(false);
    }
  }

  async function handleSignOut() {
    await signOut();
    router.push("/login");
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <Avatar className="size-16">
          <AvatarFallback
            className="text-lg text-white"
            style={{ background: avatarGradient(profile?.name || user?.email || "?") }}
          >
            {initialsOf(profile?.name || user?.email || "?")}
          </AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-2xl font-semibold">{profile?.name || "Meu Perfil"}</h1>
          <p className="text-sm text-muted-foreground">{user?.email}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados pessoais</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end gap-3">
            <div className="flex-1 space-y-1">
              <Label className="text-xs">Nome</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <Button onClick={handleSaveName} disabled={savingName}>
              {savingName ? "Salvando..." : "Salvar nome"}
            </Button>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">E-mail</Label>
            <Input value={user?.email ?? ""} disabled />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Alterar senha</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            type="password"
            placeholder="Nova senha"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <Input
            type="password"
            placeholder="Confirmar nova senha"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
          <Button onClick={handleChangePassword} disabled={savingPassword}>
            {savingPassword ? "Alterando..." : "Alterar senha"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Preferencias</CardTitle>
        </CardHeader>
        <CardContent>
          <Button
            variant="ghost"
            render={
              <Link href="/configuracoes">Configuracoes de jornada, salario, tema e notificacoes</Link>
            }
          />
        </CardContent>
      </Card>

      <AlertDialog>
        <AlertDialogTrigger
          render={
            <Button variant="outline" className="text-destructive">
              Sair da conta
            </Button>
          }
        />
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sair</AlertDialogTitle>
            <AlertDialogDescription>Deseja realmente sair da sua conta?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleSignOut}>Sair</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
