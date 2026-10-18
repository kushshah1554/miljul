import { describe, expect, it } from "vitest";
import { joinGroupSchema } from "./group.validation";

describe("joinGroupSchema", () => {
  it("accepts a well-formed code", () => {
    const result = joinGroupSchema.safeParse({ joinCode: "ABCD2345" });
    expect(result.success).toBe(true);
  });

  it("trims and upper-cases the code before validation", () => {
    const result = joinGroupSchema.parse({ joinCode: "  abcd2345  " });
    expect(result.joinCode).toBe("ABCD2345");
  });

  it("rejects a code with the wrong length", () => {
    expect(joinGroupSchema.safeParse({ joinCode: "ABCD234" }).success).toBe(
      false,
    );
    expect(joinGroupSchema.safeParse({ joinCode: "ABCD23456" }).success).toBe(
      false,
    );
  });

  it("rejects an empty or whitespace-only code", () => {
    expect(joinGroupSchema.safeParse({ joinCode: "" }).success).toBe(false);
    expect(joinGroupSchema.safeParse({ joinCode: "   " }).success).toBe(false);
  });

  it("rejects non-string values", () => {
    expect(joinGroupSchema.safeParse({ joinCode: 12345678 }).success).toBe(
      false,
    );
    expect(joinGroupSchema.safeParse({ joinCode: null }).success).toBe(false);
    expect(joinGroupSchema.safeParse({}).success).toBe(false);
  });

  it("rejects unknown fields (strict object)", () => {
    expect(
      joinGroupSchema.safeParse({ joinCode: "ABCD2345", role: "OWNER" })
        .success,
    ).toBe(false);
  });
});
