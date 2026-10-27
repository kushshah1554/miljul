import { describe, expect, it } from "vitest";
import { ChoreAssignmentStatus, ChoreSkipMode } from "../../generated/prisma/client";
import { addLocalDays, localMidnight, nextLocalTime } from "../../utils/timezone";
import { lockedUsers, projectUpcoming, promote } from "./chore.schedule";

const TZ = "Asia/Kathmandu"; // UTC+5:45

describe("timezone helpers", () => {
  it("computes local midnight and the 11:30 deadline after a Monday turn", () => {
    const monday = localMidnight("2026-10-26", TZ);
    expect(monday.toISOString()).toBe("2026-10-25T18:15:00.000Z");
    const endsAt = addLocalDays(monday, 1, TZ);
    expect(endsAt.toISOString()).toBe("2026-10-26T18:15:00.000Z");
    // Tuesday 11:30 local = 05:45 UTC
    expect(nextLocalTime(endsAt, 690, TZ).toISOString()).toBe("2026-10-27T05:45:00.000Z");
  });

  it("keeps wall-clock time across a DST change", () => {
    const before = new Date("2026-03-07T05:00:00.000Z"); // 00:00 New York (EST)
    expect(addLocalDays(before, 2, "America/New_York").toISOString()).toBe(
      "2026-03-09T04:00:00.000Z", // 00:00 New York (EDT)
    );
  });
});

describe("rotation rules", () => {
  it("does not lock a member whose turn was deferred", () => {
    const locked = lockedUsers([
      { userId: "ram", status: ChoreAssignmentStatus.APPROVED, skipMode: null },
      { userId: "kush", status: ChoreAssignmentStatus.SKIPPED, skipMode: ChoreSkipMode.DEFER },
      { userId: "lav", status: ChoreAssignmentStatus.SKIPPED, skipMode: ChoreSkipMode.FORFEIT },
    ]);
    expect([...locked].sort()).toEqual(["lav", "ram"]);
  });

  it("promotes the picked member right after the locked prefix", () => {
    expect(promote(["ram", "kush", "lav", "sita"], new Set(["ram"]), "lav")).toEqual([
      "ram",
      "lav",
      "kush",
      "sita",
    ]);
  });

  it("projects upcoming turns, passing unavailable members and wrapping cycles", () => {
    const from = localMidnight("2026-10-27", TZ);
    const turns = projectUpcoming({
      from,
      intervalDays: 1,
      timezone: TZ,
      cycleNumber: 1,
      pending: ["kush", "lav"],
      originalQueue: ["ram", "kush", "lav"],
      // kush is away for the first slot only
      availability: new Map([
        ["ram", null],
        ["kush", addLocalDays(from, 1, TZ)],
        ["lav", null],
      ]),
      count: 4,
    });
    expect(turns.map((t) => [t.userId, t.cycleNumber])).toEqual([
      ["lav", 1],
      ["kush", 1],
      ["ram", 2],
      ["kush", 2],
    ]);
  });

  it("stops when nobody would be available", () => {
    const from = localMidnight("2026-10-27", TZ);
    expect(
      projectUpcoming({
        from,
        intervalDays: 1,
        timezone: TZ,
        cycleNumber: 1,
        pending: [],
        originalQueue: ["ram"],
        availability: new Map([["ram", new Date("2030-01-01")]]),
        count: 5,
      }),
    ).toEqual([]);
  });
});
