// Sign-in screen.
import { useState } from "react";
import { api } from "../lib/api.js";
import { useAuth } from "../App.jsx";
import { Button, Field, inputCls, ErrorText, useAction } from "../components/ui.jsx";

export default function Login() {
  const { setUser } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const { busy, error, run } = useAction();

  const submit = (e) => {
    e.preventDefault();
    run(async () => {
      const d = await api("/auth/login", { method: "POST", body: { username, password } });
      setPassword(""); // don't keep the password in memory longer than needed
      setUser(d.user);
    });
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-line bg-surface p-6">
        <svg width="44" height="44" viewBox="0 0 34 34" aria-hidden="true" className="text-blue">
          <circle cx="17" cy="17" r="15.5" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M17 8v18M11 14h12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
        <h1 className="mt-3 font-serif text-2xl font-semibold">St Agnes Guild register</h1>
        <p className="text-muted">Anglican Diocese of Masvingo</p>
        <div className="mt-6 space-y-4">
          <Field label="Username">
            <input className={inputCls} value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoCapitalize="none" autoCorrect="off" required />
          </Field>
          <Field label="Password">
            <input type="password" className={inputCls} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
          </Field>
        </div>
        <ErrorText error={error} />
        <Button type="submit" className="mt-5 w-full" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</Button>
        <p className="mt-4 text-sm text-muted">Forgotten your password, or taking over this role? Ask the diocesan office for a one-time password.</p>
      </form>
    </div>
  );
}
