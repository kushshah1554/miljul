import { uploadProfileImage } from "../../config/cloudinary";
import { prisma } from "../../utils/prisma";
import type { AuthUser } from "../auth/auth.types";

export async function updateProfile(
  userId: string,
  input: { name?: string; image?: Buffer },
): Promise<AuthUser> {
  const profileUrl = input.image
    ? await uploadProfileImage(userId, input.image)
    : undefined;

  return prisma.user.update({
    where: { id: userId },
    data: { name: input.name, profileUrl },
    select: { id: true, email: true, name: true, profileUrl: true },
  });
}
