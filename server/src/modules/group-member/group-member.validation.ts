import { z } from "zod";
import { cuidPattern, groupIdParamSchema } from "../group/group.validation";

// Prisma user id (cuid), same format as the group module's groupId.
const userIdSchema = z
  .string()
  .trim()
  .regex(cuidPattern, "User id must be a valid id");

// Route params for endpoints that address one member of a group. groupId is
// reused from the group module; userId is a Prisma cuid of the same format.
export const memberParamsSchema = z.object({
  ...groupIdParamSchema.shape,
  userId: userIdSchema,
});

// Body of the dedicated ownership-transfer endpoint. The target is always
// taken from the authenticated request context plus this body field -
// never from a client-supplied identity for the caller.
export const transferOwnershipSchema = z.strictObject({
  newOwnerId: userIdSchema,
});

export type MemberParams = z.infer<typeof memberParamsSchema>;
export type TransferOwnershipInput = z.infer<typeof transferOwnershipSchema>;
