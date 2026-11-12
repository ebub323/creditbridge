import { describe, expect, it } from "vitest";
import { analyse, auditDegree, evaluateTransfer, nextTerm, norm, parseTranscript, planTerms, remainingWork, termLabel, validatePack } from "./engine";
import { PERSONAS, RIVERBEND } from "./pack-riverbend";
import type { Grade, RulesPack, Student } from "./types";

const persona = (id: string) => PERSONAS.find((p) => p.id === id)!.student;
const done = (...pairs: [string, Grade][]) => ({ completed: pairs.map(([code, grade]) => ({ code, grade })) });

describe("the synthetic pack", () => {
  it("is internally consistent", () => {
    expect(validatePack(RIVERBEND)).toEqual([]);
  });
  it("is labelled synthetic", () => {
    expect(RIVERBEND.synthetic).toBe(true);
  });
  it("catches the mistakes that corrupt a plan", () => {
    const bad: RulesPack = JSON.parse(JSON.stringify(RIVERBEND));
    bad.receiving.courses.find((c) => c.code === "CS 110")!.prereqs = [["CS 490"]];             // a cycle
    bad.receiving.courses.find((c) => c.code === "CS 220")!.prereqs = [["CS 999"]];             // unknown prerequisite
    bad.equivalencies.push({ from: "ZZZ 999", to: { kind: "course", code: "CS 110" } });       // unknown sending course
    const errs = validatePack(bad).join("\n");
    expect(errs).toMatch(/cycle/i);
    expect(errs).toMatch(/unknown course CS 999/);
    expect(errs).toMatch(/unknown sending course ZZZ 999/);
  });
});

describe("evaluateTransfer", () => {
  it("applies grade minimums, including a stricter one on a single course", () => {
    expect(evaluateTransfer(RIVERBEND, done(["CSC 102", "B"])).items[0].outcome).toBe("course");
    const c = evaluateTransfer(RIVERBEND, done(["CSC 102", "C"])).items[0];
    expect(c.outcome).toBe("none");
    expect(c.reason).toMatch(/below the minimum of B/);
    expect(evaluateTransfer(RIVERBEND, done(["CSC 101", "C"])).items[0].outcome).toBe("course");
    expect(evaluateTransfer(RIVERBEND, done(["CSC 101", "D"])).items[0].flags).toContain("below-min-grade");
  });
  it("refuses withdrawals and failures, and accepts pass grades when the pack does", () => {
    expect(evaluateTransfer(RIVERBEND, done(["SOC 101", "W"])).items[0].flags).toContain("no-credit-grade");
    expect(evaluateTransfer(RIVERBEND, done(["ENG 101", "F"])).items[0].outcome).toBe("none");
    expect(evaluateTransfer(RIVERBEND, done(["PED 150", "P"])).items[0].outcome).toBe("elective");
    expect(evaluateTransfer({ ...RIVERBEND, acceptPass: false }, done(["PED 150", "P"])).items[0].outcome).toBe("none");
  });
  it("explains vocational, developmental and unknown courses", () => {
    const r = evaluateTransfer(RIVERBEND, done(["IT 105", "A"], ["MAT 100", "B"], ["ZZZ 101", "A"]));
    expect(r.items.map((i) => i.outcome)).toEqual(["none", "none", "none"]);
    expect(r.items[2].flags).toContain("unknown-course");
    expect(r.rejectedCredits).toBe(6);
  });
  it("counts a repeated course once", () => {
    const r = evaluateTransfer(RIVERBEND, done(["MAT 181", "B"], ["MAT 181", "A"]));
    expect(r.accepted).toHaveLength(1);
    expect(r.items[1].flags).toContain("duplicate");
  });
  it("normalises how a student types a course code", () => {
    expect(norm("mat181")).toBe("MAT 181");
    expect(norm("MAT-181")).toBe("MAT 181");
    expect(evaluateTransfer(RIVERBEND, done(["mat181", "A"])).accepted).toHaveLength(1);
  });
  it("refuses credit past the transfer cap and says so", () => {
    const r = evaluateTransfer(RIVERBEND, persona("overcap"));
    expect(r.acceptedCredits).toBeLessThanOrEqual(RIVERBEND.degree.transferCap);
    expect(r.items.some((i) => i.flags.includes("over-cap"))).toBe(true);
    expect(r.capRoom).toBeGreaterThanOrEqual(0);
  });
  it("when the cap binds, spends it on requirement credit before free electives", () => {
    const tight: RulesPack = { ...RIVERBEND, degree: { ...RIVERBEND.degree, transferCap: 10 } };
    // three electives first, then a course the degree requires
    const r = evaluateTransfer(tight, done(["CSC 160", "A"], ["CSC 180", "A"], ["CSC 201", "A"], ["CSC 101", "A"]));
    expect(r.accepted.map((a) => a.from)).toContain("CSC 101");
    expect(r.acceptedCredits).toBeLessThanOrEqual(10);
    const dropped = r.items.filter((i) => i.flags.includes("over-cap"));
    expect(dropped.length).toBeGreaterThan(0);
    expect(dropped.every((i) => ["CSC 160", "CSC 180", "CSC 201"].includes(i.from))).toBe(true);
  });
  it("when forced to choose between courses, keeps the prerequisite chain and drops stand-alone ones", () => {
    const r = evaluateTransfer(RIVERBEND, persona("overcap"));
    const kept = new Set(r.accepted.map((a) => a.from));
    for (const chain of ["CSC 101", "CSC 102", "CSC 150", "CSC 170", "MAT 181", "MAT 182"]) expect(kept.has(chain)).toBe(true);
    const dropped = r.items.filter((i) => i.flags.includes("over-cap")).map((i) => i.from);
    expect(dropped.length).toBeGreaterThan(0);
    // none of the dropped courses unlocks another course; electives went first
    for (const d of dropped) expect(["CSC 101", "CSC 102", "CSC 150", "CSC 170", "MAT 181", "MAT 182", "ENG 101", "PHY 211"]).not.toContain(d);
    expect(r.acceptedCredits).toBe(64);
  });
  it("graduates the over-the-cap student sooner by keeping the chain", () => {
    const smart = analyse(RIVERBEND, persona("overcap")).plan;
    expect(smart.terms.length).toBeLessThanOrEqual(4);
  });
  it("flags a course that carries fewer credits than the one it replaces", () => {
    const pack: RulesPack = JSON.parse(JSON.stringify(RIVERBEND));
    pack.sending.courses.find((c) => c.code === "CSC 101")!.credits = 3;
    expect(evaluateTransfer(pack, done(["CSC 101", "A"])).items[0].flags).toContain("shortfall");
  });
});

describe("auditDegree", () => {
  const t = evaluateTransfer(RIVERBEND, persona("steady"));
  const a = auditDegree(RIVERBEND, t);
  const st = (id: string) => a.statuses.find((s) => s.id === id)!;

  it("matches specific courses and leaves the rest open", () => {
    for (const id of ["CS 110", "CS 120", "CS 210", "MATH 151", "MATH 152", "MATH 230", "STAT 301", "writing-1", "writing-2"]) expect(st(id).satisfied).toBe(true);
    for (const id of ["CS 220", "CS 490", "MATH 240"]) expect(st(id).satisfied).toBe(false);
  });
  it("counts credit pools and general education partially", () => {
    expect(st("science").creditsDone).toBe(4);
    expect(st("science").remaining).toBe(4);
    expect(st("humanities").creditsDone).toBe(3);
    expect(st("humanities").remaining).toBe(3);
    expect(st("arts").satisfied).toBe(true);           // ART 101 carries the arts tag
    expect(st("communication").satisfied).toBe(true);
  });
  it("never uses one accepted course for two requirements", () => {
    const uses = a.statuses.flatMap((s) => s.usedBy);
    expect(new Set(uses).size).toBe(uses.length);
  });
  it("keeps unused credit as free electives instead of losing it", () => {
    expect(a.freeElectiveCredits).toBe(3);             // CSC 160 is CS elective credit
    expect(a.acceptedCredits).toBe(t.acceptedCredits);
  });
});

describe("remainingWork and the plan", () => {
  const run = (id: string) => analyse(RIVERBEND, persona(id));

  it("chooses the cheapest upper electives and pulls in missing prerequisites", () => {
    const { work } = run("steady");
    const upper = work.needed.filter((c) => ["CS 350", "CS 360", "CS 370", "CS 380", "CS 410", "CS 420"].includes(c.code));
    expect(upper).toHaveLength(3);
    for (const c of work.needed) for (const g of c.prereqs) {
      const taken = run("steady").audit.takenCodes;
      expect(g.some((p) => taken.has(p) || work.needed.some((n) => n.code === p))).toBe(true);
    }
  });

  it("schedules everything, respecting prerequisites, seasons and the credit limit", () => {
    for (const id of ["steady", "changer", "overcap"]) {
      const s = persona(id); const { plan, audit } = analyse(RIVERBEND, s);
      expect(plan.warnings).toEqual([]);
      const when = new Map<string, number>();
      plan.terms.forEach((t, i) => t.courses.forEach((c) => { if (!c.free) when.set(c.code, i); }));
      plan.terms.forEach((t, i) => {
        expect(t.credits).toBeLessThanOrEqual(s.maxCreditsPerTerm);
        for (const c of t.courses) {
          if (c.free) continue;
          const def = RIVERBEND.receiving.courses.find((x) => x.code === c.code)!;
          expect(def.offered).toContain(t.season);
          for (const g of def.prereqs) expect(g.some((p) => audit.takenCodes.has(p) || (when.get(p) ?? 99) < i)).toBe(true);
        }
      });
    }
  });

  it("reaches the degree total and meets residency", () => {
    for (const id of ["steady", "changer", "overcap"]) {
      const { transfer, plan } = analyse(RIVERBEND, persona(id));
      const planned = plan.terms.reduce((s, t) => s + t.credits, 0);
      expect(planned + transfer.acceptedCredits).toBeGreaterThanOrEqual(RIVERBEND.degree.totalCredits);
      expect(planned).toBeGreaterThanOrEqual(RIVERBEND.degree.residencyMin);
    }
  });

  it("a stronger record finishes no later than a weaker one", () => {
    expect(run("steady").plan.terms.length).toBeLessThanOrEqual(run("changer").plan.terms.length);
  });

  it("states how close to the theoretical minimum the plan is", () => {
    for (const id of ["steady", "changer", "overcap"]) {
      const { plan } = run(id);
      expect(plan.lowerBoundTerms).toBeGreaterThan(0);
      expect(plan.terms.length).toBeGreaterThanOrEqual(plan.lowerBoundTerms);
      expect(plan.terms.length - plan.lowerBoundTerms).toBeLessThanOrEqual(1);
    }
  });

  it("reports what cannot be scheduled instead of looping", () => {
    const pack: RulesPack = JSON.parse(JSON.stringify(RIVERBEND));
    pack.receiving.courses.find((c) => c.code === "CS 230")!.offered = ["summer"];     // offered only in summer
    const s: Student = { ...persona("steady"), includeSummer: false };
    const { plan } = analyse(pack, s);
    expect(plan.warnings.join(" ")).toMatch(/Could not schedule/);
    expect(plan.terms.length).toBeLessThan(24);
  });
});

describe("suggestions", () => {
  it("names cheap community-college courses that would satisfy what is still outstanding", () => {
    const { suggestions } = analyse(RIVERBEND, persona("steady"));
    expect(suggestions.map((s) => s.from)).toContain("MAT 200");      // Linear Algebra, still needed
    expect(suggestions.map((s) => s.from)).not.toContain("MAT 181");  // already taken
    expect(suggestions.map((s) => s.from)).not.toContain("CSC 180");  // only elective credit: not a need
  });
  it("flags suggestions that no longer fit under the cap", () => {
    const { suggestions } = analyse(RIVERBEND, persona("overcap"));
    expect(suggestions.every((s) => s.capOk === false || s.credits <= 64)).toBe(true);
  });
});

describe("parseTranscript", () => {
  const text = ["CSC 101  Introduction to Programming  4.0  A", "MAT-181 Calculus I   B+", "eng101 Composition I A-", "Semester GPA 3.5", "ZZZ 101 Mystery Course A", "PHY 211 University Physics I"].join("\n");
  const r = parseTranscript(RIVERBEND, text);
  it("reads known courses and their grades, tolerating formatting", () => {
    expect(r.found).toEqual([{ code: "CSC 101", grade: "A" }, { code: "MAT 181", grade: "B" }, { code: "ENG 101", grade: "A" }]);
  });
  it("reports every line it could not use, so nothing is dropped silently", () => {
    expect(r.skipped).toEqual(["Semester GPA 3.5", "ZZZ 101 Mystery Course A", "PHY 211 University Physics I"]);
  });
});

describe("terms", () => {
  it("steps fall, spring, summer in academic order and turns the year after fall", () => {
    const a = nextTerm({ season: "fall", year: 2027 }, true);
    expect(termLabel(a)).toBe("Spring 2028");
    expect(termLabel(nextTerm(a, true))).toBe("Summer 2028");
    expect(termLabel(nextTerm(nextTerm(a, true), true))).toBe("Fall 2028");
    expect(termLabel(nextTerm(a, false))).toBe("Fall 2028");
  });
});

// ---------------------------------------------------------------- properties
function rng(seed: number) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

describe("invariants over 300 random students", () => {
  const r = rng(20271);
  const grades: Grade[] = ["A", "B", "C", "D", "F", "P", "W", "A", "B"];
  const codes = RIVERBEND.sending.courses.map((c) => c.code);
  for (let i = 0; i < 300; i++) {
    const n = 1 + Math.floor(r() * 30);
    const completed = Array.from({ length: n }, () => ({ code: codes[Math.floor(r() * codes.length)], grade: grades[Math.floor(r() * grades.length)] }));
    const student: Student = { label: `random ${i}`, completed, maxCreditsPerTerm: [9, 12, 15, 18][Math.floor(r() * 4)], start: { season: (["fall", "spring"] as const)[Math.floor(r() * 2)], year: 2027 }, includeSummer: r() > 0.5 };
    it(`holds for random student ${i}`, () => {
      const { transfer, audit, plan } = analyse(RIVERBEND, student);
      // the cap is never exceeded, and every accepted credit is accounted for
      expect(transfer.acceptedCredits).toBeLessThanOrEqual(RIVERBEND.degree.transferCap);
      expect(transfer.acceptedCredits).toBe(transfer.accepted.reduce((s, a) => s + a.awardedCredits, 0));
      // each receiving course is credited at most once
      const targets = transfer.accepted.filter((a) => a.outcome === "course").map((a) => a.to);
      expect(new Set(targets).size).toBe(targets.length);
      // no accepted course serves two requirements
      const used = audit.statuses.flatMap((s) => s.usedBy);
      expect(new Set(used).size).toBe(used.length);
      // credit is conserved: used + free = accepted
      const usedCredits = [...audit.usedItems].reduce((s, a) => s + a.awardedCredits, 0);
      expect(usedCredits + audit.freeElectiveCredits).toBe(transfer.acceptedCredits);
      // a plan never schedules a course before its prerequisites or out of season
      const when = new Map<string, number>();
      plan.terms.forEach((t, k) => t.courses.forEach((c) => { if (!c.free) when.set(c.code, k); }));
      plan.terms.forEach((t, k) => {
        expect(t.credits).toBeLessThanOrEqual(student.maxCreditsPerTerm);
        for (const c of t.courses) {
          if (c.free) continue;
          const def = RIVERBEND.receiving.courses.find((x) => x.code === c.code)!;
          expect(def.offered).toContain(t.season);
          for (const g of def.prereqs) expect(g.some((p) => audit.takenCodes.has(p) || (when.get(p) ?? 99) < k)).toBe(true);
        }
      });
      // and it does not invent work: nothing is both transferred and scheduled
      for (const code of when.keys()) expect(audit.takenCodes.has(code)).toBe(false);
    });
  }
});
