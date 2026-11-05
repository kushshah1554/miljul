import { beforeEach, describe, expect, it, vi } from "vitest";
import { updateProfile } from "./user.service";

const { prismaMock, uploadMock } = vi.hoisted(() => ({
  prismaMock: { user: { update: vi.fn() } },
  uploadMock: vi.fn(),
}));

vi.mock("../../utils/prisma", () => ({ prisma: prismaMock }));
vi.mock("../../config/cloudinary", () => ({ uploadProfileImage: uploadMock }));

const IMAGE = Buffer.from("image");
const URL = "https://res.cloudinary.com/demo/image/upload/v1/user1.jpg";

beforeEach(() => {
  vi.resetAllMocks();
});

describe("updateProfile", () => {
  it("changes only the name when no image is sent, keeping the picture", async () => {
    await updateProfile("user1", { name: "Kush" });

    expect(uploadMock).not.toHaveBeenCalled();
    const { where, data, select } = prismaMock.user.update.mock.calls[0]![0];
    expect(where).toEqual({ id: "user1" });
    expect(data).toEqual({ name: "Kush", profileUrl: undefined });
    expect(select.password).toBeUndefined();
    expect(select.refreshToken).toBeUndefined();
  });

  it("stores the uploaded image's URL", async () => {
    uploadMock.mockResolvedValue(URL);

    await updateProfile("user1", { image: IMAGE });

    expect(uploadMock).toHaveBeenCalledWith("user1", IMAGE);
    expect(prismaMock.user.update.mock.calls[0]![0].data.profileUrl).toBe(URL);
  });

  it("saves nothing when the upload fails", async () => {
    uploadMock.mockRejectedValue(new Error("upload failed"));

    await expect(
      updateProfile("user1", { name: "Kush", image: IMAGE }),
    ).rejects.toThrow("upload failed");
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });
});
