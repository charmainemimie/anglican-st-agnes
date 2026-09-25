// Home: every church the user can see, grouped by archdeaconry, arrears first.
import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api.js";
import { useApi, go } from "../lib/hooks.js";
import { money, plural } from "../lib/format.js";
import { useAuth } from "../App.jsx";
import { Button, inputCls, Loading, ErrorText, H1 } from "../components/ui.jsx";
import { OwedText } from "./Church.jsx";

export default function Overview() {
  const { user } = useAuth();
  const { data, error, loading } = useApi("/reports/overview");
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);

  // Search as the user types, waiting briefly so we don't call on every key
  useEffect(() => {
    if (q.trim().length < 2) return setResults([]);
    const t = setTimeout(() => api(`/members/search?q=${encodeURIComponent(q.trim())}`).then((d) => setResults(d.members)).catch(() => {}), 300);
    return () => clearTimeout(t);
  }, [q]);

  // Group churches under their archdeaconry
  const groups = useMemo(() => {
    const map = {};
    for (const c of data?.churches || []) (map[c.archdeaconry || "Not yet assigned"] ||= []).push(c);
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [data]);

  if (loading && !data) return <Loading />;
  if (error) return <ErrorText error={error} />;

  const t = data.churches.reduce((a, c) => ({
    owed: a.owed + c.owedCents, collected: a.collected + c.collectedCents, active: a.active + c.active, archived: a.archived + c.archived,
  }), { owed: 0, collected: 0, active: 0, archived: 0 });

  return (
    <>
      <H1>{user.role === "treasurer" ? "Your churches" : "Guild tributes"}</H1>
      <div className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-4">
        <Stat label="Outstanding" value={money(t.owed)} tone="text-owe" />
        <Stat label={`Received in ${data.year}`} value={money(t.collected)} tone="text-paid" />
        <Stat label="Active members" value={t.active} />
        <Stat label="Archived" value={t.archived} />
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a member by name" aria-label="Find a member by name" className={`${inputCls} min-w-[12rem] flex-1 !w-auto`} />
        {/* Plain link: the browser downloads it with the session cookie */}
        <a href="#/register" className="inline-flex shrink-0 items-center rounded-lg border border-line bg-surface px-4 text-[15px] font-bold hover:bg-soft">Register</a>
        <a href="/api/reports/arrears.csv" className="inline-flex shrink-0 items-center rounded-lg border border-line bg-surface px-4 text-[15px] font-bold hover:bg-soft">Export arrears</a>
      </div>
      {results.length > 0 && (
        <ul className="mt-2 divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {results.map((m) => (
            <li key={m.id}>
              <a href={`#/member/${m.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-soft">
                <span className="font-bold">{m.name}{m.status === "archived" && <span className="font-normal text-muted"> (archived)</span>}</span>
                <span className="text-sm"><OwedText m={m} /></span>
              </a>
            </li>
          ))}
        </ul>
      )}

      {!data.churches.length && (
        <div className="mt-8 rounded-xl border border-dashed border-line p-6 text-center">
          <p className="text-muted">{user.role === "admin" ? "No churches yet." : "No church is assigned to your account yet. Ask the diocesan office."}</p>
          {user.role === "admin" && <Button className="mt-3" onClick={() => go("setup/churches")}>Add churches</Button>}
        </div>
      )}

      {groups.map(([arch, churches]) => {
        const owed = churches.reduce((s, c) => s + c.owedCents, 0);
        return (
          <section key={arch} className="mt-7">
            <div className="mb-2 flex items-baseline justify-between gap-3 border-b-2 border-blue pb-1">
              <h2 className="font-serif text-xl font-semibold">{arch}</h2>
              <span className={`text-sm font-bold ${owed ? "text-owe" : "text-muted"}`}>{owed ? `${money(owed)} owed` : "Nothing owed"}</span>
            </div>
            <ul className="divide-y divide-line">
              {churches.map((c) => (
                <li key={c.id}>
                  <a href={`#/church/${c.id}`} className="-mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-3 hover:bg-soft">
                    <div className="min-w-0">
                      <div className="truncate font-bold">{c.name}</div>
                      <div className="truncate text-sm text-muted">{c.parish ? `${c.parish} parish, ` : ""}{c.active} active</div>
                    </div>
                    <div className="shrink-0 text-right text-sm">
                      {c.owedCents ? (<><div className="font-bold text-owe">{money(c.owedCents)}</div><div className="text-muted">{plural(c.owingMembers, "member")} owing</div></>)
                        : <span className="font-bold text-paid">Up to date</span>}
                    </div>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </>
  );
}

const Stat = ({ label, value, tone = "" }) => (
  <div className="bg-surface px-4 py-3">
    <div className={`font-serif text-2xl font-semibold ${tone}`}>{value}</div>
    <div className="text-sm text-muted">{label}</div>
  </div>
);
