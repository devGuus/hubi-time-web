"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useAuth } from "@/lib/auth/auth-provider";
import { OTP_CODE_LENGTH } from "@/lib/constants";
import { isValidEmail, passwordsMatch, validatePassword } from "@/lib/validators";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { requestPasswordReset, confirmPasswordReset } = useAuth();

  const [step, setStep] = useState<"request" | "confirm">("request");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleRequest() {
    setError(null);
    if (!isValidEmail(email)) {
      setError("Informe um e-mail valido.");
      return;
    }
    setLoading(true);
    try {
      await requestPasswordReset(email);
      setStep("confirm");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel enviar o codigo.");
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm() {
    setError(null);
    if (code.length !== OTP_CODE_LENGTH) {
      setError(`Informe os ${OTP_CODE_LENGTH} digitos do codigo recebido.`);
      return;
    }
    const passwordResult = validatePassword(newPassword);
    if (!passwordResult.isValid) {
      setError(passwordResult.errors.join(" "));
      return;
    }
    if (!passwordsMatch(newPassword, confirmPassword)) {
      setError("As senhas informadas nao coincidem.");
      return;
    }
    setLoading(true);
    try {
      await confirmPasswordReset(email, code, newPassword);
      router.push("/login");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel redefinir a senha.");
    } finally {
      setLoading(false);
    }
  }

  if (step === "request") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Recuperar senha</CardTitle>
          <CardDescription>Informe seu e-mail para receber um codigo de recuperacao.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              placeholder="seu.email@empresa.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <Button className="w-full" disabled={loading} onClick={handleRequest}>
            {loading ? "Enviando..." : "Enviar codigo"}
          </Button>
          <p className="text-center text-sm">
            <Link href="/login" className="text-primary hover:underline">
              Voltar para o login
            </Link>
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Digite o codigo e a nova senha</CardTitle>
        <CardDescription>Enviamos um codigo para {email}.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <InputOTP maxLength={OTP_CODE_LENGTH} value={code} onChange={setCode} disabled={loading}>
          <InputOTPGroup>
            {Array.from({ length: OTP_CODE_LENGTH }).map((_, i) => (
              <InputOTPSlot key={i} index={i} />
            ))}
          </InputOTPGroup>
        </InputOTP>

        <div className="w-full space-y-2">
          <Label htmlFor="newPassword">Nova senha</Label>
          <Input
            id="newPassword"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </div>
        <div className="w-full space-y-2">
          <Label htmlFor="confirmPassword">Confirmar nova senha</Label>
          <Input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </div>

        <Button className="w-full" disabled={loading} onClick={handleConfirm}>
          {loading ? "Redefinindo..." : "Redefinir senha"}
        </Button>
        <Button variant="link" onClick={() => setStep("request")}>
          Voltar
        </Button>
      </CardContent>
    </Card>
  );
}
