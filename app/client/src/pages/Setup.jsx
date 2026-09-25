// Diocesan office only: churches, tribute amount, accounts and activity log.
import { useState } from "react";
import { api } from "../lib/api.js";
import { useApi } from "../lib/hooks.js";
import { money } from "../lib/format.js";
import { useAuth } from "../App.jsx";
import { Button, Field, inputCls, Sheet, Loading, ErrorText, Back, H1, useAction, useToast } from "../components/ui.jsx";

const TABS = [["churches", "Churches"], ["tribute", "Tribute"], ["accounts", "Accounts"], ["activity", "Activity"]];

export default function Setup({ tab = "churches" }) {
  return (
    <>
      <Back href="#/">Overview</Back>
      <H1>Setup</H1>
      <nav className="mt-3 flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map(([k, l]) => (
          <a key={k} href={`#/setup/${k}`} aria-current={tab === k ? "page" : undefined}
            className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 font-bold ${tab === k ? "border-blue text-blue" : "border-transparent text-muted"}`}>{l}</a>
        ))}
      </nav>
      <div className="mt-4">
        {tab === "tribute" ? <Tribute /> : tab === "accounts" ? <Accounts /> : tab === "activity" ? <Activity /> : <Churches />}
      </div>
    </>
  );
}

/* ---------------- Churches and archdeaconries ---------------- */
function Churches() {
  const churches = useApi("/churches");
  const settings = useApi("/settings");
  const [editing, setEditing] = useState(null);
  const [arch, setArch] = useState("");
  const toast = useToast();

  if (churches.loading || settings.loading) return <Loading />;
  const archList = settings.data.archdeaconries;

  const saveArch = async (list) => {
    try { await api("/settings/archdeaconries", { method: "PUT", body: { archdeaconries: list } }); settings.reload(); setArch(""); }
    catch (e) { toast(e.message, true); }
  };

  return (
    <>
      <h2 className="font-serif text-xl font-semibold">Archdeaconries</h2>
      <ul className="mt-2 flex flex-wrap gap-2">
        {archList.map((a) => (
          <li key={a} className="inline-flex items-center gap-1 rounded-full border border-line bg-surface py-1 pl-3 pr-1 text-sm font-bold">
            {a}<button onClick={() => saveArch(archList.filter((x) => x !== a))} aria-label={`Remove ${a}`} className="rounded-full px-2 text-muted hover:bg-soft">×</button>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex gap-2">
        <input className={inputCls} value={arch} onChange={(e) => setArch(e.target.value)} placeholder="New archdeaconry" />
        <Button kind="quiet" className="shrink-0" disabled={!arch.trim()} onClick={() => saveArch([...archList, arch.trim()])}>Add</Button>
      </div>

      <div className="mt-8 flex items-center justify-between">
        <h2 className="font-serif text-xl font-semibold">Churches ({churches.data.churches.length})</h2>
        <Button kind="quiet" onClick={() => setEditing({})}>Add church</Button>
      </div>
      <ul className="mt-2 divide-y divide-line">
        {churches.data.churches.map((c) => (
          <li key={c._id} className="flex items-center justify-between gap-3 py-2.5">
            <div className="min-w-0">
              <div className="truncate font-bold">{c.name}</div>
              <div className="truncate text-sm text-muted">{[c.parish, c.archdeaconry].filter(Boolean).join(", ") || "No parish set"}</div>
            </div>
            <button onClick={() => setEditing(c)} className="rounded-lg px-3 py-1.5 text-sm font-bold text-blue hover:bg-soft">Edit</button>
          </li>
        ))}
      </ul>
      {editing && <ChurchForm church={editing._id ? editing : null} archList={archList}
        parishes={[...new Set(churches.data.churches.map((c) => c.parish).filter(Boolean))].sort()}
        onClose={() => setEditing(null)} onSaved={() => { setEditing(null); churches.reload(); }} />}
    </>
  );
}

function ChurchForm({ church, archList, parishes, onClose, onSaved }) {
  const toast = useToast();
  const [f, setF] = useState({ name: church?.name || "", parish: church?.parish || "", archdeaconry: church?.archdeaconry || "" });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const { busy, error, run } = useAction();
  const save = () => run(async () => {
    await api(church ? `/churches/${church._id}` : "/churches", { method: church ? "PUT" : "POST", body: f });
    toast(church ? "Church updated" : `${f.name} added`);
    onSaved();
  });
  const remove = () => window.confirm(`Remove ${church.name}?`) && run(async () => {
    await api(`/churches/${church._id}`, { method: "DELETE" });
    toast("Church removed");
    onSaved();
  });
  return (
    <Sheet title={church ? "Edit church" : "Add church"} onClose={onClose}>
      <div className="space-y-4">
        <Field label="Church name"><input className={inputCls} value={f.name} onChange={set("name")} /></Field>
        <Field label="Parish" hint="Pick an existing parish or type a new one.">
          <input className={inputCls} value={f.parish} onChange={set("parish")} list="parishes" />
          <datalist id="parishes">{parishes.map((p) => <option key={p} value={p} />)}</datalist>
        </Field>
        <Field label="Archdeaconry">
          <select className={inputCls} value={f.archdeaconry} onChange={set("archdeaconry")}>
            <option value="">Not yet assigned</option>
            {archList.map((a) => <option key={a}>{a}</option>)}
          </select>
        </Field>
        <ErrorText error={error} />
        <Button className="w-full" onClick={save} disabled={busy || !f.name.trim()}>{church ? "Save changes" : "Add church"}</Button>
        {church && <Button kind="danger" className="w-full" onClick={remove} disabled={busy}>Remove church</Button>}
      </div>
    </Sheet>
  );
}

/* ---------------- Yearly tribute ---------------- */
function Tribute() {
  const settings = useApi("/settings");
  const toast = useToast();
  const [fee, setFee] = useState("");
  const [from, setFrom] = useState("");
  const { busy, error, run } = useAction();
  if (settings.loading) return <Loading />;
  const s = settings.data;
  const save = () => run(async () => {
    await api("/settings/fees", { method: "POST", body: { fee: parseFloat(fee), from: parseInt(from, 10) || s.currentYear + 1 } });
    toast("Tribute updated");
    setFee("");
    settings.reload();
  });
  return (
    <>
      <p className="text-[17px]">This year's tribute is <b>{money(s.currentFeeCents)}</b> per member.</p>
      <p className="mt-1 text-muted">A change applies from the year you choose. Earlier years keep their old amount, so past arrears stay correct. If the $5 actually started in a different year, set it again with the right year.</p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Field label="Amount per year (USD)"><input className={inputCls} value={fee} onChange={(e) => setFee(e.target.value)} inputMode="decimal" /></Field>
        <Field label="Starting year"><input className={inputCls} value={from} placeholder={String(s.currentYear + 1)} onChange={(e) => setFrom(e.target.value)} inputMode="numeric" maxLength={4} /></Field>
      </div>
      <ErrorText error={error} />
      <Button className="mt-3" onClick={save} disabled={busy || !(parseFloat(fee) > 0)}>Set tribute</Button>
      <h3 className="mt-8 font-bold">Tribute history</h3>
      <ul className="mt-2 divide-y divide-line">
        {s.feeHistory.map((h, i) => {
          const next = s.feeHistory[i + 1];
          return (
            <li key={h.from} className="flex justify-between py-2">
              <span>{i === 0 ? "Up to" : `${h.from} to`} {next ? next.from - 1 : "now"}</span><b>{money(h.feeCents)} a year</b>
            </li>
          );
        })}
      </ul>
    </>
  );
}

/* ---------------- Accounts, handovers and password resets ---------------- */
function Accounts() {
  const { user: me } = useAuth();
  const users = useApi("/users");
  const churches = useApi("/churches");
  const [sheet, setSheet] = useState(null); // {mode:"new"|"edit"|"handover", user}
  const [secret, setSecret] = useState(null); // one-time password to show once
  const toast = useToast();

  if (users.loading || churches.loading) return <Loading />;
  if (users.error) return <ErrorText error={users.error} />;
  const churchName = (id) => churches.data.churches.find((c) => c._id === id)?.name || "Removed church";

  const reset = async (u) => {
    if (!window.confirm(`Give ${u.office} a new one-time password? Their current password stops working and they're signed out.`)) return;
    try { const d = await api(`/users/${u.id}/reset-password`, { method: "POST" }); setSecret({ user: d.user, password: d.tempPassword }); users.reload(); }
    catch (e) { toast(e.message, true); }
  };
  const done = (d) => { setSheet(null); users.reload(); if (d?.tempPassword) setSecret({ user: d.user, password: d.tempPassword }); };

  return (
    <>
      <p className="text-muted">Each account belongs to an office, not a person. When someone new takes over, use <b className="text-ink">Hand over</b>: it sets a new username and one-time password and signs the previous holder out everywhere.</p>
      <Button className="mt-3" onClick={() => setSheet({ mode: "new" })}>Add account</Button>
      <ul className="mt-4 divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
        {users.data.users.map((u) => (
          <li key={u.id} className={`p-4 ${u.active ? "" : "opacity-60"}`}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div className="font-bold">{u.office}</div>
              <div className="text-sm text-muted">{u.role === "admin" ? "Diocesan admin" : "Treasurer"}{!u.active && ", deactivated"}</div>
            </div>
            <div className="text-sm">{u.holderName || "No holder named"}, username <b>{u.username}</b></div>
            {u.role === "treasurer" && <div className="text-sm text-muted">{u.churchIds.map(churchName).join(", ")}</div>}
            <div className="text-sm text-muted">
              {u.mustChangePassword ? "Waiting for first sign-in" : u.lastLoginAt ? `Last signed in ${new Date(u.lastLoginAt).toLocaleDateString()}` : "Never signed in"}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button kind="quiet" className="!px-3 !py-1.5 text-sm" onClick={() => setSheet({ mode: "handover", user: u })}>Hand over</Button>
              <Button kind="quiet" className="!px-3 !py-1.5 text-sm" onClick={() => reset(u)}>Reset password</Button>
              {u.id !== me.id && <Button kind="quiet" className="!px-3 !py-1.5 text-sm" onClick={() => setSheet({ mode: "edit", user: u })}>Edit access</Button>}
            </div>
          </li>
        ))}
      </ul>
      {sheet?.mode === "handover" && <HandoverSheet u={sheet.user} onClose={() => setSheet(null)} onDone={done} />}
      {(sheet?.mode === "new" || sheet?.mode === "edit") && <AccountForm u={sheet.user} churches={churches.data.churches} onClose={() => setSheet(null)} onDone={done} />}
      {secret && <SecretSheet {...secret} onClose={() => setSecret(null)} />}
    </>
  );
}

// Shows a one-time password exactly once. It's never stored or shown again.
function SecretSheet({ user, password, onClose }) {
  const [copied, setCopied] = useState(false);
  return (
    <Sheet title="One-time password" onClose={onClose}>
      <p>Give this to <b>{user.holderName || user.office}</b> in person or by phone call. Don't send it in a group chat.</p>
      <div className="mt-4 rounded-lg border border-line bg-soft p-4 text-center">
        <div className="text-sm text-muted">Username</div><div className="text-lg font-bold">{user.username}</div>
        <div className="mt-2 text-sm text-muted">One-time password</div><div className="select-all text-2xl font-bold tracking-wider">{password}</div>
      </div>
      <p className="mt-3 text-sm text-muted">They'll be asked to choose their own password when they first sign in. This won't be shown again.</p>
      <div className="mt-4 flex gap-2">
        <Button kind="quiet" className="flex-1" onClick={() => navigator.clipboard?.writeText(password).then(() => setCopied(true))}>{copied ? "Copied" : "Copy"}</Button>
        <Button className="flex-1" onClick={onClose}>Done</Button>
      </div>
    </Sheet>
  );
}

function HandoverSheet({ u, onClose, onDone }) {
  const [holderName, setHolderName] = useState("");
  const [username, setUsername] = useState("");
  const { busy, error, run } = useAction();
  const save = () => run(async () => onDone(await api(`/users/${u.id}/handover`, { method: "POST", body: { holderName, username } })));
  return (
    <Sheet title={`Hand over: ${u.office}`} onClose={onClose}>
      <p className="mb-4 text-muted">{u.holderName ? `${u.holderName} will be signed out everywhere and their password will stop working.` : "The current holder will be signed out everywhere."} All records stay as they are.</p>
      <div className="space-y-4">
        <Field label="New holder's full name"><input className={inputCls} value={holderName} onChange={(e) => setHolderName(e.target.value)} /></Field>
        <Field label="New username" hint="Letters, numbers, dots or dashes, e.g. secretary.moyo"><input className={inputCls} value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())} autoCapitalize="none" /></Field>
        <ErrorText error={error} />
        <Button className="w-full" onClick={save} disabled={busy || !holderName.trim() || username.length < 3}>Hand over and create one-time password</Button>
      </div>
    </Sheet>
  );
}

function AccountForm({ u, churches, onClose, onDone }) {
  const [f, setF] = useState({ office: u?.office || "", holderName: u?.holderName || "", username: u?.username || "", role: u?.role || "treasurer", churchIds: u?.churchIds || [], active: u?.active ?? true });
  const { busy, error, run } = useAction();
  const toggleChurch = (id) => setF({ ...f, churchIds: f.churchIds.includes(id) ? f.churchIds.filter((x) => x !== id) : [...f.churchIds, id] });
  const save = () => run(async () => {
    const d = u
      ? await api(`/users/${u.id}`, { method: "PATCH", body: { office: f.office, role: f.role, churchIds: f.role === "treasurer" ? f.churchIds : [], active: f.active } })
      : await api("/users", { method: "POST", body: { office: f.office, holderName: f.holderName, username: f.username, role: f.role, churchIds: f.role === "treasurer" ? f.churchIds : [] } });
    onDone(d);
  });
  return (
    <Sheet title={u ? `Edit ${u.office}` : "Add account"} onClose={onClose}>
      <div className="space-y-4">
        <Field label="Office" hint="The role, not the person, e.g. Treasurer, St Mary's Mucheke"><input className={inputCls} value={f.office} onChange={(e) => setF({ ...f, office: e.target.value })} /></Field>
        {!u && <>
          <Field label="Holder's full name"><input className={inputCls} value={f.holderName} onChange={(e) => setF({ ...f, holderName: e.target.value })} /></Field>
          <Field label="Username"><input className={inputCls} value={f.username} onChange={(e) => setF({ ...f, username: e.target.value.toLowerCase() })} autoCapitalize="none" /></Field>
        </>}
        <Field label="Access">
          <select className={inputCls} value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
            <option value="treasurer">Treasurer: only their churches</option>
            <option value="admin">Diocesan admin: everything</option>
          </select>
        </Field>
        {f.role === "treasurer" && (
          <fieldset>
            <legend className="mb-1 text-sm font-bold">Churches</legend>
            <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-line p-2">
              {churches.map((c) => (
                <label key={c._id} className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-soft">
                  <input type="checkbox" checked={f.churchIds.includes(c._id)} onChange={() => toggleChurch(c._id)} />
                  <span>{c.name} <span className="text-sm text-muted">{c.parish}</span></span>
                </label>
              ))}
            </div>
          </fieldset>
        )}
        {u && (
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} />
            <span>Account active (untick to block sign-in)</span>
          </label>
        )}
        <ErrorText error={error} />
        <Button className="w-full" onClick={save} disabled={busy || !f.office.trim()}>{u ? "Save changes" : "Create account"}</Button>
      </div>
    </Sheet>
  );
}

/* ---------------- Activity log ---------------- */
const ACTIONS = {
  "auth.login": "signed in", "auth.locked": "account locked after wrong passwords", "auth.password_changed": "changed their password",
  "user.create": "created an account", "user.update": "changed an account", "user.handover": "handed over an account", "user.reset_password": "reset a password",
  "church.create": "added a church", "church.update": "edited a church", "church.delete": "removed a church",
  "member.create": "added a member", "member.update": "edited a member", "member.archive": "archived a member", "member.restore": "restored a member", "member.delete": "deleted a member",
  "payment.create": "recorded a payment", "payment.void": "voided a receipt",
  "settings.fee": "changed the tribute", "settings.archdeaconries": "changed archdeaconries", "report.arrears_export": "exported arrears", "register.export": "exported the register",
};

function Activity() {
  const log = useApi("/audit");
  if (log.loading) return <Loading />;
  if (log.error) return <ErrorText error={log.error} />;
  return (
    <ul className="divide-y divide-line">
      {log.data.entries.map((e) => (
        <li key={e._id} className="py-2.5">
          <div><b>{e.username || "Unknown"}</b> {ACTIONS[e.action] || e.action}
            {e.details?.name && `: ${e.details.name}`}
            {e.details?.amountCents && `: ${money(e.details.amountCents)}`}
            {e.details?.to && `: to ${e.details.to}`}</div>
          <div className="text-sm text-muted">{new Date(e.at).toLocaleString()}</div>
        </li>
      ))}
    </ul>
  );
}
