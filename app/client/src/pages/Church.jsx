// One church: its members, most owed first, plus adding new members.
import { useState } from "react";
import { api } from "../lib/api.js";
import { useApi } from "../lib/hooks.js";
import { money, summariseYears, plural, formatDate, thisYear, todayISO } from "../lib/format.js";
import { Button, Field, inputCls, Sheet, Loading, ErrorText, Back, H1, useAction, useToast } from "../components/ui.jsx";
import { RegisterFields, emptyRegister } from "../components/RegisterFields.jsx";

// Red "$9 for 3 years" or green "Up to date"
export const OwedText = ({ m }) =>
  m.owedCents > 0
    ? <span className="text-owe"><b>{money(m.owedCents)}</b> for {plural(m.owingYears.length, "year")}</span>
    : <span className="font-bold text-paid">Up to date</span>;

export default function ChurchPage({ churchId }) {
  const church = useApi(`/churches/${churchId}`);
  const members = useApi(`/members/church/${churchId}`);
  const [tab, setTab] = useState("active");
  const [adding, setAdding] = useState(false);

  if (church.loading || members.loading) return <Loading />;
  if (church.error || members.error) return <ErrorText error={church.error || members.error} />;

  const c = church.data.church;
  const all = members.data.members;
  const active = all.filter((m) => m.status === "active").sort((a, b) => b.owedCents - a.owedCents || a.name.localeCompare(b.name));
  const archived = all.filter((m) => m.status === "archived").sort((a, b) => a.name.localeCompare(b.name));
  const list = tab === "active" ? active : archived;
  const owed = all.reduce((s, m) => s + m.owedCents, 0);

  return (
    <>
      <Back href="#/">All churches</Back>
      <H1>{c.name}</H1>
      <p className="text-muted">{[c.parish && `${c.parish} parish`, c.archdeaconry && `${c.archdeaconry} archdeaconry`].filter(Boolean).join(", ")}</p>
      <a href={`#/register/${churchId}`} className="mt-1 inline-block text-sm font-bold text-blue">View this church's register</a>
      <p className="mt-2 text-[17px]">{owed ? <span className="text-owe"><b>{money(owed)}</b> outstanding</span> : <span className="font-bold text-paid">All tributes up to date</span>}</p>

      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-line bg-surface p-1" role="tablist">
          {[["active", `Active (${active.length})`], ["archived", `Archived (${archived.length})`]].map(([k, l]) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
              className={`rounded-md px-3 py-1.5 text-sm font-bold ${tab === k ? "bg-blue text-onblue" : "text-muted"}`}>{l}</button>
          ))}
        </div>
        <Button onClick={() => setAdding(true)}>Add member</Button>
      </div>

      {!list.length ? (
        <p className="mt-8 text-center text-muted">{tab === "active" ? "No members yet. Add the girls from the church book to start." : "No archived members."}</p>
      ) : (
        <ul className="mt-3 divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {list.map((m) => (
            <li key={m.id}>
              <a href={`#/member/${m.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-soft">
                <div className="min-w-0">
                  <div className="truncate font-bold">{m.name}</div>
                  <div className="truncate text-sm text-muted">
                    {m.owedCents ? `Owes ${summariseYears(m.owingYears)}` : `Member since ${m.joined}`}
                    {m.lastPaidOn ? `. Last paid ${formatDate(m.lastPaidOn)}` : ". Never paid"}
                    {m.status === "archived" && `. ${m.archivedReason} ${m.archivedAt}`}
                  </div>
                </div>
                <div className="shrink-0 text-right text-sm"><OwedText m={m} /></div>
              </a>
            </li>
          ))}
        </ul>
      )}
      {adding && <AddMember churchId={churchId} onClose={() => setAdding(false)} onSaved={members.reload} />}
    </>
  );
}

// Add a member. When copying from the church book, tick the years she has already
// paid and type the date paid next to each one (leave it blank if it wasn't written down).
function AddMember({ churchId, onClose, onSaved }) {
  const toast = useToast();
  const now = thisYear();
  const [f, setF] = useState({ name: "", phone: "", joined: String(now) });
  const [reg, setReg] = useState(emptyRegister);
  const [paid, setPaid] = useState({}); // { 2024: "2024-05-12" or "" }
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const { busy, error, run } = useAction();

  const joined = parseInt(f.joined, 10);
  const years = joined >= 1950 && joined <= now ? Array.from({ length: now - joined + 1 }, (_, i) => now - i) : [];
  const toggle = (y) => setPaid((p) => { const n = { ...p }; y in n ? delete n[y] : (n[y] = ""); return n; });

  const save = () => run(async () => {
    const previousPayments = Object.entries(paid)
      .filter(([y]) => +y >= joined) // ignore ticks left over from an earlier joining year
      .map(([y, d]) => ({ year: +y, ...(d ? { paidOn: d } : {}) }));
    await api("/members", { method: "POST", body: { churchId, name: f.name, phone: f.phone, joined, previousPayments, ...reg } });
    toast(`${f.name.trim()} added`);
    onSaved();
    onClose();
  });

  return (
    <Sheet title="Add member" onClose={onClose}>
      <div className="space-y-4">
        <Field label="Full name"><input className={inputCls} value={f.name} onChange={set("name")} /></Field>
        <Field label="Phone (optional)"><input className={inputCls} value={f.phone} onChange={set("phone")} inputMode="tel" /></Field>
        <RegisterFields value={reg} onChange={setReg} />
        <Field label="Year she joined the guild" hint="The yearly tribute is owed from this year.">
          <input className={inputCls} value={f.joined} onChange={set("joined")} inputMode="numeric" maxLength={4} />
        </Field>
        {years.length > 0 && (
          <fieldset>
            <legend className="text-sm font-bold">Years already paid in the church book</legend>
            <p className="mb-2 text-sm text-muted">Tick each paid year and enter the date paid if it's written down.</p>
            <ul className="divide-y divide-line rounded-lg border border-line">
              {years.map((y) => (
                <li key={y} className="flex items-center gap-3 px-3 py-2">
                  <label className="flex w-20 shrink-0 items-center gap-2 font-bold">
                    <input type="checkbox" checked={y in paid} onChange={() => toggle(y)} />{y}
                  </label>
                  {y in paid && (
                    <input type="date" aria-label={`Date paid for ${y}`} className={`${inputCls} !py-1.5`} value={paid[y]}
                      max={todayISO()} onChange={(e) => setPaid({ ...paid, [y]: e.target.value })} />
                  )}
                </li>
              ))}
            </ul>
          </fieldset>
        )}
        <ErrorText error={error} />
        <Button className="w-full" onClick={save} disabled={busy || !f.name.trim() || !years.length}>Add member</Button>
      </div>
    </Sheet>
  );
}
