"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { useAuth } from "@/lib/auth/auth-provider";
import { AuthenticationError } from "@/lib/auth/errors";
import { PENDING_VERIFICATION_EMAIL_KEY } from "@/lib/auth/session-storage-keys";
import { OTP_CODE_LENGTH } from "@/lib/constants";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

const RESEND_COOLDOWN_SECONDS = 30;

export default function VerifyEmailPage() {
  const router = useRouter();
  const { verifySignupOtp, resendSignupOtp } = useAuth();

  const [email, setEmail] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);

  useEffect(() => {
    const stored = sessionStorage.getItem(PENDING_VERIFICATION_EMAIL_KEY);
    if (!stored) {
      router.replace("/cadastro");
      return;
    }
    // sessionStorage so existe no cliente - nao ha como ler durante o render
    // inicial (SSR) para evitar este efeito.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEmail(stored);
  }, [router]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  async function handleVerify(value: string) {
    if (!email || value.length !== OTP_CODE_LENGTH) return;
    setVerifying(true);
    setError(null);
    try {
      await verifySignupOtp(email, value);
      sessionStorage.removeItem(PENDING_VERIFICATION_EMAIL_KEY);
      router.push("/hoje");
    } catch (err) {
      setCode("");
      setError(
        err instanceof AuthenticationError
          ? err.friendlyMessage
          : err instanceof Error
            ? err.message
            : "Codigo invalido."
      );
    } finally {
      setVerifying(false);
    }
  }

  async function handleResend() {
    if (!email || cooldown > 0) return;
    try {
      await resendSignupOtp(email);
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      setError(
        err instanceof AuthenticationError
          ? err.friendlyMessage
          : err instanceof Error
            ? err.message
            : "Nao foi possivel reenviar o codigo."
      );
    }
  }

  if (!email) return null;

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Verifique seu e-mail</CardTitle>
        <CardDescription>Enviamos um codigo de verificacao para {email}.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4">
        {error && (
          <Alert variant="destructive" className="animate-shake">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <InputOTP
          maxLength={OTP_CODE_LENGTH}
          value={code}
          onChange={setCode}
          onComplete={handleVerify}
          disabled={verifying}
        >
          <InputOTPGroup>
            {Array.from({ length: OTP_CODE_LENGTH }).map((_, i) => (
              <InputOTPSlot key={i} index={i} />
            ))}
          </InputOTPGroup>
        </InputOTP>

        <Button
          className="w-full"
          disabled={verifying || code.length !== OTP_CODE_LENGTH}
          onClick={() => handleVerify(code)}
        >
          {verifying ? "Verificando..." : "Verificar"}
        </Button>

        <Button variant="link" onClick={handleResend} disabled={cooldown > 0}>
          {cooldown > 0 ? `Reenviar codigo (${cooldown}s)` : "Reenviar codigo"}
        </Button>

        <Link href="/login" className="text-sm text-primary hover:underline">
          Voltar para o login
        </Link>
      </CardContent>
    </Card>
  );
}
