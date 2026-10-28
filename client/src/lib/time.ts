// Display helpers for server timestamps. The server is the only clock; these only format.
// Times are shown in the group's timezone, the one deadlines are calculated in.

/** "28 Oct 2026, 11:30" in `timeZone` */
export function formatDateTime(iso: string, timeZone?: string) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  });
}

/** "Tue, 28 Oct" in `timeZone` */
export function formatDay(iso: string, timeZone?: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone,
  });
}

const relative = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
const UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ["day", 86_400_000],
  ["hour", 3_600_000],
  ["minute", 60_000],
];

/** "in 3 hours", "2 days ago" */
export function fromNow(iso: string) {
  const diff = new Date(iso).getTime() - Date.now();
  const [unit, ms] = UNITS.find(([, ms]) => Math.abs(diff) >= ms) ?? UNITS[UNITS.length - 1];
  return relative.format(Math.round(diff / ms), unit);
}

/** 690 → "11:30" */
export function minutesToTime(minutes: number) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

/** Value of an <input type="datetime-local"> → ISO string (browser-local time). */
export function localInputToIso(value: string) {
  return new Date(value).toISOString();
}

/** Every IANA timezone the browser knows, for pickers. */
export function timezoneOptions(): string[] {
  try {
    return Intl.supportedValuesOf("timeZone");
  } catch {
    return [];
  }
}

/** Accepts aliases such as "Asia/Kathmandu" that supportedValuesOf leaves out. */
export function isValidTimezone(timeZone: string) {
  try {
    new Intl.DateTimeFormat(undefined, { timeZone });
    return true;
  } catch {
    return false;
  }
}
