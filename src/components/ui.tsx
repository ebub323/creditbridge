export const card = "rounded-2xl border border-neutral-200 bg-white dark:border-[#24351a] dark:bg-[#15240d]";
export const input = "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#163300] focus:ring-2 focus:ring-[#9fe870]/60 dark:border-neutral-700 dark:bg-neutral-950 dark:focus:border-[#9fe870]";
export const btn = "rounded-full bg-[#9fe870] px-4 py-1.5 text-sm font-semibold text-[#163300] transition hover:bg-[#cdffad] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40";
export const btnGhost = "rounded-full border border-[#163300]/25 px-4 py-1.5 text-sm font-semibold text-[#163300] transition hover:bg-[#e2f6d5] disabled:opacity-40 dark:border-[#9fe870]/40 dark:text-[#cdffad] dark:hover:bg-[#1d3012]";

export function Chip({ tone, children }: { tone: "green" | "blue" | "violet" | "red" | "amber" | "gray"; children: React.ReactNode }) {
  const t = {
    green: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400", blue: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
    violet: "bg-violet-500/15 text-violet-700 dark:text-violet-300", red: "bg-red-500/10 text-red-700 dark:text-red-400",
    amber: "bg-amber-500/15 text-amber-800 dark:text-amber-300", gray: "bg-neutral-500/15 text-neutral-600 dark:text-neutral-400",
  }[tone];
  return <span className={`inline-block rounded-md px-2 py-0.5 text-xs font-medium ${t}`}>{children}</span>;
}

export function Bar({ value, max, tone = "bg-[#163300] dark:bg-[#9fe870]" }: { value: number; max: number; tone?: string }) {
  return (
    <div className="h-2 rounded-full bg-[#e2f6d5] dark:bg-[#24351a]" role="progressbar" aria-valuenow={value} aria-valuemax={max}>
      <div className={`h-full rounded-full transition-all ${tone}`} style={{ width: `${Math.min(100, (value / Math.max(1, max)) * 100)}%` }} />
    </div>
  );
}
