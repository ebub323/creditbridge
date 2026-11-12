import { describe, expect, it } from "vitest";
import { analyse, validatePack } from "./engine";
import { parsePack, TEMPLATE_PACK } from "./importer";
import { RIVERBEND } from "./pack-riverbend";

describe("parsePack", () => {
  it("accepts the shipped pack and the template round-trip", () => {
    expect(parsePack(JSON.stringify(RIVERBEND)).ok).toBe(true);
    expect(parsePack(JSON.stringify(TEMPLATE_PACK)).ok).toBe(true);
    expect(validatePack(TEMPLATE_PACK)).toEqual([]);
  });
  it("the template really works end to end", () => {
    const a = analyse(TEMPLATE_PACK, { label: "t", completed: [{ code: "MAT 101", grade: "B" }], maxCreditsPerTerm: 12, start: { season: "fall", year: 2027 }, includeSummer: false });
    expect(a.transfer.acceptedCredits).toBe(4);
    expect(a.plan.warnings).toEqual([]);
    expect(a.plan.terms.length).toBeGreaterThan(0);
  });
  it("lists what is missing instead of failing silently", () => {
    const r = parsePack(JSON.stringify({ id: "x" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(" ")).toMatch(/name|synthetic|degree/);
  });
  it("rejects non-JSON and empty input", () => {
    expect(parsePack("not json")).toMatchObject({ ok: false });
    expect(parsePack("null")).toMatchObject({ ok: false });
  });
  it("reports a prerequisite cycle in an imported pack", () => {
    const bad = JSON.parse(JSON.stringify(TEMPLATE_PACK));
    bad.receiving.courses[0].prereqs = [["MATH 152"]];
    const r = parsePack(JSON.stringify(bad));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(" ")).toMatch(/cycle/i);
  });
  it("rejects an unknown season", () => {
    const bad = JSON.parse(JSON.stringify(TEMPLATE_PACK));
    bad.receiving.courses[0].offered = ["winter"];
    const r = parsePack(JSON.stringify(bad));
    expect(r.ok).toBe(false);
  });
});
