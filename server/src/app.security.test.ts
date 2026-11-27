import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { mainEntryFunction } from "./app";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: { user: { findUnique: vi.fn().mockResolvedValue(null) } },
}));
vi.mock("./utils/prisma", () => ({ prisma: prismaMock }));

let server: Server;
let base: string;

beforeAll(async () => {
  server = mainEntryFunction().listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://localhost:${(server.address() as AddressInfo).port}`;
});
afterAll(() => server.close());

const login = (email: string, forwardedFor: string) =>
  fetch(`${base}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Forwarded-For": forwardedFor },
    body: JSON.stringify({ email, password: "wrong" }),
  });

describe("security middleware", () => {
  it("sends security headers and no caching", async () => {
    const res = await fetch(`${base}/api/groups`);

    expect(res.status).toBe(401);
    expect(res.headers.get("x-powered-by")).toBeNull();
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("strict-transport-security")).toBeTruthy();
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("limits failed logins per account, whatever IP is claimed", async () => {
    for (let i = 0; i < 10; i += 1) {
      expect((await login("a@x.com", `1.1.1.${i}`)).status).toBe(401);
    }

    const blocked = await login("A@X.com", "9.9.9.9");
    expect(blocked.status).toBe(429);
    expect(await blocked.json()).toMatchObject({ errors: [{ code: "RATE_LIMITED" }] });
    expect((await login("b@x.com", "9.9.9.9")).status).toBe(401);
  });

  it("rejects oversized bodies with 413", async () => {
    const res = await fetch(`${base}/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "x".repeat(200_000) }),
    });
    expect(res.status).toBe(413);
  });
});
