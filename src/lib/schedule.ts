import { ContributionFrequency, FREQUENCY_PER_YEAR } from "../types";

/** Shared by any recurring schedule — a contribution or a transfer — since both are
 * just "an amount, how often, from when, until when". */
export interface RecurringSchedule {
  amount: number;
  frequency: ContributionFrequency;
  startDate: string; // ISO date (yyyy-mm-dd)
  endDate?: string;
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function sameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

/** Normalizes any frequency to an equivalent smooth monthly amount. "once" is handled
 * separately by the caller since it fires in a single month rather than repeating —
 * smoothing it would misrepresent it. */
export function monthlyEquivalent(schedule: RecurringSchedule): number {
  if (schedule.frequency === "once") return 0;
  return (schedule.amount * FREQUENCY_PER_YEAR[schedule.frequency]) / 12;
}

export function isActiveInMonth(schedule: RecurringSchedule, monthDate: Date): boolean {
  const start = new Date(schedule.startDate);
  if (monthDate < startOfMonth(start)) return false;
  if (schedule.endDate) {
    const end = new Date(schedule.endDate);
    if (monthDate > startOfMonth(end)) return false;
  }
  return true;
}

/** The signed amount this schedule contributes in a given month — 0 if inactive,
 * the one-off amount if "once" fires this month, otherwise the monthly-normalized rate. */
export function amountForMonth(schedule: RecurringSchedule, monthDate: Date): number {
  if (schedule.frequency === "once") {
    return sameMonth(new Date(schedule.startDate), monthDate) ? schedule.amount : 0;
  }
  return isActiveInMonth(schedule, monthDate) ? monthlyEquivalent(schedule) : 0;
}

function stepDate(d: Date, frequency: Exclude<ContributionFrequency, "once">): Date {
  const next = new Date(d);
  switch (frequency) {
    case "weekly":
      next.setDate(next.getDate() + 7);
      break;
    case "fortnightly":
      next.setDate(next.getDate() + 14);
      break;
    case "monthly":
      next.setMonth(next.getMonth() + 1);
      break;
    case "quarterly":
      next.setMonth(next.getMonth() + 3);
      break;
    case "annually":
      next.setFullYear(next.getFullYear() + 1);
      break;
  }
  return next;
}

/** Real calendar occurrence dates for a schedule, strictly after `afterExclusive`
 * (null = from the very start) and up to `throughInclusive` — unlike amountForMonth's
 * smoothed monthly rate (built for long-horizon projections), this is exact dates for
 * actually applying a schedule to real balances. A schedule untouched for months (or
 * years) correctly yields every occurrence that should have already happened, not just
 * the most recent one — this is meant to be summed, not sampled. */
export function occurrencesBetween(schedule: RecurringSchedule, afterExclusive: Date | null, throughInclusive: Date): Date[] {
  const start = new Date(`${schedule.startDate}T00:00:00`);
  const end = schedule.endDate ? new Date(`${schedule.endDate}T00:00:00`) : null;
  const dates: Date[] = [];

  if (schedule.frequency === "once") {
    const due = (!afterExclusive || start > afterExclusive) && start <= throughInclusive;
    if (due) dates.push(start);
    return dates;
  }

  let cursor = start;
  while (cursor <= throughInclusive) {
    if (end && cursor > end) break;
    if (!afterExclusive || cursor > afterExclusive) dates.push(new Date(cursor));
    cursor = stepDate(cursor, schedule.frequency);
  }
  return dates;
}
