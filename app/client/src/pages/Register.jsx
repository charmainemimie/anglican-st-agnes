// The guild register: every girl with her details, filterable by church and
// status, with a CSV export. Treasurers only ever see their own churches.
import { useMemo, useState } from "react";
import { useApi } from "../lib/hooks.js";
import { formatDate } from "../lib/format.js";
import { inputCls, Loading, ErrorText, Back, H1 } from "../components/ui.jsx";

// Age in whole years today (birthday not reached yet this year = one less)
export function ageFrom(dob) {
  if (!dob) return null;
  const t = new Date();
  const today = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
  let age = +today.slice(0, 4) - +dob.slice(0, 4);
  if (today.slice(5) < dob.slice(5)) age -= 1;
  return age;
}

export default function Register({ churchId = "" }) {
  const [church, setChurch] = useState(churchId);
  const [status, setStatus] = useState("active");
  const [q, setQ] = useState("");
  const churches = useApi("/churches");
  // Query string built with URLSearchParams so values are always encoded safely
  const params = new URLSearchParams({ status, ...(church ? { churchId: church } : {}) }).toString();
  const reg = useApi(`/register?${params}`);

  // Name filter runs in the browser on the loaded list
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (reg.data?.members || []).filter((m) => !needle || m.name.toLowerCase().includes(needle) || m.guardianName.toLowerCase().includes(needle));
  }, [reg.data, q]);

  // Count missing details so treasurers know what to fill in from the paper book
  const missing = rows.filter((m) => !m.dateOfBirth || !m.guardianName || !m.address).length;

  return (
    <>
      <Back href={church ? `#/church/${church}` : "#/"}>{church ? "Back to church" : "Overview"}</Back>
      <H1>Guild register</H1>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <select className={inputCls} value={church} onChange={(e) => setChurch(e.target.value)} aria-label="Church">
          <option value="">All my churches</option>
          {churches.data?.churches.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
        </select>
        <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
          <option value="active">Active members</option>
          <option value="archived">Archived members</option>
          <option value="all">Everyone</option>
        </select>
        <input className={inputCls} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search girl or guardian" aria-label="Search" />
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted">
          {rows.length} {rows.length === 1 ? "girl" : "girls"}
          {missing > 0 && <span className="text-part">, {missing} with details missing</span>}
        </p>
        {/* Plain link: the browser downloads it with the session cookie. Exports are logged. */}
        <a href={`/api/register/export.csv?${params}`} className="rounded-lg border border-line bg-surface px-4 py-2 text-[15px] font-bold hover:bg-soft">Export register</a>
      </div>

      {reg.loading && !reg.data ? <Loading /> : reg.error ? <ErrorText error={reg.error} /> : (
        <ul className="mt-3 divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {rows.map((m) => (
            <li key={m.id}>
              <a href={`#/member/${m.id}`} className="block px-4 py-3 hover:bg-soft">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span className="font-bold">{m.name}</span>
                  <span className="text-sm text-muted">{m.church}{m.status === "archived" && `, ${m.archivedReason} ${m.archivedAt}`}</span>
                </div>
                <div className="mt-0.5 text-sm">
                  {m.dateOfBirth ? `Born ${formatDate(m.dateOfBirth)}, age ${m.age}` : <span className="text-part">Date of birth missing</span>}
                  {m.phone && `. ${m.phone}`}
                </div>
                <div className="text-sm text-muted">
                  {m.guardianName ? `Guardian: ${m.guardianName}${m.guardianPhone ? `, ${m.guardianPhone}` : ""}` : "No guardian recorded"}
                  {m.address && `. ${m.address}`}
                </div>
              </a>
            </li>
          ))}
          {!rows.length && <li className="px-4 py-8 text-center text-muted">No girls match.</li>}
        </ul>
      )}
    </>
  );
}
