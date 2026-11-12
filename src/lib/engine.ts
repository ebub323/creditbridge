import type {
  AuditResult, Course, Grade, Plan, PlannedTerm, RequirementStatus, RulesPack, Season, Student, Suggestion, TermRef, TransferItem, TransferResult,
} from "./types";
import { GRADE_POINTS } from "./types";

const byCode = <T extends { code: string }>(xs: T[]) => new Map(xs.map((x) => [x.code, x]));
export const norm = (code: string) => code.toUpperCase().replace(/([A-Z]+)\s*-?\s*(\d)/, "$1 $2").replace(/\s+/g, " ").trim();

// ---------------------------------------------------------------- grades
const passes = (grade: Grade, min: keyof typeof GRADE_POINTS): boolean =>
  grade === "P" ? true : grade === "W" ? false : GRADE_POINTS[grade] >= GRADE_POINTS[min];

// ---------------------------------------------------------------- 1. transfer evaluation
/**
 * Decide, course by course, what the receiving school will do with each course
 * a student completed: map it to a course, to elective or general-education
 * credit, or refuse it, and say why. Then apply the transfer cap.
 */
export function evaluateTransfer(pack: RulesPack, student: Pick<Student, "completed">): TransferResult {
  const sending = byCode(pack.sending.courses);
  const equiv = new Map(pack.equivalencies.map((e) => [norm(e.from), e]));
  const receiving = byCode(pack.receiving.courses);
  const seenFrom = new Set<string>();
  const seenTarget = new Set<string>();
  const items: TransferItem[] = [];

  for (const c of student.completed) {
    const code = norm(c.code);
    const sc = sending.get(code);
    const base = { from: code, grade: c.grade, title: sc?.title ?? "Unknown course", sendingCredits: sc?.credits ?? 0 };
    const none = (reason: string, flag: TransferItem["flags"][number]): TransferItem => ({ ...base, outcome: "none", awardedCredits: 0, reason, flags: [flag] });

    if (!sc) { items.push(none(`${code} is not in ${pack.sending.name}'s catalog`, "unknown-course")); continue; }
    if (seenFrom.has(code)) { items.push(none("Already counted: repeated course", "duplicate")); continue; }
    if (c.grade === "W" || c.grade === "F") { items.push(none(`A grade of ${c.grade} earns no credit`, "no-credit-grade")); continue; }
    const e = equiv.get(code);
    if (!e) { items.push(none("No equivalency on file", "no-equivalency")); continue; }
    if (e.to.kind === "none") { items.push(none(e.to.reason, "no-equivalency")); continue; }
    const min = e.minGrade ?? pack.defaultMinGrade;
    if (c.grade === "P" && !pack.acceptPass) { items.push(none("Pass/fail grades are not accepted", "below-min-grade")); continue; }
    if (!passes(c.grade, min)) { items.push(none(`Grade ${c.grade} is below the minimum of ${min}`, "below-min-grade")); continue; }

    const flags: TransferItem["flags"] = [];
    if (e.to.kind === "course") {
      if (seenTarget.has(e.to.code)) { items.push(none(`Duplicates credit already given for ${e.to.code}`, "duplicate")); continue; }
      const target = receiving.get(e.to.code);
      if (target && sc.credits < target.credits) flags.push("shortfall");
      seenTarget.add(e.to.code);
      items.push({ ...base, outcome: "course", to: e.to.code, awardedCredits: sc.credits, reason: e.note ?? `Counts as ${e.to.code}`, flags });
    } else if (e.to.kind === "gened") {
      items.push({ ...base, outcome: "gened", area: e.to.area, awardedCredits: sc.credits, reason: e.note ?? `General education: ${e.to.area}`, flags });
    } else {
      items.push({ ...base, outcome: "elective", area: e.to.area, awardedCredits: sc.credits, reason: e.note ?? `Elective credit (${e.to.area})`, flags });
    }
    seenFrom.add(code);
  }

  // The transfer cap. When it binds, spend it where it does the most work: courses that satisfy a
  // requirement first, then general education, then free electives. Taking credit in the order it was
  // earned would burn the cap on electives and refuse the courses the degree actually needs.
  // Among courses, the ones that unlock the most later courses come first: transferring a prerequisite
  // chain shortens the time to graduate, while a stand-alone course only saves credits.
  const dependents = (code: string): number => {
    const seen = new Set<string>(); const stack = [code];
    while (stack.length) {
      const cur = stack.pop() as string;
      for (const c of pack.receiving.courses) if (!seen.has(c.code) && c.prereqs.some((g) => g.includes(cur))) { seen.add(c.code); stack.push(c.code); }
    }
    return seen.size;
  };
  const value = (i: TransferItem) => (i.outcome === "course" ? 1000 + dependents(i.to as string) * 10 : i.outcome === "gened" ? 500 : 0) + i.awardedCredits;
  const eligible = items.filter((i) => i.outcome !== "none");
  const keep = new Set<TransferItem>();
  let used = 0;
  const ranked = [...eligible].sort((a, b) => value(b) - value(a));
  for (const it of ranked) if (used + it.awardedCredits <= pack.degree.transferCap) { keep.add(it); used += it.awardedCredits; }
  for (const it of eligible) {
    if (keep.has(it)) continue;
    it.outcome = "none"; it.reason = `Over the ${pack.degree.transferCap}-credit transfer cap`; it.flags = ["over-cap"]; it.awardedCredits = 0; it.to = undefined; it.area = undefined;
  }
  const accepted = items.filter((i) => keep.has(i));
  const rejectedCredits = items.filter((i) => i.outcome === "none" && i.sendingCredits).reduce((s, i) => s + i.sendingCredits, 0);
  return { items, accepted, acceptedCredits: used, rejectedCredits, capUsed: used, capRoom: pack.degree.transferCap - used };
}

// ---------------------------------------------------------------- 2. degree audit
/**
 * Match accepted credit to degree requirements without counting any course twice.
 * Specific courses are matched first, then "choose N", then credit pools, then
 * general education, so a flexible requirement never steals a course a fixed one needs.
 */
export function auditDegree(pack: RulesPack, transfer: Pick<TransferResult, "accepted">): AuditResult {
  const receiving = byCode(pack.receiving.courses);
  const used = new Set<TransferItem>();
  const takenCodes = new Set(transfer.accepted.filter((a) => a.outcome === "course" && a.to).map((a) => a.to as string));
  const statuses = new Map<string, RequirementStatus>();
  const courseItem = (code: string) => transfer.accepted.find((a) => a.outcome === "course" && a.to === code && !used.has(a));
  const credits = (code: string) => receiving.get(code)?.credits ?? 0;

  const reqs = pack.degree.requirements;
  const order = { course: 0, choose: 1, credits: 2, gened: 3 } as const;
  for (const r of [...reqs].sort((a, b) => order[a.type] - order[b.type])) {
    const st: RequirementStatus = { id: r.id, label: r.label, type: r.type, satisfied: false, creditsDone: 0, creditsNeeded: 0, usedBy: [], options: [], remaining: 0 };
    if (r.type === "course") {
      st.creditsNeeded = credits(r.code); st.options = [r.code];
      const it = courseItem(r.code);
      if (it) { used.add(it); st.usedBy.push(it.from); st.creditsDone = st.creditsNeeded; st.satisfied = true; }
      else st.remaining = 1;
    } else if (r.type === "choose") {
      st.options = r.from;
      const matches = r.from.map(courseItem).filter((x): x is TransferItem => !!x).slice(0, r.n);
      for (const it of matches) { used.add(it); st.usedBy.push(it.from); st.creditsDone += credits(it.to as string); }
      st.creditsNeeded = r.n * Math.max(...r.from.map(credits));
      st.remaining = r.n - matches.length; st.satisfied = st.remaining === 0;
    } else if (r.type === "credits") {
      st.options = r.from; st.creditsNeeded = r.credits;
      for (const code of r.from) {
        if (st.creditsDone >= r.credits) break;
        const it = courseItem(code);
        if (it) { used.add(it); st.usedBy.push(it.from); st.creditsDone += it.awardedCredits; }
      }
      st.remaining = Math.max(0, r.credits - st.creditsDone); st.satisfied = st.remaining === 0;
    } else {
      st.creditsNeeded = r.credits;
      st.options = pack.receiving.courses.filter((c) => c.tags?.includes(`gened:${r.area}`)).map((c) => c.code);
      for (const it of transfer.accepted) {
        if (st.creditsDone >= r.credits) break;
        if (used.has(it)) continue;
        const fits = (it.outcome === "gened" && it.area === r.area) || (it.outcome === "course" && receiving.get(it.to as string)?.tags?.includes(`gened:${r.area}`));
        if (fits) { used.add(it); st.usedBy.push(it.from); st.creditsDone += it.awardedCredits; }
      }
      st.remaining = Math.max(0, r.credits - st.creditsDone); st.satisfied = st.remaining === 0;
    }
    statuses.set(r.id, st);
  }
  const free = transfer.accepted.filter((a) => !used.has(a)).reduce((s, a) => s + a.awardedCredits, 0);
  const acceptedCredits = transfer.accepted.reduce((s, a) => s + a.awardedCredits, 0);
  return { statuses: reqs.map((r) => statuses.get(r.id) as RequirementStatus), usedItems: used, freeElectiveCredits: free, takenCodes, acceptedCredits };
}

// ---------------------------------------------------------------- 3. what is left, with prerequisites
function depth(code: string, courses: Map<string, Course>, taken: Set<string>, memo = new Map<string, number>(), stack = new Set<string>()): number {
  if (taken.has(code)) return 0;
  if (memo.has(code)) return memo.get(code) as number;
  if (stack.has(code)) return 0;           // a cycle: validatePack reports it; do not loop here
  stack.add(code);
  const c = courses.get(code);
  let d = 1;
  if (c) for (const group of c.prereqs) {
    if (group.some((g) => taken.has(g))) continue;
    d = Math.max(d, 1 + Math.min(...group.map((g) => depth(g, courses, taken, memo, stack))));
  }
  stack.delete(code); memo.set(code, d);
  return d;
}

/**
 * Turn the unmet requirements into concrete courses to take, choosing the
 * options that are cheapest in prerequisites, and pull in any prerequisite the
 * student does not already have.
 */
export function remainingWork(pack: RulesPack, audit: AuditResult): { needed: Course[]; freeElectiveCredits: number } {
  const courses = byCode(pack.receiving.courses);
  const taken = new Set(audit.takenCodes);
  const chosen = new Map<string, Course>();
  const add = (code: string) => { const c = courses.get(code); if (c && !taken.has(code)) chosen.set(code, c); };
  const rank = (code: string) => depth(code, courses, taken) * 100 + (courses.get(code)?.credits ?? 0);

  for (const st of audit.statuses) {
    if (st.satisfied) continue;
    const open = st.options.filter((o) => !taken.has(o) && !chosen.has(o)).sort((a, b) => rank(a) - rank(b));
    if (st.type === "course") add(st.options[0]);
    else if (st.type === "choose") open.slice(0, st.remaining).forEach(add);
    else {
      let need = st.remaining;
      for (const o of open) { if (need <= 0) break; add(o); need -= courses.get(o)?.credits ?? 0; }
    }
  }
  // Prerequisite closure: add what a chosen course needs and the student lacks.
  let grew = true;
  while (grew) {
    grew = false;
    for (const c of [...chosen.values()]) for (const group of c.prereqs) {
      if (group.some((g) => taken.has(g) || chosen.has(g))) continue;
      const pick = [...group].sort((a, b) => rank(a) - rank(b))[0];
      if (pick && courses.has(pick)) { add(pick); grew = true; }
    }
  }
  const needed = [...chosen.values()];
  const neededCredits = needed.reduce((s, c) => s + c.credits, 0);
  const fill = Math.max(pack.degree.totalCredits - audit.acceptedCredits - neededCredits, pack.degree.residencyMin - neededCredits, 0);
  return { needed, freeElectiveCredits: Math.ceil(fill) };
}

// ---------------------------------------------------------------- 4. the plan
const NEXT: Record<Season, Season> = { fall: "spring", spring: "summer", summer: "fall" };
export function nextTerm(t: TermRef, includeSummer: boolean): TermRef {
  let s = NEXT[t.season]; let y = t.year;
  if (s === "summer" && !includeSummer) s = NEXT[s];
  // the year turns over when we pass from fall to spring
  if (t.season === "fall") y = t.year + 1;
  return { season: s, year: y };
}
export const termLabel = (t: TermRef) => `${t.season[0].toUpperCase()}${t.season.slice(1)} ${t.year}`;

/**
 * Schedule the remaining courses term by term. A course needs every prerequisite
 * finished in an EARLIER term and must be offered that season. Within a term the
 * longest remaining chain goes first, which is what keeps a graduation date from
 * slipping because a prerequisite was left until last.
 */
export function planTerms(pack: RulesPack, student: Student, audit: AuditResult, work: { needed: Course[]; freeElectiveCredits: number }): Plan {
  const courses = byCode(pack.receiving.courses);
  const warnings: string[] = [];
  const done = new Set(audit.takenCodes);
  const pending = new Map(work.needed.map((c) => [c.code, c]));
  const chain = new Map<string, number>();
  const taken0 = new Set(audit.takenCodes);
  const chainOf = (code: string): number => {
    if (chain.has(code)) return chain.get(code) as number;
    // how many later courses still depend on this one
    let n = 0;
    for (const c of pending.values()) if (c.prereqs.some((g) => g.includes(code))) n = Math.max(n, 1 + chainOf(c.code));
    chain.set(code, n); return n;
  };
  const cap = student.maxCreditsPerTerm;
  let free = work.freeElectiveCredits;
  const terms: PlannedTerm[] = [];
  let term: TermRef = student.start;
  let idle = 0;

  if (pack.receiving.courses.some((c) => c.credits > cap)) warnings.push(`A course needs more than your ${cap}-credit limit per term.`);

  for (let guard = 0; guard < 24 && (pending.size > 0 || free > 0); guard++) {
    if (term.season === "summer" && !student.includeSummer) term = nextTerm(term, student.includeSummer);
    const ready = [...pending.values()].filter((c) => c.offered.includes(term.season) && c.prereqs.every((g) => g.some((x) => done.has(x))));
    ready.sort((a, b) => chainOf(b.code) - chainOf(a.code) || b.credits - a.credits || a.code.localeCompare(b.code));
    const picked: PlannedTerm["courses"] = [];
    let load = 0;
    for (const c of ready) if (load + c.credits <= cap) { picked.push({ code: c.code, title: c.title, credits: c.credits }); load += c.credits; }
    // Required courses come first. Free electives can be taken in any term, so they fill whatever room is left.
    const room = cap - load;
    if (free > 0 && room > 0) {
      const take = Math.min(room, free);
      picked.push({ code: "ELECTIVE", title: "Free elective", credits: take, free: true });
      load += take; free -= take;
    }
    if (picked.length === 0) { idle++; if (idle > 4) break; term = nextTerm(term, student.includeSummer); continue; }
    idle = 0;
    for (const p of picked) { if (!p.free) { done.add(p.code); pending.delete(p.code); } }
    terms.push({ label: termLabel(term), season: term.season, year: term.year, courses: picked, credits: load });
    term = nextTerm(term, student.includeSummer);
  }

  const left = [...pending.keys()];
  if (left.length) warnings.push(`Could not schedule: ${left.join(", ")}. Check when they are offered and what they require.`);
  if (free > 0 && !left.length) warnings.push(`${free} elective credits could not be placed.`);

  // A lower bound on the number of terms, so "optimal" is something we can check rather than claim.
  const lowest = (() => {
    const all = work.needed;
    const d = (code: string, m = new Map<string, number>()): number => {
      if (m.has(code)) return m.get(code) as number;
      const c = courses.get(code); if (!c || taken0.has(code)) return 0;
      let v = 1; for (const g of c.prereqs) { if (g.some((x) => taken0.has(x))) continue; v = Math.max(v, 1 + Math.min(...g.map((x) => d(x, m)))); }
      m.set(code, v); return v;
    };
    const critical = all.length ? Math.max(...all.map((c) => d(c.code))) : 0;
    const byLoad = Math.ceil((all.reduce((s, c) => s + c.credits, 0) + work.freeElectiveCredits) / cap);
    return Math.max(critical, byLoad);
  })();

  const totalRemaining = work.needed.reduce((s, c) => s + c.credits, 0) + work.freeElectiveCredits;
  return {
    needed: work.needed, freeElectiveCredits: work.freeElectiveCredits, terms, graduation: terms.length ? terms[terms.length - 1].label : null,
    totalRemainingCredits: totalRemaining, lowerBoundTerms: lowest, optimal: terms.length <= lowest, warnings,
  };
}

// ---------------------------------------------------------------- 5. take these before you transfer
/** Cheap wins: sending-school courses that would satisfy something still outstanding. */
export function suggestBeforeTransfer(pack: RulesPack, transfer: TransferResult, audit: AuditResult, work: { needed: Course[] }): Suggestion[] {
  const takenFrom = new Set(transfer.items.map((i) => i.from));
  const sending = byCode(pack.sending.courses);
  const neededCodes = new Set(work.needed.map((c) => c.code));
  const reqFor = (code: string) => audit.statuses.find((s) => !s.satisfied && s.options.includes(code))?.label ?? "Degree requirement";
  const out: Suggestion[] = [];
  for (const e of pack.equivalencies) {
    const from = norm(e.from);
    if (takenFrom.has(from) || e.to.kind !== "course" || !neededCodes.has(e.to.code)) continue;
    const sc = sending.get(from); if (!sc) continue;
    out.push({ from, title: sc.title, credits: sc.credits, satisfies: e.to.code, requirement: reqFor(e.to.code), capOk: transfer.capRoom >= sc.credits });
  }
  return out.sort((a, b) => Number(b.capOk) - Number(a.capOk) || b.credits - a.credits || a.from.localeCompare(b.from));
}

// ---------------------------------------------------------------- 6. reading a pasted transcript
const GRADE_RE = /\b([ABCDF][+-]?|P|W)\b/;
export function parseTranscript(pack: RulesPack, text: string): { found: { code: string; grade: Grade }[]; skipped: string[] } {
  const known = new Set(pack.sending.courses.map((c) => c.code));
  const found: { code: string; grade: Grade }[] = []; const skipped: string[] = [];
  for (const line of text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)) {
    const m = line.match(/\b([A-Za-z]{2,4})\s*-?\s*(\d{3})\b/);
    const code = m ? norm(`${m[1]} ${m[2]}`) : "";
    if (!code || !known.has(code)) { skipped.push(line); continue; }
    const rest = line.replace(m![0], " ");
    const g = rest.match(GRADE_RE)?.[1];
    if (!g) { skipped.push(line); continue; }
    found.push({ code, grade: g[0] as Grade });
  }
  return { found, skipped };
}

// ---------------------------------------------------------------- 7. checking a pack before trusting it
/** A rules pack is data someone typed. Catch the mistakes that would silently corrupt a plan. */
export function validatePack(pack: RulesPack): string[] {
  const errs: string[] = [];
  const codes = new Set<string>();
  for (const c of pack.receiving.courses) { if (codes.has(c.code)) errs.push(`Duplicate receiving course ${c.code}`); codes.add(c.code); if (c.credits <= 0) errs.push(`${c.code} has no credits`); if (!c.offered.length) errs.push(`${c.code} is never offered`); }
  for (const c of pack.receiving.courses) for (const g of c.prereqs) for (const p of g) if (!codes.has(p)) errs.push(`${c.code} requires unknown course ${p}`);
  // cycles
  const state = new Map<string, 0 | 1 | 2>();
  const visit = (code: string, path: string[]) => {
    if (state.get(code) === 2) return;
    if (state.get(code) === 1) { errs.push(`Prerequisite cycle: ${[...path, code].join(" -> ")}`); return; }
    state.set(code, 1);
    const c = pack.receiving.courses.find((x) => x.code === code);
    for (const g of c?.prereqs ?? []) for (const p of g) if (codes.has(p)) visit(p, [...path, code]);
    state.set(code, 2);
  };
  for (const c of codes) visit(c, []);
  const sendCodes = new Set<string>();
  for (const s of pack.sending.courses) { if (sendCodes.has(s.code)) errs.push(`Duplicate sending course ${s.code}`); sendCodes.add(s.code); }
  for (const e of pack.equivalencies) {
    if (!sendCodes.has(norm(e.from))) errs.push(`Equivalency for unknown sending course ${e.from}`);
    if (e.to.kind === "course" && !codes.has(e.to.code)) errs.push(`${e.from} maps to unknown course ${e.to.code}`);
  }
  const ids = new Set<string>();
  for (const r of pack.degree.requirements) {
    if (ids.has(r.id)) errs.push(`Duplicate requirement id ${r.id}`); ids.add(r.id);
    const refs = r.type === "course" ? [r.code] : r.type === "choose" || r.type === "credits" ? r.from : [];
    for (const ref of refs) if (!codes.has(ref)) errs.push(`Requirement "${r.label}" names unknown course ${ref}`);
    if (r.type === "choose" && r.n > r.from.length) errs.push(`Requirement "${r.label}" asks for ${r.n} of only ${r.from.length}`);
  }
  if (pack.degree.residencyMin > pack.degree.totalCredits) errs.push("Residency minimum exceeds total credits");
  if (pack.degree.transferCap > pack.degree.totalCredits) errs.push("Transfer cap exceeds total credits");
  return errs;
}

/** The whole pipeline in one call. */
export function analyse(pack: RulesPack, student: Student) {
  const transfer = evaluateTransfer(pack, student);
  const audit = auditDegree(pack, transfer);
  const work = remainingWork(pack, audit);
  const plan = planTerms(pack, student, audit, work);
  const suggestions = suggestBeforeTransfer(pack, transfer, audit, work);
  return { transfer, audit, work, plan, suggestions };
}
