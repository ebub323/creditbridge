/**
 * CreditBridge models the transfer-credit problem in a way that is independent
 * of any school or student. A "rules pack" describes one sending school, one
 * receiving school and one degree. A "student" is just a list of courses and
 * grades. Nothing in the engine knows a real institution or a real person.
 */
export type Season = "fall" | "spring" | "summer";
export interface TermRef { season: Season; year: number }

export type Grade = "A" | "B" | "C" | "D" | "F" | "P" | "W";
export const GRADE_POINTS: Record<Exclude<Grade, "P" | "W">, number> = { A: 4, B: 3, C: 2, D: 1, F: 0 };

/** A conjunction of alternatives: [["CS 101"], ["MATH 151", "MATH 140"]] = CS 101 AND (MATH 151 OR MATH 140). */
export type Prereqs = string[][];

export interface Course {
  code: string;
  title: string;
  credits: number;
  prereqs: Prereqs;
  offered: Season[];
  /** e.g. "gened:humanities". Lets a course count toward a general-education area. */
  tags?: string[];
}

export interface SendingCourse { code: string; title: string; credits: number }

export type EquivalencyTarget =
  | { kind: "course"; code: string }
  | { kind: "elective"; area: string }
  | { kind: "gened"; area: string }
  | { kind: "none"; reason: string };

export interface Equivalency {
  from: string;
  to: EquivalencyTarget;
  /** Lowest grade the receiving school accepts for this course. Defaults to the pack's default. */
  minGrade?: Exclude<Grade, "P" | "W">;
  note?: string;
}

export type Requirement =
  | { id: string; type: "course"; label: string; code: string }
  | { id: string; type: "choose"; label: string; n: number; from: string[] }
  | { id: string; type: "credits"; label: string; credits: number; from: string[] }
  | { id: string; type: "gened"; label: string; area: string; credits: number };

export interface Degree {
  name: string;
  totalCredits: number;
  /** Credits that must be earned at the receiving school. */
  residencyMin: number;
  /** The most credits the receiving school will accept in transfer. */
  transferCap: number;
  requirements: Requirement[];
}

export interface RulesPack {
  id: string;
  name: string;
  /** True when the data is invented for demonstration. Real packs must say where they came from. */
  synthetic: boolean;
  description: string;
  defaultMinGrade: Exclude<Grade, "P" | "W">;
  acceptPass: boolean;
  sending: { name: string; courses: SendingCourse[] };
  receiving: { name: string; courses: Course[] };
  equivalencies: Equivalency[];
  degree: Degree;
}

export interface CompletedCourse { code: string; grade: Grade }

export interface Student {
  label: string;
  completed: CompletedCourse[];
  maxCreditsPerTerm: number;
  start: TermRef;
  includeSummer: boolean;
}

export type TransferOutcome = "course" | "elective" | "gened" | "none";
export type TransferFlag = "below-min-grade" | "no-equivalency" | "over-cap" | "shortfall" | "duplicate" | "unknown-course" | "no-credit-grade";

export interface TransferItem {
  from: string;
  title: string;
  grade: Grade;
  sendingCredits: number;
  outcome: TransferOutcome;
  to?: string;
  area?: string;
  awardedCredits: number;
  reason: string;
  flags: TransferFlag[];
}

export interface TransferResult {
  items: TransferItem[];
  accepted: TransferItem[];
  acceptedCredits: number;
  rejectedCredits: number;
  capUsed: number;
  capRoom: number;
}

export interface RequirementStatus {
  id: string;
  label: string;
  type: Requirement["type"];
  satisfied: boolean;
  creditsDone: number;
  creditsNeeded: number;
  usedBy: string[];
  /** Receiving courses that could still satisfy it. */
  options: string[];
  /** How many more courses (choose) or credits (credits, gened) are needed. */
  remaining: number;
}

export interface AuditResult {
  statuses: RequirementStatus[];
  usedItems: Set<TransferItem>;
  /** Accepted transfer credits not used by any requirement: they count as free electives. */
  freeElectiveCredits: number;
  /** Accepted courses that count as already taken, by receiving code. */
  takenCodes: Set<string>;
  acceptedCredits: number;
}

export interface PlannedTerm { label: string; season: Season; year: number; courses: { code: string; title: string; credits: number; free?: boolean }[]; credits: number }

export interface Plan {
  needed: Course[];
  freeElectiveCredits: number;
  terms: PlannedTerm[];
  graduation: string | null;
  totalRemainingCredits: number;
  lowerBoundTerms: number;
  optimal: boolean;
  warnings: string[];
}

export interface Suggestion {
  from: string;
  title: string;
  credits: number;
  satisfies: string;
  requirement: string;
  capOk: boolean;
}
