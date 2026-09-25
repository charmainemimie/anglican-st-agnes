// Change password. "forced" = first sign-in with a temporary password (new
// account, reset or handover): the user can't do anything else until it's done.
import { useState } from "react";
import { api } from "../lib/api.js";
import { useAuth } from "../App.jsx";
import { Button, Field, inputCls, ErrorText, useAction, useToast, H1, Back } from "../components/ui.jsx";

export default function ChangePassword({ forced = false }) {
  const { user, setUser, signOut } = useAuth();
  const toast = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const { busy, error, run, setError } = useAction();

  const submit = (e) => {
    e.preventDefault();
    if (next !== confirm) return setError(new Error("The two new passwords don't match."));
    run(async () => {
      const d = await api("/auth/change-password", { method: "POST", body: { currentPassword: current, newPassword: next } });
      setCurrent(""); setNext(""); setConfirm("");
      setUser(d.user);
      toast("Password changed. Other devices have been signed out.");
      if (!forced) location.hash = "#/";
    });
  };

  const form = (
    <form onSubmit={submit} className="mt-4 space-y-4">
      <Field label={forced ? "One-time password you were given" : "Current password"}>
        <input type="password" className={inputCls} value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" required />
      </Field>
      <Field label="New password" hint="At least 10 characters, with letters and numbers. Don't reuse an old one.">
        <input type="password" className={inputCls} value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" minLength={10} required />
      </Field>
      <Field label="New password again">
        <input type="password" className={inputCls} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />
      </Field>
      <ErrorText error={error} />
      <Button type="submit" className="w-full" disabled={busy}>{busy ? "Saving…" : "Save new password"}</Button>
    </form>
  );

  if (!forced) return (<><Back href="#/">Overview</Back><H1>Change password</H1>{form}</>);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-6">
        <h1 className="font-serif text-2xl font-semibold">Welcome{user.holderName ? `, ${user.holderName}` : ""}</h1>
        <p className="mt-1 text-muted">You're signed in as <b className="text-ink">{user.office}</b>. Choose your own password to continue. Only you should know it.</p>
        {form}
        <button onClick={signOut} className="mt-4 text-sm font-bold text-blue">Sign out</button>
      </div>
    </div>
  );
}
