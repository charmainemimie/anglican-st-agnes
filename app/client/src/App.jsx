// Decides what to show: sign-in, forced password change, or the register.
import { createContext, useContext, useEffect, useState } from "react";
import { api, onAuthProblem } from "./lib/api.js";
import { useRoute } from "./lib/hooks.js";
import { ToastProvider } from "./components/ui.jsx";
import Login from "./pages/Login.jsx";
import ChangePassword from "./pages/ChangePassword.jsx";
import Overview from "./pages/Overview.jsx";
import ChurchPage from "./pages/Church.jsx";
import MemberPage from "./pages/Member.jsx";
import Setup from "./pages/Setup.jsx";
import Register from "./pages/Register.jsx";

// The signed-in user, available to every page
const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export default function App() {
  const [user, setUser] = useState(undefined); // undefined = still checking, null = signed out
  const route = useRoute();

  // Is there a session already?
  useEffect(() => {
    api("/auth/me").then((d) => setUser(d.user)).catch(() => setUser(null));
  }, []);

  // If any request says the session ended (or a password change is needed), react to it
  useEffect(() => onAuthProblem((err) => {
    if (err.code === "UNAUTHENTICATED") setUser(null);
    else setUser((u) => (u ? { ...u, mustChangePassword: true } : u));
  }), []);

  const signOut = async () => {
    await api("/auth/logout", { method: "POST" }).catch(() => {});
    setUser(null);
    location.hash = "";
  };

  if (user === undefined) return <p className="mt-24 text-center text-muted">Opening the register…</p>;

  const [page, id] = route;
  return (
    <ToastProvider>
      <AuthCtx.Provider value={{ user, setUser, signOut }}>
        {!user ? <Login /> : user.mustChangePassword ? <ChangePassword forced /> : (
          <div className="min-h-screen">
            <Header />
            <main className="mx-auto max-w-3xl px-4 pb-24 pt-4">
              {page === "church" ? <ChurchPage churchId={id} />
                : page === "member" ? <MemberPage memberId={id} />
                : page === "setup" && user.role === "admin" ? <Setup tab={id} />
                : page === "register" ? <Register churchId={id} />
                : page === "password" ? <ChangePassword />
                : <Overview />}
            </main>
          </div>
        )}
      </AuthCtx.Provider>
    </ToastProvider>
  );
}

function Header() {
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  return (
    <header className="safe-top sticky top-0 z-30 border-b border-line bg-surface">
      <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
        <a href="#/" className="flex min-w-0 flex-1 items-center gap-3 rounded-lg">
          <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true" className="shrink-0 text-blue">
            <circle cx="17" cy="17" r="15.5" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="M17 8v18M11 14h12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
          <div className="min-w-0">
            <div className="truncate font-serif text-lg font-semibold leading-tight">St Agnes Guild</div>
            <div className="truncate text-sm text-muted">Anglican Diocese of Masvingo</div>
          </div>
        </a>
        <div className="relative">
          <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="rounded-lg border border-line px-3 py-2 text-sm font-bold hover:bg-soft">
            Menu
          </button>
          {open && (
            <div className="absolute right-0 mt-2 w-60 overflow-hidden rounded-xl border border-line bg-surface shadow-lg" onClick={() => setOpen(false)}>
              <div className="border-b border-line px-4 py-3 text-sm">
                <div className="font-bold">{user.holderName || user.username}</div>
                <div className="text-muted">{user.office}</div>
              </div>
              <a href="#/" className="block px-4 py-2.5 hover:bg-soft">Overview</a>
              <a href="#/register" className="block px-4 py-2.5 hover:bg-soft">Register</a>
              {user.role === "admin" && <a href="#/setup" className="block px-4 py-2.5 hover:bg-soft">Setup</a>}
              <a href="#/password" className="block px-4 py-2.5 hover:bg-soft">Change password</a>
              <button onClick={signOut} className="block w-full px-4 py-2.5 text-left text-owe hover:bg-soft">Sign out</button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
