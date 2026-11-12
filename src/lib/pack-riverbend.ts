import type { Course, Equivalency, RulesPack, SendingCourse, Student } from "./types";

/**
 * SYNTHETIC. Riverbend Community College and Harbor State University do not
 * exist, and nothing here describes any real school. The shape is realistic
 * (grade minimums, a transfer cap, residency, prerequisite chains, courses that
 * are only offered in one season) so the engine is exercised on the real problem.
 * To use real rules, import a pack in the same shape; see /pack-template.json.
 */
const c = (code: string, title: string, credits: number, prereqs: string[][], offered: Course["offered"], tags?: string[]): Course => ({ code, title, credits, prereqs, offered, tags });
const ALL: Course["offered"] = ["fall", "spring", "summer"];
const FS: Course["offered"] = ["fall", "spring"];

const receiving: Course[] = [
  // Computer science core
  c("CS 110", "Introduction to Programming", 4, [], ALL),
  c("CS 120", "Data Structures", 4, [["CS 110"]], FS),
  c("CS 210", "Computer Organization", 3, [["CS 120"]], FS),
  c("CS 220", "Algorithms", 3, [["CS 120"], ["MATH 230"]], FS),
  c("CS 230", "Software Engineering", 3, [["CS 120"]], ["fall"]),
  c("CS 310", "Operating Systems", 3, [["CS 210"]], ["spring"]),
  c("CS 320", "Databases", 3, [["CS 120"]], FS),
  c("CS 330", "Programming Languages", 3, [["CS 220"]], ["fall"]),
  c("CS 340", "Computer Networks", 3, [["CS 210"]], ["spring"]),
  c("CS 490", "Senior Capstone", 3, [["CS 230"], ["CS 320"]], FS),
  // Upper-level electives (choose three)
  c("CS 350", "Machine Learning", 3, [["CS 220"], ["STAT 301"]], ["fall"]),
  c("CS 360", "Computer Security", 3, [["CS 310"]], ["fall"]),
  c("CS 370", "Web Development", 3, [["CS 120"]], FS),
  c("CS 380", "Mobile Applications", 3, [["CS 120"]], ["spring"]),
  c("CS 410", "Compilers", 3, [["CS 330"]], ["spring"]),
  c("CS 420", "Distributed Systems", 3, [["CS 310"], ["CS 340"]], ["fall"]),
  // Mathematics
  c("MATH 151", "Calculus I", 4, [], ALL),
  c("MATH 152", "Calculus II", 4, [["MATH 151"]], FS),
  c("MATH 230", "Discrete Mathematics", 3, [["MATH 151"]], FS),
  c("MATH 240", "Linear Algebra", 3, [["MATH 152"]], FS),
  c("STAT 301", "Probability and Statistics", 3, [["MATH 152"]], FS),
  // Laboratory science (eight credits)
  c("PHYS 201", "University Physics I", 4, [["MATH 151"]], FS),
  c("CHEM 101", "General Chemistry I", 4, [], FS),
  c("BIOL 101", "General Biology", 4, [], FS),
  c("GEOL 101", "Physical Geology", 4, [], FS),
  // General education
  c("ENGL 101", "Composition I", 3, [], ALL, ["gened:writing"]),
  c("ENGL 102", "Composition II", 3, [["ENGL 101"]], ALL, ["gened:writing"]),
  c("HUM 101", "Introduction to the Humanities", 3, [], ALL, ["gened:humanities"]),
  c("PHIL 110", "Introduction to Philosophy", 3, [], FS, ["gened:humanities"]),
  c("HIST 110", "World History", 3, [], FS, ["gened:humanities"]),
  c("LIT 201", "Introduction to Literature", 3, [["ENGL 101"]], FS, ["gened:humanities"]),
  c("PSYC 101", "General Psychology", 3, [], ALL, ["gened:social"]),
  c("SOC 101", "Introduction to Sociology", 3, [], FS, ["gened:social"]),
  c("ECON 101", "Principles of Economics", 3, [], FS, ["gened:social"]),
  c("POLS 101", "American Government", 3, [], FS, ["gened:social"]),
  c("ART 101", "Art Appreciation", 3, [], ALL, ["gened:arts"]),
  c("MUS 101", "Music Appreciation", 3, [], FS, ["gened:arts"]),
  c("THEA 101", "Introduction to Theatre", 3, [], FS, ["gened:arts"]),
  c("COMM 101", "Public Speaking", 3, [], ALL, ["gened:communication"]),
];

const sending: SendingCourse[] = [
  { code: "CSC 101", title: "Introduction to Programming", credits: 4 },
  { code: "CSC 102", title: "Data Structures", credits: 4 },
  { code: "CSC 150", title: "Computer Architecture", credits: 3 },
  { code: "CSC 160", title: "Web Page Development", credits: 3 },
  { code: "CSC 170", title: "Discrete Structures", credits: 3 },
  { code: "CSC 180", title: "Database Fundamentals", credits: 3 },
  { code: "CSC 201", title: "Java Programming", credits: 3 },
  { code: "CSC 230", title: "Networking Basics", credits: 3 },
  { code: "IT 105", title: "PC Hardware and Repair", credits: 3 },
  { code: "MAT 100", title: "Developmental Mathematics", credits: 3 },
  { code: "MAT 120", title: "College Algebra", credits: 3 },
  { code: "MAT 181", title: "Calculus I", credits: 4 },
  { code: "MAT 182", title: "Calculus II", credits: 4 },
  { code: "MAT 200", title: "Linear Algebra", credits: 3 },
  { code: "MAT 210", title: "Probability and Statistics", credits: 3 },
  { code: "PHY 211", title: "University Physics I", credits: 4 },
  { code: "CHM 111", title: "General Chemistry I", credits: 4 },
  { code: "BIO 101", title: "General Biology", credits: 4 },
  { code: "ENG 101", title: "Composition I", credits: 3 },
  { code: "ENG 102", title: "Composition II", credits: 3 },
  { code: "HUM 130", title: "Introduction to the Humanities", credits: 3 },
  { code: "PHL 101", title: "Introduction to Philosophy", credits: 3 },
  { code: "HST 121", title: "World History", credits: 3 },
  { code: "PSY 101", title: "General Psychology", credits: 3 },
  { code: "SOC 101", title: "Introduction to Sociology", credits: 3 },
  { code: "ECO 201", title: "Principles of Economics", credits: 3 },
  { code: "SPC 101", title: "Public Speaking", credits: 3 },
  { code: "ART 110", title: "Art Appreciation", credits: 3 },
  { code: "MUS 105", title: "Music Appreciation", credits: 3 },
  { code: "BUS 110", title: "Introduction to Business", credits: 3 },
  { code: "PED 150", title: "Fitness and Wellness", credits: 1 },
  { code: "WLD 120", title: "Welding Fundamentals", credits: 3 },
  { code: "GEN 100", title: "College Success Seminar", credits: 1 },
];

const to = (from: string, code: string, extra: Partial<Equivalency> = {}): Equivalency => ({ from, to: { kind: "course", code }, ...extra });
const elective = (from: string, area: string, note?: string): Equivalency => ({ from, to: { kind: "elective", area }, note });
const gened = (from: string, area: string): Equivalency => ({ from, to: { kind: "gened", area } });
const none = (from: string, reason: string): Equivalency => ({ from, to: { kind: "none", reason } });

const equivalencies: Equivalency[] = [
  to("CSC 101", "CS 110"),
  to("CSC 102", "CS 120", { minGrade: "B", note: "Counts as CS 120 only with a B or better" }),
  to("CSC 150", "CS 210"),
  elective("CSC 160", "CS", "Elective credit; does not replace CS 370"),
  to("CSC 170", "MATH 230"),
  elective("CSC 180", "CS", "Elective credit; does not replace CS 320"),
  elective("CSC 201", "CS", "Elective credit; the receiving school requires CS 120 for the Java coverage"),
  none("CSC 230", "Vocational networking: no equivalent course"),
  none("IT 105", "Technician training courses do not transfer"),
  none("MAT 100", "Developmental courses carry no transfer credit"),
  elective("MAT 120", "Mathematics", "Elective credit; below the calculus sequence"),
  to("MAT 181", "MATH 151"),
  to("MAT 182", "MATH 152"),
  to("MAT 200", "MATH 240"),
  to("MAT 210", "STAT 301"),
  to("PHY 211", "PHYS 201"),
  to("CHM 111", "CHEM 101"),
  to("BIO 101", "BIOL 101"),
  to("ENG 101", "ENGL 101"),
  to("ENG 102", "ENGL 102"),
  to("HUM 130", "HUM 101"),
  to("PHL 101", "PHIL 110"),
  to("HST 121", "HIST 110"),
  to("PSY 101", "PSYC 101"),
  to("SOC 101", "SOC 101"),
  to("ECO 201", "ECON 101"),
  to("SPC 101", "COMM 101"),
  to("ART 110", "ART 101"),
  gened("MUS 105", "arts"),
  elective("BUS 110", "Business", "Free elective credit"),
  elective("PED 150", "Activity", "Free elective credit"),
  none("WLD 120", "Career and technical courses do not transfer"),
  none("GEN 100", "Student success courses carry no credit"),
];

export const RIVERBEND: RulesPack = {
  id: "riverbend-harbor-cs",
  name: "Riverbend CC to Harbor State, B.S. Computer Science",
  synthetic: true,
  description: "A fictional two-year to four-year pair, built to behave like the real problem: grade minimums, a 64-credit transfer cap, a 30-credit residency rule, prerequisite chains and courses offered in one season only.",
  defaultMinGrade: "C",
  acceptPass: true,
  sending: { name: "Riverbend Community College", courses: sending },
  receiving: { name: "Harbor State University", courses: receiving },
  equivalencies,
  degree: {
    name: "B.S. Computer Science",
    totalCredits: 120,
    residencyMin: 30,
    transferCap: 64,
    requirements: [
      ...["CS 110", "CS 120", "CS 210", "CS 220", "CS 230", "CS 310", "CS 320", "CS 330", "CS 340", "CS 490"].map((code) => ({ id: code, type: "course" as const, label: `${code} ${receiving.find((x) => x.code === code)?.title}`, code })),
      { id: "upper", type: "choose", label: "Three upper-level CS electives", n: 3, from: ["CS 350", "CS 360", "CS 370", "CS 380", "CS 410", "CS 420"] },
      ...["MATH 151", "MATH 152", "MATH 230", "MATH 240", "STAT 301"].map((code) => ({ id: code, type: "course" as const, label: `${code} ${receiving.find((x) => x.code === code)?.title}`, code })),
      { id: "science", type: "credits", label: "Eight credits of laboratory science", credits: 8, from: ["PHYS 201", "CHEM 101", "BIOL 101", "GEOL 101"] },
      { id: "writing-1", type: "course", label: "ENGL 101 Composition I", code: "ENGL 101" },
      { id: "writing-2", type: "course", label: "ENGL 102 Composition II", code: "ENGL 102" },
      { id: "humanities", type: "gened", label: "Humanities (6 credits)", area: "humanities", credits: 6 },
      { id: "social", type: "gened", label: "Social science (6 credits)", area: "social", credits: 6 },
      { id: "arts", type: "gened", label: "Arts (3 credits)", area: "arts", credits: 3 },
      { id: "communication", type: "gened", label: "Communication (3 credits)", area: "communication", credits: 3 },
    ],
  },
};

/** Invented students. None of them is a real person. */
export const PERSONAS: { id: string; label: string; blurb: string; student: Student }[] = [
  {
    id: "steady", label: "Steady transfer student", blurb: "Strong grades, a clean path, close to the transfer cap.",
    student: {
      label: "Steady transfer student", maxCreditsPerTerm: 15, start: { season: "fall", year: 2027 }, includeSummer: false,
      completed: [["CSC 101", "A"], ["CSC 102", "B"], ["CSC 150", "B"], ["CSC 170", "A"], ["MAT 181", "A"], ["MAT 182", "B"], ["MAT 210", "B"], ["ENG 101", "A"], ["ENG 102", "B"], ["PHY 211", "B"], ["PSY 101", "A"], ["HUM 130", "A"], ["SPC 101", "B"], ["ART 110", "A"], ["CSC 160", "A"]]
        .map(([code, grade]) => ({ code, grade: grade as "A" })),
    },
  },
  {
    id: "changer", label: "Career changer", blurb: "Mixed record: remedial, vocational and below-minimum grades that do not carry over.",
    student: {
      label: "Career changer", maxCreditsPerTerm: 12, start: { season: "spring", year: 2028 }, includeSummer: true,
      completed: [["IT 105", "A"], ["MAT 100", "B"], ["MAT 120", "B"], ["WLD 120", "A"], ["GEN 100", "A"], ["ENG 101", "B"], ["PSY 101", "C"], ["CSC 101", "C"], ["CSC 102", "D"], ["BUS 110", "A"], ["CSC 230", "B"], ["PED 150", "P"], ["SOC 101", "W"]]
        .map(([code, grade]) => ({ code, grade: grade as "A" })),
    },
  },
  {
    id: "overcap", label: "Over the cap", blurb: "More community-college credit than the receiving school will take.",
    student: {
      label: "Over the cap", maxCreditsPerTerm: 18, start: { season: "fall", year: 2027 }, includeSummer: false,
      completed: [["CSC 101", "A"], ["CSC 102", "A"], ["CSC 150", "A"], ["CSC 160", "B"], ["CSC 170", "A"], ["CSC 180", "B"], ["CSC 201", "A"], ["MAT 120", "A"], ["MAT 181", "A"], ["MAT 182", "A"], ["MAT 200", "B"], ["MAT 210", "A"], ["PHY 211", "A"], ["CHM 111", "B"], ["BIO 101", "A"], ["ENG 101", "A"], ["ENG 102", "A"], ["HUM 130", "A"], ["PHL 101", "B"], ["HST 121", "A"], ["PSY 101", "A"], ["SOC 101", "A"], ["ECO 201", "B"], ["SPC 101", "A"], ["ART 110", "A"], ["MUS 105", "A"], ["BUS 110", "B"], ["PED 150", "A"]]
        .map(([code, grade]) => ({ code, grade: grade as "A" })),
    },
  },
];
