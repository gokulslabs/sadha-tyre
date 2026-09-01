import { FormEvent, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LandingPage } from "@/components/LandingPage";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const required = import.meta.env.VITE_REQUIRE_AUTH === "true";
  const [ready, setReady] = useState(!required);
  const [signedIn, setSignedIn] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!required) return;
    let active = true;
    supabase.auth.getSession().then(({ data }) => { if (active) { setSignedIn(Boolean(data.session)); setReady(true); } }).catch((sessionError) => { if (active) { setError(sessionError instanceof Error ? sessionError.message : "Could not check your session"); setReady(true); } });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => { setSignedIn(Boolean(session)); setReady(true); });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, [required]);

  if (!required) return <>{children}</>;
  if (!ready) return <div className="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground">Checking your session…</div>;
  if (signedIn) return <>{children}</>;

  if (window.location.pathname !== "/auth") return <LandingPage />;

  async function submit(event: FormEvent) {
    event.preventDefault(); setPending(true); setError("");
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) setError(signInError.message);
    } catch (signInError) { setError(signInError instanceof Error ? signInError.message : "Could not sign in"); }
    setPending(false);
  }

  return <main className="grid min-h-screen place-items-center bg-background p-4"><form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-2xl border border-border bg-card p-6 shadow-lift"><div><p className="text-xs font-semibold uppercase tracking-wider text-primary">SADHA</p><h1 className="mt-1 text-2xl font-bold">Sign in to Tyre Management</h1><p className="mt-1 text-sm text-muted-foreground">Use your client account to access fleet records.</p></div><Input type="email" required placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} /><Input type="password" required placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<Button className="w-full" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</Button></form></main>;
}
