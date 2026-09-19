"use client";

/**
 * Contexto de autenticacao/sessao do usuario logado. Equivalente ao
 * AppState + AuthService do desktop, do lado do navegador: mantem o
 * usuario, perfil e configuracoes sincronizados com o Supabase Auth.
 */
import type { User } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import { translateAuthError, AuthenticationError } from "./errors";
import { UserRepository, type Profile, type UserSettings } from "@/lib/repositories/user-repository";

interface AuthContextValue {
  user: User | null;
  profile: Profile | null;
  settings: UserSettings | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  verifySignupOtp: (email: string, code: string) => Promise<void>;
  resendSignupOtp: (email: string) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  confirmPasswordReset: (email: string, code: string, newPassword: string) => Promise<void>;
  changePassword: (newPassword: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateSettings: (fields: Partial<Pick<UserSettings, "theme" | "notifications_enabled">>) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function wrapAuthError(error: unknown): never {
  const message = error instanceof Error ? error.message : String(error);
  throw new AuthenticationError(translateAuthError(message), message);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const userRepository = useMemo(() => new UserRepository(supabase), [supabase]);

  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfileAndSettings = useCallback(
    async (userId: string) => {
      const [profileResult, settingsResult] = await Promise.all([
        userRepository.getProfile(userId),
        userRepository.getSettings(userId),
      ]);
      setProfile(profileResult);
      setSettings(settingsResult);
    },
    [userRepository]
  );

  useEffect(() => {
    let active = true;

    supabase.auth.getUser().then(async ({ data }) => {
      if (!active) return;
      setUser(data.user ?? null);
      if (data.user) {
        try {
          await loadProfileAndSettings(data.user.id);
        } catch {
          // Perfil pode ainda nao existir (corrida com o trigger no cadastro);
          // a proxima renovacao de sessao tenta novamente.
        }
      }
      setLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!active) return;
      setUser(session?.user ?? null);
      if (event === "SIGNED_OUT") {
        setProfile(null);
        setSettings(null);
      }
      if (session?.user && (event === "SIGNED_IN" || event === "TOKEN_REFRESHED")) {
        try {
          await loadProfileAndSettings(session.user.id);
        } catch {
          // idem acima
        }
      }
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, [supabase, loadProfileAndSettings]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) wrapAuthError(error);
    },
    [supabase]
  );

  const signUp = useCallback(
    async (name: string, email: string, password: string) => {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name } },
      });
      if (error) wrapAuthError(error);
    },
    [supabase]
  );

  const verifySignupOtp = useCallback(
    async (email: string, code: string) => {
      const { error } = await supabase.auth.verifyOtp({ email, token: code, type: "signup" });
      if (error) wrapAuthError(error);
    },
    [supabase]
  );

  const resendSignupOtp = useCallback(
    async (email: string) => {
      const { error } = await supabase.auth.resend({ type: "signup", email });
      if (error) wrapAuthError(error);
    },
    [supabase]
  );

  const requestPasswordReset = useCallback(
    async (email: string) => {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) wrapAuthError(error);
    },
    [supabase]
  );

  const confirmPasswordReset = useCallback(
    async (email: string, code: string, newPassword: string) => {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: "recovery",
      });
      if (verifyError) wrapAuthError(verifyError);

      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) wrapAuthError(updateError);
    },
    [supabase]
  );

  const changePassword = useCallback(
    async (newPassword: string) => {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) wrapAuthError(error);
    },
    [supabase]
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setSettings(null);
  }, [supabase]);

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    await loadProfileAndSettings(user.id);
  }, [user, loadProfileAndSettings]);

  const updateSettings = useCallback(
    async (fields: Partial<Pick<UserSettings, "theme" | "notifications_enabled">>) => {
      if (!user) return;
      const updated = await userRepository.updateSettings(user.id, fields);
      setSettings(updated);
    },
    [user, userRepository]
  );

  const value: AuthContextValue = {
    user,
    profile,
    settings,
    loading,
    signIn,
    signUp,
    verifySignupOtp,
    resendSignupOtp,
    requestPasswordReset,
    confirmPasswordReset,
    changePassword,
    signOut,
    refreshProfile,
    updateSettings,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth deve ser usado dentro de um AuthProvider.");
  return context;
}
