// Shared building blocks.
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

export function Button({ kind = "primary", className = "", ...props }) {
  const styles = {
    primary: "bg-blue text-onblue hover:opacity-90",
    quiet: "bg-surface text-ink border border-line hover:bg-soft",
    danger: "bg-surface text-owe border border-line hover:bg-owesoft",
  };
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-[15px] font-bold disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue ${styles[kind]} ${className}`}
    />
  );
}

export const inputCls =
  "w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-[16px] text-ink focus:outline focus:outline-2 focus:outline-blue";

export const Field = ({ label, hint, children }) => (
  <label className="block">
    <span className="mb-1 block text-sm font-bold">{label}</span>
    {children}
    {hint && <span className="mt-1 block text-sm text-muted">{hint}</span>}
  </label>
);

// Bottom sheet on phones, centred dialog on wider screens
export function Sheet({ title, onClose, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const k = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    ref.current?.querySelector("input,select,button")?.focus();
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}
        className="safe-bottom max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-surface p-5 shadow-xl sm:max-w-md sm:rounded-2xl">
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="font-serif text-xl font-semibold">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="-mr-2 -mt-1 rounded-lg px-2 py-1 text-2xl leading-none text-muted hover:bg-soft">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export const Loading = ({ children = "Loading…" }) => <p className="mt-10 text-center text-muted">{children}</p>;
export const ErrorText = ({ error }) => (error ? <p role="alert" className="mt-3 rounded-lg bg-owesoft px-3 py-2 text-owe">{error.message || String(error)}</p> : null);
export const Back = ({ href, children }) => <a href={href} className="text-sm font-bold text-blue">‹ {children}</a>;
export const H1 = ({ children }) => <h1 className="mt-1 font-serif text-[28px] font-semibold leading-tight">{children}</h1>;

// Toast messages after saving
const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const timer = useRef();
  const show = useCallback((msg, bad = false) => {
    setToast({ msg, bad });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 3500);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {toast && (
        <div role="status" className={`safe-bottom fixed inset-x-0 bottom-0 z-50 mx-auto mb-4 w-[calc(100%-2rem)] max-w-md rounded-xl px-4 py-3 text-[15px] font-bold shadow-lg ${toast.bad ? "bg-owe text-white" : "bg-ink text-bg"}`}>
          {toast.msg}
        </div>
      )}
    </ToastCtx.Provider>
  );
}

// Runs an async action with a busy flag and error message, e.g. for a Save button
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const run = useCallback(async (fn) => {
    setBusy(true);
    setError(null);
    try {
      return await fn();
    } catch (e) {
      setError(e);
      return undefined;
    } finally {
      setBusy(false);
    }
  }, []);
  return { busy, error, run, setError };
}
