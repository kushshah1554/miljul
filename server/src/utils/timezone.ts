// Wall-clock helpers for IANA timezones, built on Intl only (no date library).

const MINUTE_MS = 60_000;

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formatters.set(timeZone, f);
  }
  return f;
}

type LocalParts = { year: number; month: number; day: number; minutes: number };

/** Local calendar date and minute-of-day of `instant` in `timeZone`. */
function localParts(instant: Date, timeZone: string): LocalParts & { seconds: number } {
  const parts = Object.fromEntries(
    formatter(timeZone)
      .formatToParts(instant)
      .map((p) => [p.type, Number(p.value)]),
  );
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    minutes: parts.hour * 60 + parts.minute,
    seconds: parts.second,
  };
}

/** Offset of `timeZone` from UTC at `instant`, in ms (Kathmandu = +5:45). */
function offsetMs(instant: Date, timeZone: string): number {
  const p = localParts(instant, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, 0, p.minutes, p.seconds);
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/** UTC instant of a local wall-clock time; `day` may overflow (Date.UTC normalises it). */
function fromLocal({ year, month, day, minutes }: LocalParts, timeZone: string): Date {
  const guess = Date.UTC(year, month - 1, day, 0, minutes);
  const first = guess - offsetMs(new Date(guess), timeZone);
  // Re-check once so a DST change between guess and result is honoured.
  return new Date(guess - offsetMs(new Date(first), timeZone));
}

// Not Intl.supportedValuesOf: it lists only canonical names (e.g. "Asia/Katmandu")
// and would reject valid aliases such as the default "Asia/Kathmandu".
export function isValidTimezone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** "YYYY-MM-DD" of `instant` in `timeZone`. */
export function localDateString(instant: Date, timeZone: string): string {
  const p = localParts(instant, timeZone);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/** Local midnight of a "YYYY-MM-DD" date in `timeZone`. */
export function localMidnight(date: string, timeZone: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  return fromLocal({ year, month, day, minutes: 0 }, timeZone);
}

/** Start of the local day that contains `instant`. */
export function startOfLocalDay(instant: Date, timeZone: string): Date {
  return localMidnight(localDateString(instant, timeZone), timeZone);
}

/** Same local wall-clock time `days` calendar days later (DST-safe). */
export function addLocalDays(instant: Date, days: number, timeZone: string): Date {
  const p = localParts(instant, timeZone);
  const base = fromLocal({ ...p, day: p.day + days }, timeZone);
  // Keep seconds/ms that minute precision dropped (e.g. pause shifts).
  return new Date(base.getTime() + (instant.getTime() % MINUTE_MS + MINUTE_MS) % MINUTE_MS);
}

/** First local `minutesOfDay` on or after `instant` (11:30 after a Tuesday-midnight end = Tuesday 11:30). */
export function nextLocalTime(instant: Date, minutesOfDay: number, timeZone: string): Date {
  const p = localParts(instant, timeZone);
  const sameDay = fromLocal({ ...p, minutes: minutesOfDay }, timeZone);
  return sameDay.getTime() >= instant.getTime()
    ? sameDay
    : fromLocal({ ...p, day: p.day + 1, minutes: minutesOfDay }, timeZone);
}
