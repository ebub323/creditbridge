# CreditBridge

**What transfers, what is left, and the fastest way to graduate.**

Transfer credit is a rulebook, and students lose semesters to it: grade minimums, a cap on how much
the receiving school will take, residency, courses offered in only one season, and prerequisite
chains. CreditBridge models that rulebook, then shows a student exactly what happens to each course
they took, what the degree still needs, and a term-by-term plan to graduation.

## Built around the problem, not a person

Nothing in the engine knows a real school or a real student. A **rules pack** (JSON) describes one
sending school, one receiving school and one degree; a **student** is a list of courses and grades.
The bundled data is **synthetic** (a fictional "Riverbend CC to Harbor State, B.S. Computer
Science") and labelled as such in the app. To use real rules, download the blank template, fill it
from the receiving school's published equivalencies, and import it. Imports are validated first, and
a broken pack produces a list of what is wrong, never a plan that looks right and is not.

## What it does

| | |
| --- | --- |
| **Transfer evaluation** | Maps each completed course to a course, to elective or general-education credit, or refuses it with a reason: below the minimum grade, withdrawn or failed, vocational, remedial, duplicate, unknown, or over the cap. |
| **Cap allocation** | When the cap binds it spends the credit where it does the most work: courses that unlock the most later courses first, then general education, then free electives. Taking credit in the order it was earned burns the cap on electives. |
| **Degree audit** | Matches accepted credit to requirements without counting any course twice: specific courses, choose-N, credit pools and general-education areas. Unused credit counts as free electives, and credit is conserved. |
| **Plan to graduation** | Schedules what is left term by term. A course needs every prerequisite finished in an earlier term and must be offered that season. Longest chain first. It also reports the **theoretical minimum** number of terms, so "optimal" is checked, not claimed. |
| **Take these before you transfer** | Sending-school courses that would satisfy something still open, flagged when they would no longer fit under the cap. |
| **Transcript paste** | Reads lines like `MAT-181 Calculus I B+` against the catalog and reports every line it could not use. |

## Why the engine is trustworthy

- **A property test runs 300 random students** and checks what must always hold: the cap is never
  exceeded, each receiving course is credited once, no accepted course serves two requirements,
  credit used plus free credit equals credit accepted, and every scheduled course has its
  prerequisites finished earlier and is offered in that season.
- The plan is a heuristic (list scheduling by critical path), and it says so. It reports the lower
  bound next to its answer; on the bundled students it meets it.
- The first version accepted credit in the order it was earned and refused courses the degree
  needed. Driving the over-the-cap case exposed that, and the allocation rule above replaced it.

## Limits

A planning aid, not an official evaluation: the receiving school decides, and a pack is only as
accurate as its source. Choose-N requirements that overlap with fixed requirements are not
de-duplicated in the planner. Prerequisite expressions are "all of these groups, any one within a
group" and do not model co-requisites.

## Run it

```bash
npm install
npm run dev     # http://localhost:3000
npm test        # 334 tests
npm run build   # static export to out/
```

## Stack

Next.js 16 (static export) · TypeScript · Tailwind v4 · Vitest · GitHub Actions
