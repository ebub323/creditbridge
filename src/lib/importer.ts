import { validatePack } from "./engine";
import type { RulesPack } from "./types";

const isStr = (v: unknown): v is string => typeof v === "string" && v.length > 0;
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/**
 * A pack is typed by hand, so check its shape before the engine ever sees it,
 * then run the consistency checks. A broken pack must produce a list of what is
 * wrong, never a plan that looks right and is not.
 */
export function parsePack(text: string): { ok: true; pack: RulesPack } | { ok: false; errors: string[] } {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return { ok: false, errors: ["That is not valid JSON."] }; }
  const p = raw as Partial<RulesPack>;
  const errors: string[] = [];
  if (!p || typeof p !== "object") return { ok: false, errors: ["The file is empty."] };
  for (const k of ["id", "name", "description"] as const) if (!isStr(p[k])) errors.push(`Missing "${k}".`);
  if (typeof p.synthetic !== "boolean") errors.push('Missing "synthetic": say true for invented data, false for real rules.');
  if (!["A", "B", "C", "D"].includes(p.defaultMinGrade as string)) errors.push('"defaultMinGrade" must be A, B, C or D.');
  if (typeof p.acceptPass !== "boolean") errors.push('Missing "acceptPass".');
  if (!p.sending || !isStr(p.sending.name) || !Array.isArray(p.sending.courses)) errors.push('"sending" needs a name and a list of courses.');
  if (!p.receiving || !isStr(p.receiving.name) || !Array.isArray(p.receiving.courses)) errors.push('"receiving" needs a name and a list of courses.');
  if (!Array.isArray(p.equivalencies)) errors.push('"equivalencies" must be a list.');
  const d = p.degree;
  if (!d || !isStr(d.name) || ![d.totalCredits, d.residencyMin, d.transferCap].every(isNum) || !Array.isArray(d.requirements)) errors.push('"degree" needs a name, totalCredits, residencyMin, transferCap and requirements.');
  if (errors.length) return { ok: false, errors };

  const pack = raw as RulesPack;
  for (const c of pack.receiving.courses) {
    if (!isStr(c.code) || !isNum(c.credits) || !Array.isArray(c.prereqs) || !Array.isArray(c.offered)) { errors.push(`A receiving course is malformed: ${JSON.stringify(c).slice(0, 80)}`); break; }
    if (c.offered.some((s) => !["fall", "spring", "summer"].includes(s))) errors.push(`${c.code} has an unknown season.`);
  }
  for (const s of pack.sending.courses) if (!isStr(s.code) || !isNum(s.credits)) { errors.push(`A sending course is malformed: ${JSON.stringify(s).slice(0, 80)}`); break; }
  if (errors.length) return { ok: false, errors };
  const problems = validatePack(pack);
  return problems.length ? { ok: false, errors: problems } : { ok: true, pack };
}

/** A small, correct pack someone can copy and replace with their own schools' rules. */
export const TEMPLATE_PACK: RulesPack = {
  id: "my-pack",
  name: "My two schools, my degree",
  synthetic: false,
  description: "Replace everything here with the rules your receiving school publishes. Set synthetic to true if you invent any of it.",
  defaultMinGrade: "C",
  acceptPass: true,
  sending: { name: "Sending College", courses: [{ code: "MAT 101", title: "Calculus I", credits: 4 }, { code: "ENG 101", title: "Composition", credits: 3 }] },
  receiving: {
    name: "Receiving University",
    courses: [
      { code: "MATH 151", title: "Calculus I", credits: 4, prereqs: [], offered: ["fall", "spring"] },
      { code: "MATH 152", title: "Calculus II", credits: 4, prereqs: [["MATH 151"]], offered: ["fall", "spring"] },
      { code: "ENGL 101", title: "Composition", credits: 3, prereqs: [], offered: ["fall", "spring", "summer"], tags: ["gened:writing"] },
    ],
  },
  equivalencies: [
    { from: "MAT 101", to: { kind: "course", code: "MATH 151" }, note: "Direct equivalent" },
    { from: "ENG 101", to: { kind: "course", code: "ENGL 101" } },
  ],
  degree: {
    name: "B.S. Example", totalCredits: 15, residencyMin: 4, transferCap: 9,
    requirements: [
      { id: "m1", type: "course", label: "Calculus I", code: "MATH 151" },
      { id: "m2", type: "course", label: "Calculus II", code: "MATH 152" },
      { id: "w", type: "gened", label: "Writing", area: "writing", credits: 3 },
    ],
  },
};
