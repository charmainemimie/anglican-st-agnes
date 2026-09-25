// One member: arrears, the year-by-year ledger with dates paid, receipts and actions.
import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { useApi, go } from "../lib/hooks.js";
import { money, summariseYears, plural, formatDate, todayISO, thisYear } from "../lib/format.js";
import { useAuth } from "../App.jsx";
import { Button, Field, inputCls, Sheet, Loading, ErrorText, Back, H1, useAction, useToast } from "../components/ui.jsx";
import { RegisterFields } from "../components/RegisterFields.jsx";
import { ageFrom } from "./Register.jsx";

export default function MemberPage({ memberId }) {
  const { user } = useAuth();
  const toast = useToast();
  const { data, error, loading, reload } = useApi(`/members/${memberId}`);
  const [sheet, setSheet] = useState(null); // "pay" | "edit" | "archive" | { year }

  if (loading && !data) return <Loading />;
  if (error) return <ErrorText error={error} />;
  const { member: m, church, ledger, receipts } = data;
  const close = () => setSheet(null);
  const saved = () => { close(); reload(); };

  const restore = async () => {
    try { await api(`/members/${m.id}/restore`, { method: "POST" }); toast(`${m.name} restored`); reload(); }
    catch (e) { toast(e.message, true); }
  };
  const remove = async () => {
    if (!window.confirm(`Delete ${m.name} and all her receipts? This can't be undone. Archiving keeps her history.`)) return;
    try { await api(`/members/${m.id}`, { method: "DELETE" }); toast("Member deleted"); go(`church/${church._id}`); }
    catch (e) { toast(e.message, true); }
  };

  return (
    <>
      <Back href={`#/church/${church._id}`}>{church.name}</Back>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <H1>{m.name}</H1>
          <p className="text-muted">Member since {m.joined}</p>
        </div>
        {m.status === "archived" && <span className="mt-2 rounded-full bg-soft px-3 py-1 text-sm font-bold text-muted">{m.archivedReason}, {m.archivedAt}</span>}
      </div>

      <div className={`mt-4 rounded-xl p-4 ${m.owedCents ? "bg-owesoft" : "bg-paidsoft"}`}>
        {m.owedCents ? (
          <>
            <div className="text-[17px] text-owe"><b className="font-serif text-2xl">{money(m.owedCents)}</b> owed for {plural(m.owingYears.length, "year")}</div>
            <div className="mt-1">{summariseYears(m.owingYears)}</div>
          </>
        ) : <div className="text-[17px] font-bold text-paid">Up to date{m.status === "archived" ? " up to archiving" : ""}</div>}
        <div className="mt-1 text-sm text-muted">{m.lastPaidOn ? `Last paid ${formatDate(m.lastPaidOn)}` : "No dated payment yet"}</div>
      </div>

      {/* Register details */}
      <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2 rounded-xl border border-line bg-surface p-4 sm:grid-cols-2">
        <Detail label="Date of birth" value={m.dateOfBirth ? `${formatDate(m.dateOfBirth)} (age ${ageFrom(m.dateOfBirth)})` : ""} />
        <Detail label="Phone" value={m.phone} />
        <Detail label="Parent or guardian" value={m.guardianName} />
        <Detail label="Guardian's phone" value={m.guardianPhone} />
        <Detail label="Home address or village" value={m.address} />
      </dl>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={() => setSheet("pay")}>Record payment</Button>
        <Button kind="quiet" onClick={() => setSheet("edit")}>Edit</Button>
        {m.status === "archived" ? <Button kind="quiet" onClick={restore}>Restore</Button> : <Button kind="quiet" onClick={() => setSheet("archive")}>Archive</Button>}
        {user.role === "admin" && <Button kind="danger" onClick={remove}>Delete</Button>}
      </div>

      {/* The ledger: one line per year, like a line in the church book */}
      <section className="mt-7">
        <h2 className="font-serif text-xl font-semibold">Yearly tributes</h2>
        <ul className="mt-3 divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {ledger.map((row) => <YearRow key={row.year} row={row} onClick={() => setSheet({ year: row.year })} />)}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="font-serif text-xl font-semibold">Receipts</h2>
        {!receipts.length && <p className="mt-2 text-muted">No payments recorded yet.</p>}
        <ul className="mt-2 divide-y divide-line">
          {receipts.map((r) => (
            <li key={r.id} className={`flex justify-between gap-3 py-2.5 ${r.voided ? "opacity-60" : ""}`}>
              <div>
                <div className={`font-bold ${r.voided ? "line-through" : ""}`}>{money(r.amountCents)} <span className="font-normal">for {summariseYears(r.allocations.map((a) => a.year))}</span></div>
                <div className="text-sm">Paid {formatDate(r.receivedOn)}</div>
                {r.note && <div className="text-sm text-muted">{r.note}</div>}
                {r.voided && <div className="text-sm text-owe">Voided by {r.voidedBy}: {r.voidReason}</div>}
              </div>
              <div className="text-right text-sm text-muted">Recorded by<br />{r.recordedBy}</div>
            </li>
          ))}
        </ul>
      </section>

      {sheet === "pay" && <PaySheet m={m} onClose={close} onSaved={saved} />}
      {sheet === "edit" && <EditSheet m={m} isAdmin={user.role === "admin"} onClose={close} onSaved={saved} />}
      {sheet === "archive" && <ArchiveSheet m={m} onClose={close} onSaved={saved} />}
      {sheet?.year && <YearSheet m={m} row={ledger.find((r) => r.year === sheet.year)} receipts={receipts} onClose={close} onSaved={saved} />}
    </>
  );
}

const STATUS = {
  paid: ["bg-paidsoft text-paid", "Paid"],
  part: ["bg-partsoft text-part", "Part paid"],
  owed: ["bg-owesoft text-owe", "Owed"],
  notdue: ["bg-future text-muted", "Not due"],
};

// One year: amount due, status chip and the date(s) it was paid
function YearRow({ row, onClick }) {
  const [chip, word] = STATUS[row.status];
  const dated = row.paidOn.length ? `Paid ${row.paidOn.map(formatDate).join(" and ")}` : row.paidCents ? "Paid, date not recorded" : "";
  return (
    <li>
      <button onClick={onClick} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue">
        <span className="w-14 shrink-0 font-serif text-lg font-semibold">{row.year}</span>
        <span className="min-w-0 flex-1">
          <span className="block">
            {row.status === "part" ? `${money(row.paidCents)} of ${money(row.feeCents)}` : money(row.feeCents)}
          </span>
          {dated && <span className="block text-sm text-muted">{dated}</span>}
        </span>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-sm font-bold ${chip}`}>{word}</span>
      </button>
    </li>
  );
}

// Record a payment. The date paid is required; the server spreads the amount
// over the oldest unpaid years first.
function PaySheet({ m, onClose, onSaved, year }) {
  const toast = useToast();
  const [amount, setAmount] = useState(m.owedCents ? String(m.owedCents / 100) : "5");
  const [paidOn, setPaidOn] = useState(todayISO());
  const [note, setNote] = useState("");
  const [preview, setPreview] = useState(null);
  const { busy, error, run } = useAction();

  // Ask the server which years this amount would cover (it is the source of truth)
  useEffect(() => {
    const v = parseFloat(amount);
    if (!(v > 0)) return setPreview(null);
    const t = setTimeout(() => api(`/members/${m.id}/payments/preview`, { method: "POST", body: { amount: v, ...(year ? { year } : {}) } })
      .then(setPreview).catch(() => setPreview(null)), 300);
    return () => clearTimeout(t);
  }, [amount, m.id, year]);

  const save = () => run(async () => {
    await api(`/members/${m.id}/payments`, { method: "POST", body: { amount: parseFloat(amount), paidOn, note, ...(year ? { year } : {}) } });
    toast(`${money(Math.round(parseFloat(amount) * 100))} recorded for ${m.name}`);
    onSaved();
  });

  const years = preview?.allocations.map((a) => a.year) || [];
  return (
    <Sheet title={year ? `Pay ${year}` : "Record payment"} onClose={onClose}>
      <div className="space-y-4">
        <Field label="Amount received (USD)"><input className={inputCls} value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" /></Field>
        <Field label="Date paid"><input type="date" className={inputCls} value={paidOn} max={todayISO()} onChange={(e) => setPaidOn(e.target.value)} required /></Field>
        <div className="rounded-lg bg-soft p-3 text-[15px]">
          {years.length ? <>Covers <b>{summariseYears(years)}</b>.</> : "Enter an amount to see which years it covers."}
          {preview?.leftoverCents > 0 && <div className="mt-1 text-owe">{money(preview.leftoverCents)} is more than she owes, even paying next year in advance. Lower the amount.</div>}
        </div>
        <Field label="Note (optional)"><input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. receipt book no. 214" /></Field>
        <ErrorText error={error} />
        <Button className="w-full" onClick={save} disabled={busy || !paidOn || !years.length || preview?.leftoverCents > 0}>Save payment</Button>
      </div>
    </Sheet>
  );
}

// Tap a year: see the receipts that paid it, pay it, or void a wrong receipt
function YearSheet({ m, row, receipts, onClose, onSaved }) {
  const toast = useToast();
  const covering = receipts.filter((r) => !r.voided && r.allocations.some((a) => a.year === row.year));
  const [voiding, setVoiding] = useState(null);
  const [reason, setReason] = useState("");
  const [paying, setPaying] = useState(false);
  const { busy, error, run } = useAction();

  if (paying) return <PaySheet m={m} year={row.year} onClose={onClose} onSaved={onSaved} />;

  const doVoid = () => run(async () => {
    await api(`/members/payments/${voiding}/void`, { method: "POST", body: { reason } });
    toast("Receipt voided");
    onSaved();
  });

  return (
    <Sheet title={`${row.year} tribute`} onClose={onClose}>
      <p>Due: <b>{money(row.feeCents)}</b>. Paid: <b>{money(row.paidCents)}</b>.</p>
      {covering.length > 0 && (
        <ul className="mt-3 divide-y divide-line rounded-lg border border-line">
          {covering.map((r) => (
            <li key={r.id} className="p-3 text-sm">
              <div><b>{money(r.amountCents)}</b> paid {formatDate(r.receivedOn)}</div>
              <div className="text-muted">Covers {summariseYears(r.allocations.map((a) => a.year))}. Recorded by {r.recordedBy}</div>
              {voiding === r.id ? (
                <div className="mt-2 space-y-2">
                  <input className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is this receipt wrong?" />
                  <Button kind="danger" className="w-full" onClick={doVoid} disabled={busy || reason.trim().length < 3}>Void this whole receipt</Button>
                </div>
              ) : <button onClick={() => setVoiding(r.id)} className="mt-1 font-bold text-owe">Void receipt</button>}
            </li>
          ))}
        </ul>
      )}
      <ErrorText error={error} />
      {row.paidCents < row.feeCents && <Button className="mt-4 w-full" onClick={() => setPaying(true)}>Pay {money(row.feeCents - row.paidCents)} for {row.year}</Button>}
    </Sheet>
  );
}

function EditSheet({ m, isAdmin, onClose, onSaved }) {
  const toast = useToast();
  const [f, setF] = useState({ name: m.name, phone: m.phone || "", joined: String(m.joined), churchId: m.churchId });
  const [reg, setReg] = useState({ dateOfBirth: m.dateOfBirth || "", guardianName: m.guardianName || "", guardianPhone: m.guardianPhone || "", address: m.address || "" });
  const churches = useApi(isAdmin ? "/churches" : null); // only admins can move members
  const { busy, error, run } = useAction();
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = () => run(async () => {
    const body = { name: f.name, phone: f.phone, joined: parseInt(f.joined, 10), ...reg, ...(isAdmin ? { churchId: f.churchId } : {}) };
    await api(`/members/${m.id}`, { method: "PATCH", body });
    toast("Changes saved");
    onSaved();
  });
  return (
    <Sheet title="Edit member" onClose={onClose}>
      <div className="space-y-4">
        <Field label="Full name"><input className={inputCls} value={f.name} onChange={set("name")} /></Field>
        <Field label="Phone"><input className={inputCls} value={f.phone} onChange={set("phone")} inputMode="tel" /></Field>
        <RegisterFields value={reg} onChange={setReg} />
        <Field label="Year she joined"><input className={inputCls} value={f.joined} onChange={set("joined")} inputMode="numeric" maxLength={4} /></Field>
        {isAdmin && churches.data && (
          <Field label="Church" hint="Use this if she moves to another church.">
            <select className={inputCls} value={f.churchId} onChange={set("churchId")}>
              {churches.data.churches.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
          </Field>
        )}
        <ErrorText error={error} />
        <Button className="w-full" onClick={save} disabled={busy || !f.name.trim()}>Save changes</Button>
      </div>
    </Sheet>
  );
}

// Archive (e.g. married): tributes stop after the chosen year; history is kept
function ArchiveSheet({ m, onClose, onSaved }) {
  const toast = useToast();
  const [reason, setReason] = useState("Married");
  const [lastYear, setLastYear] = useState(String(thisYear()));
  const { busy, error, run } = useAction();
  const save = () => run(async () => {
    await api(`/members/${m.id}/archive`, { method: "POST", body: { reason, lastYear: parseInt(lastYear, 10) } });
    toast(`${m.name} archived`);
    onSaved();
  });
  return (
    <Sheet title={`Archive ${m.name}`} onClose={onClose}>
      <p className="mb-4 text-muted">Her payment history is kept and you can restore her later. She won't owe tributes after the year below.</p>
      <div className="space-y-4">
        <Field label="Reason">
          <select className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)}>
            {["Married", "Moved away", "Joined another guild", "Left the guild", "Deceased", "Other"].map((r) => <option key={r}>{r}</option>)}
          </select>
        </Field>
        <Field label="Last year she owes for" hint="Usually the year she married, if that year's tribute is still expected.">
          <input className={inputCls} value={lastYear} onChange={(e) => setLastYear(e.target.value)} inputMode="numeric" maxLength={4} />
        </Field>
        <ErrorText error={error} />
        <Button className="w-full" onClick={save} disabled={busy}>Archive member</Button>
      </div>
    </Sheet>
  );
}

// One label/value pair in the details box; shows "Not recorded" when empty
const Detail = ({ label, value }) => (
  <div>
    <dt className="text-sm text-muted">{label}</dt>
    <dd className={value ? "" : "text-muted"}>{value || "Not recorded"}</dd>
  </div>
);
