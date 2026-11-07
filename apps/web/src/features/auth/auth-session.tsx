"use client";

import { createContext, useContext, useMemo, useState } from "react";
import type { AuthSession } from "./auth-client";

type AuthSessionContextValue = {
  session: AuthSession | null;
  setSession: (session: AuthSession | null) => void;
};

const AuthSessionContext = createContext<AuthSessionContextValue | null>(null);

export function AuthSessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const value = useMemo(() => ({ session, setSession }), [session]);
  return <AuthSessionContext.Provider value={value}>{children}</AuthSessionContext.Provider>;
}

export function useAuthSession(): AuthSessionContextValue {
  const value = useContext(AuthSessionContext);
  if (!value) {
    throw new Error("Authentication state is unavailable.");
  }
  return value;
}
