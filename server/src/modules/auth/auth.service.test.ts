import { beforeEach, describe, expect, it, vi } from "vitest";
import * as authService from "./auth.service";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("../../utils/prisma", () => ({ prisma: prismaMock }));

const PROFILE = {
  sub: "google-1",
  email: "Kush@Gmail.com",
  email_verified: true,
  name: "Kush",
  picture: "https://lh3.googleusercontent.com/a/photo",
};

const USER = {
  id: "user1",
  email: "kush@gmail.com",
  name: "Kush",
  password: "hash",
  googleId: null,
  profileUrl: null,
};

function stubGoogle(profile: object = PROFILE) {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValueOnce(Response.json({ access_token: "access" }))
      .mockResolvedValueOnce(Response.json(profile)),
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.unstubAllGlobals();
  prismaMock.user.findUnique.mockResolvedValue(null);
  prismaMock.user.create.mockImplementation(async ({ data }) => ({
    ...USER,
    ...data,
  }));
  prismaMock.user.update.mockImplementation(async ({ data }) => ({
    ...USER,
    ...data,
  }));
});

describe("googleLogin", () => {
  it("creates a passwordless user for a new Google account", async () => {
    stubGoogle();

    const { user } = await authService.googleLogin("code");

    const { data } = prismaMock.user.create.mock.calls[0]![0];
    expect(data).toMatchObject({
      email: "kush@gmail.com",
      googleId: "google-1",
      profileUrl: PROFILE.picture,
    });
    expect(data.password).toBeUndefined();
    expect(user.profileUrl).toBe(PROFILE.picture);
  });

  it("links an existing password account by email and keeps its password", async () => {
    stubGoogle();
    prismaMock.user.findUnique
      .mockResolvedValueOnce(null) // no account with this googleId
      .mockResolvedValueOnce(USER); // account with this email

    await authService.googleLogin("code");

    expect(prismaMock.user.create).not.toHaveBeenCalled();
    const firstUpdate = prismaMock.user.update.mock.calls[0]![0];
    expect(firstUpdate.where).toEqual({ id: "user1" });
    expect(firstUpdate.data).toEqual({
      googleId: "google-1",
      profileUrl: PROFILE.picture,
    });
  });

  it("keeps a picture the user already has", async () => {
    const uploaded = "https://res.cloudinary.com/demo/image/upload/v1/user1.jpg";
    stubGoogle();
    prismaMock.user.findUnique.mockResolvedValueOnce({
      ...USER,
      googleId: "google-1",
      profileUrl: uploaded,
    });

    await authService.googleLogin("code");

    expect(prismaMock.user.update.mock.calls[0]![0].data.profileUrl).toBe(uploaded);
  });

  it("rejects a Google email that Google has not verified", async () => {
    stubGoogle({ ...PROFILE, email_verified: false });
    prismaMock.user.findUnique.mockResolvedValue(USER);

    await expect(authService.googleLogin("code")).rejects.toMatchObject({
      statusCode: 403,
    });
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it("rejects an email already linked to a different Google account", async () => {
    stubGoogle();
    prismaMock.user.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ ...USER, googleId: "google-2" });

    await expect(authService.googleLogin("code")).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it("fails when Google rejects the code", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 400 })),
    );

    await expect(authService.googleLogin("bad")).rejects.toMatchObject({
      statusCode: 502,
    });
    expect(prismaMock.user.create).not.toHaveBeenCalled();
  });
});

describe("login", () => {
  it("rejects a password login on a Google-only account", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ ...USER, password: null });

    await expect(
      authService.login({ email: "kush@gmail.com", password: "secret123" }),
    ).rejects.toMatchObject({ statusCode: 401 });
  });
});
