"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { analyse, parseTranscript, validatePack } from "@/lib/engine";
import { parsePack, TEMPLATE_PACK } from "@/lib/importer";
import { PERSONAS, RIVERBEND } from "@/lib/pack-riverbend";
import type { CompletedCourse, Grade, RulesPack, Season, Student, TransferItem } from "@/lib/types";
import { Bar, btn, btnGhost, card, Chip, input } from "./ui";

const KEY = "creditbridge:v1";
const GRADES: Grade[] = ["A", "B", "C", "D", "F", "P", "W"];

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const a = document.createElement("a"); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
}

function outcomeChip(i: TransferItem) {
  if (i.outcome === "course") return <Chip tone="green">Counts as {i.to}</Chip>;
  if (i.outcome === "gened") return <Chip tone="blue">General education: {i.area}</Chip>;
  if (i.outcome === "elective") return <Chip tone="violet">Elective: {i.area}</Chip>;
  return <Chip tone="red">No credit</Chip>;
}

export default function App() {
  const [pack, setPack] = useState<RulesPack>(RIVERBEND);
  const [student, setStudent] = useState<Student>(PERSONAS[0].student);
  const [personaId, setPersonaId] = useState<string | null>(PERSONAS[0].id);
  const [packErrors, setPackErrors] = useState<string[]>([]);
  const [paste, setPaste] = useState("");
  const [pasteNote, setPasteNote] = useState<{ added: number; skipped: string[] } | null>(null);
  const [addCode, setAddCode] = useState("");
  const [addGrade, setAddGrade] = useState<Grade>("B");
  const [filter, setFilter] = useState<"all" | "accepted" | "rejected">("all");
  const [hydrated, setHydrated] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const s = JSON.parse(raw) as { pack?: RulesPack; student?: Student; personaId?: string | null };
        if (s.pack && validatePack(s.pack).length === 0) setPack(s.pack);
        if (s.student) setStudent(s.student);
        if (s.personaId !== undefined) setPersonaId(s.personaId);
      }
    } catch { /* ignore a corrupt save */ }
    setHydrated(true);
  }, []);
  useEffect(() => { if (hydrated) try { localStorage.setItem(KEY, JSON.stringify({ pack, student, personaId })); } catch { /* storage unavailable */ } }, [pack, student, personaId, hydrated]);

  const result = useMemo(() => analyse(pack, student), [pack, student]);
  const { transfer, audit, plan, suggestions } = result;
  const degree = pack.degree;
  const catalog = useMemo(() => new Map(pack.sending.courses.map((c) => [c.code, c])), [pack]);
  const taken = new Set(student.completed.map((c) => c.code));
  const open = audit.statuses.filter((s) => !s.satisfied);
  const done = audit.statuses.filter((s) => s.satisfied);
  const items = transfer.items.filter((i) => (filter === "all" ? true : filter === "accepted" ? i.outcome !== "none" : i.outcome === "none"));

  const edit = (fn: (s: Student) => Student) => { setStudent(fn); setPersonaId(null); };
  const setGrade = (idx: number, grade: Grade) => edit((s) => ({ ...s, completed: s.completed.map((c, i) => (i === idx ? { ...c, grade } : c)) }));
  const remove = (idx: number) => edit((s) => ({ ...s, completed: s.completed.filter((_, i) => i !== idx) }));
  const add = (c: CompletedCourse) => edit((s) => ({ ...s, completed: [...s.completed, c] }));

  const importPack = async (file: File) => {
    const r = parsePack(await file.text());
    if (!r.ok) { setPackErrors(r.errors); return; }
    setPackErrors([]); setPack(r.pack); setStudent({ ...student, completed: [] }); setPersonaId(null);
  };

  return (
    <div>
      <div className="bg-[#163300] text-white"><div className="mx-auto max-w-6xl px-5 pb-14 pt-8">
      <header>
        <div className="flex items-center gap-2 text-sm font-semibold tracking-tight"><span className="grid size-7 place-items-center rounded-full bg-[#9fe870] text-[#163300] font-bold">C</span>CreditBridge</div>
        <h1 className="mt-8 max-w-3xl text-4xl font-extrabold leading-[1.02] tracking-[-0.04em] sm:text-6xl">What transfers, what is left,<br className="hidden sm:block" /> and the fastest way to graduate.</h1>
        <p className="mt-5 max-w-2xl text-[#cdffad]/80">
          Transfer credit is a rulebook: grade minimums, a cap, residency, courses offered in one season, prerequisite chains. Pick a student, change
          a grade, and watch every course resolve, the degree audit fill in, and the plan to graduation rebuild.
        </p>
        <p className="mt-3 inline-block rounded-lg bg-white/10 px-3 py-1.5 text-sm text-[#ffd11a]">
          {pack.synthetic ? "All schools and students here are invented. Nothing describes a real institution or person." : "This pack is marked as real rules. Confirm every result with the receiving school's advisor."}
        </p>
      </header>
      </div></div>
      <div className="mx-auto max-w-6xl px-5 pb-10 pt-8">

      <section className={`${card} mt-8 p-5`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">The rules</h2>
            <p className="text-sm text-neutral-500">{pack.sending.name} to {pack.receiving.name}, {degree.name}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className={btnGhost} onClick={() => download(`${pack.id}.json`, JSON.stringify(pack, null, 2))}>Download this pack</button>
            <button className={btnGhost} onClick={() => download("my-pack-template.json", JSON.stringify(TEMPLATE_PACK, null, 2))}>Download a blank template</button>
            <button className={btn} onClick={() => fileRef.current?.click()}>Import a pack</button>
            <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" data-testid="pack-file" onChange={(e) => { const f = e.target.files?.[0]; if (f) void importPack(f); e.target.value = ""; }} />
          </div>
        </div>
        <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-400">{pack.description}</p>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          {([["Degree total", `${degree.totalCredits} credits`], ["Transfer cap", `${degree.transferCap} credits`], ["Residency", `${degree.residencyMin} credits at the receiving school`], ["Minimum grade", `${pack.defaultMinGrade} (some courses stricter)`]] as const).map(([k, v]) => (
            <div key={k}><dt className="text-xs text-neutral-500">{k}</dt><dd className="font-medium">{v}</dd></div>
          ))}
        </dl>
        {packErrors.length > 0 && (
          <div role="alert" className="mt-4 rounded-xl bg-red-500/10 p-3 text-sm text-red-800 dark:text-red-300">
            <div className="font-medium">That pack was not loaded. Fix these first:</div>
            <ul className="mt-1 list-disc pl-5">{packErrors.slice(0, 8).map((e) => <li key={e}>{e}</li>)}</ul>
          </div>
        )}
      </section>

      <section className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className={`${card} min-w-0 p-5 lg:col-span-2`}>
          <h2 className="text-lg font-semibold">The student</h2>
          {pack.id === RIVERBEND.id && (
            <div className="mt-3 grid gap-2">
              {PERSONAS.map((p) => (
                <button key={p.id} onClick={() => { setStudent(p.student); setPersonaId(p.id); }} aria-pressed={personaId === p.id}
                  className={`rounded-xl border p-3 text-left text-sm transition-colors ${personaId === p.id ? "border-neutral-900 bg-neutral-100 dark:border-white dark:bg-neutral-800" : "border-neutral-200 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-800/50"}`}>
                  <div className="font-medium">{p.label}</div><div className="text-xs text-neutral-500">{p.blurb}</div>
                </button>
              ))}
            </div>
          )}
          <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
            <label className="text-xs text-neutral-500">Credits per term
              <select className={`${input} mt-1`} value={student.maxCreditsPerTerm} onChange={(e) => edit((s) => ({ ...s, maxCreditsPerTerm: Number(e.target.value) }))}>{[9, 12, 15, 18].map((n) => <option key={n}>{n}</option>)}</select></label>
            <label className="text-xs text-neutral-500">Starting
              <select className={`${input} mt-1`} value={student.start.season} onChange={(e) => edit((s) => ({ ...s, start: { ...s.start, season: e.target.value as Season } }))}><option value="fall">Fall</option><option value="spring">Spring</option><option value="summer">Summer</option></select></label>
            <label className="text-xs text-neutral-500">Year
              <select className={`${input} mt-1`} value={student.start.year} onChange={(e) => edit((s) => ({ ...s, start: { ...s.start, year: Number(e.target.value) } }))}>{[2027, 2028, 2029].map((y) => <option key={y}>{y}</option>)}</select></label>
          </div>
          <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={student.includeSummer} onChange={(e) => edit((s) => ({ ...s, includeSummer: e.target.checked }))} className="accent-neutral-900" /> Take summer terms</label>

          <h3 className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-neutral-500">Completed courses <span className="font-mono">{student.completed.length}</span></h3>
          <div className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
            {student.completed.map((c, i) => (
              <div key={`${c.code}-${i}`} className="flex items-center gap-2 text-sm">
                <span className="w-16 shrink-0 font-mono text-xs">{c.code}</span>
                <span className="min-w-0 flex-1 truncate text-neutral-500">{catalog.get(c.code)?.title ?? "Unknown course"}</span>
                <select aria-label={`Grade for ${c.code}`} value={c.grade} onChange={(e) => setGrade(i, e.target.value as Grade)} className="rounded-md border border-neutral-300 bg-transparent px-1.5 py-0.5 text-xs dark:border-neutral-700">{GRADES.map((g) => <option key={g}>{g}</option>)}</select>
                <button aria-label={`Remove ${c.code}`} onClick={() => remove(i)} className="text-neutral-400 hover:text-neutral-900 dark:hover:text-white">×</button>
              </div>
            ))}
            {student.completed.length === 0 && <p className="text-sm text-neutral-400">No courses yet. Add some below.</p>}
          </div>
          <div className="mt-3 flex gap-2">
            <select aria-label="Add a course" className={input} value={addCode} onChange={(e) => setAddCode(e.target.value)}>
              <option value="">Add a course...</option>
              {pack.sending.courses.filter((c) => !taken.has(c.code)).map((c) => <option key={c.code} value={c.code}>{c.code} {c.title}</option>)}
            </select>
            <select aria-label="Grade" className={`${input} !w-20`} value={addGrade} onChange={(e) => setAddGrade(e.target.value as Grade)}>{GRADES.map((g) => <option key={g}>{g}</option>)}</select>
            <button className={btn} disabled={!addCode} onClick={() => { add({ code: addCode, grade: addGrade }); setAddCode(""); }}>Add</button>
          </div>
          <details className="mt-4">
            <summary className="cursor-pointer text-sm text-neutral-500">Or paste a transcript</summary>
            <textarea rows={6} className={`${input} mt-2 font-mono text-xs`} placeholder={"CSC 101 Introduction to Programming 4.0 A\nMAT 181 Calculus I B+"} value={paste} onChange={(e) => setPaste(e.target.value)} />
            <button className={`${btnGhost} mt-2`} onClick={() => { const r = parseTranscript(pack, paste); const fresh = r.found.filter((f) => !student.completed.some((c) => c.code === f.code)); edit((s) => ({ ...s, completed: [...s.completed, ...fresh] })); setPasteNote({ added: fresh.length, skipped: r.skipped }); setPaste(""); }}>Read it</button>
            {pasteNote && <p className="mt-2 text-xs text-neutral-500">Added {pasteNote.added} course{pasteNote.added === 1 ? "" : "s"}.{pasteNote.skipped.length > 0 && ` Could not use ${pasteNote.skipped.length} line${pasteNote.skipped.length === 1 ? "" : "s"}: ${pasteNote.skipped.slice(0, 3).join(" | ")}`}</p>}
          </details>
        </div>

        <div className="min-w-0 space-y-6 lg:col-span-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className={`${card} p-4`}><div className="text-2xl font-semibold tabular-nums">{transfer.acceptedCredits}<span className="text-base font-normal text-neutral-400"> / {degree.transferCap}</span></div><div className="text-xs text-neutral-500">credits accepted</div><div className="mt-2"><Bar value={transfer.acceptedCredits} max={degree.transferCap} tone="bg-emerald-500" /></div></div>
            <div className={`${card} p-4`}><div className="text-2xl font-semibold tabular-nums">{transfer.rejectedCredits}</div><div className="text-xs text-neutral-500">credits refused</div></div>
            <div className={`${card} p-4`}><div className="text-2xl font-semibold tabular-nums">{plan.totalRemainingCredits}</div><div className="text-xs text-neutral-500">credits left to earn</div></div>
            <div className={`${card} p-4`}><div className="text-2xl font-semibold tabular-nums">{plan.terms.length}<span className="text-base font-normal text-neutral-400"> terms</span></div><div className="text-xs text-neutral-500">{plan.graduation ? `Graduate ${plan.graduation}` : "No plan"}</div></div>
          </div>

          <section className={`${card} p-5`}>
            <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Every course, resolved</h2>
              <div className="flex gap-1">{(["all", "accepted", "rejected"] as const).map((f) => <button key={f} onClick={() => setFilter(f)} aria-pressed={filter === f} className={`rounded-full px-3 py-1 text-xs ${filter === f ? "bg-[#163300] text-[#9fe870] dark:bg-[#9fe870] dark:text-[#163300]" : "text-neutral-500 hover:bg-[#e2f6d5] dark:hover:bg-[#24351a]"}`}>{f}</button>)}</div></div>
            <ul className="mt-3 divide-y divide-neutral-100 dark:divide-neutral-800">
              {items.map((i, k) => (
                <li key={`${i.from}-${k}`} className="flex flex-wrap items-start gap-x-3 gap-y-1 py-2.5 text-sm">
                  <span className="w-16 shrink-0 font-mono text-xs">{i.from}</span>
                  <span className="min-w-40 flex-1"><span className="font-medium">{i.title}</span><span className="ml-2 text-xs text-neutral-400">grade {i.grade}</span><div className="text-xs text-neutral-500">{i.reason}</div></span>
                  <span className="flex items-center gap-2">{outcomeChip(i)}<span className="w-10 text-right font-mono text-xs text-neutral-500">{i.awardedCredits ? `${i.awardedCredits} cr` : ""}</span></span>
                </li>
              ))}
              {items.length === 0 && <li className="py-6 text-center text-sm text-neutral-400">Nothing here.</li>}
            </ul>
          </section>

          <section className={`${card} p-5`}>
            <h2 className="text-lg font-semibold">Degree audit <span className="text-sm font-normal text-neutral-500">{done.length} of {audit.statuses.length} requirements met</span></h2>
            <ul className="mt-3 space-y-2">
              {[...open, ...done].map((s) => (
                <li key={s.id} className="rounded-xl border border-neutral-200 p-3 text-sm dark:border-neutral-800">
                  <div className="flex items-start justify-between gap-3"><span className="font-medium">{s.label}</span>{s.satisfied ? <Chip tone="green">Met</Chip> : s.creditsDone > 0 ? <Chip tone="amber">{s.creditsDone} of {s.creditsNeeded} cr</Chip> : <Chip tone="gray">Open</Chip>}</div>
                  {s.usedBy.length > 0 && <div className="mt-1 text-xs text-neutral-500">Met by {s.usedBy.join(", ")}</div>}
                </li>
              ))}
            </ul>
            {audit.freeElectiveCredits > 0 && <p className="mt-3 text-xs text-neutral-500">{audit.freeElectiveCredits} accepted credits are not used by any requirement and count as free electives.</p>}
          </section>

          <section className={`${card} p-5`}>
            <h2 className="text-lg font-semibold">The plan</h2>
            <p className="text-sm text-neutral-500">
              {plan.terms.length} term{plan.terms.length === 1 ? "" : "s"}. The fewest possible for this load is {plan.lowerBoundTerms}.
              {plan.optimal ? " This plan reaches that minimum." : ` This plan is ${plan.terms.length - plan.lowerBoundTerms} over it.`}
            </p>
            {plan.warnings.map((w) => <p key={w} role="alert" className="mt-2 rounded-lg bg-red-500/10 p-2 text-sm text-red-800 dark:text-red-300">{w}</p>)}
            <ol className="mt-4 space-y-2.5">
              {plan.terms.map((t) => (
                <li key={t.label} className="flex flex-wrap items-start gap-3 text-sm">
                  <div className="w-28 shrink-0"><div className="font-medium">{t.label}</div><div className="text-xs text-neutral-500">{t.credits} credits</div></div>
                  <div className="flex flex-1 flex-wrap gap-1.5">{t.courses.map((c) => <span key={c.code + c.credits} title={c.title} className={`rounded-md px-2 py-1 text-xs ${c.free ? "border border-dashed border-neutral-300 text-neutral-500 dark:border-neutral-700" : "bg-neutral-100 dark:bg-neutral-800"}`}>{c.free ? `Free elective ${c.credits} cr` : `${c.code} ${c.title}`}</span>)}</div>
                </li>
              ))}
            </ol>
          </section>

          {suggestions.length > 0 && (
            <section className={`${card} p-5`}>
              <h2 className="text-lg font-semibold">Take these before you transfer</h2>
              <p className="text-sm text-neutral-500">Courses at {pack.sending.name} that would satisfy something still open here.</p>
              <ul className="mt-3 divide-y divide-neutral-100 dark:divide-neutral-800">
                {suggestions.map((s) => (
                  <li key={s.from} className="flex flex-wrap items-center gap-x-3 py-2 text-sm">
                    <span className="w-16 font-mono text-xs">{s.from}</span><span className="min-w-40 flex-1">{s.title}<span className="block text-xs text-neutral-500">Counts as {s.satisfies} for {s.requirement}</span></span>
                    <span className="text-xs text-neutral-500">{s.credits} cr</span>{!s.capOk && <Chip tone="amber">Would exceed the cap</Chip>}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </section>

      <footer className="mt-12 border-t border-neutral-200 pt-5 text-xs leading-relaxed text-neutral-500 dark:border-neutral-800">
        A planning aid, not an official evaluation. The receiving school decides what transfers, and a rules pack is only as accurate as its source. The plan is a heuristic that
        also reports the theoretical minimum, so you can see how close it is. Your data stays in this browser.
      </footer>
    </div>
    </div>
  );
}
