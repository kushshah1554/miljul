import { z } from "zod";
import { ChoreFineStatus } from "../../generated/prisma/client";
import { paginationQueryShape } from "../../utils/pagination";
import { groupIdParamSchema } from "../group/group.validation";
import { idSchema, reasonSchema } from "../chore/chore.validation";

export const fineIdParamSchema = z.object({
  ...groupIdParamSchema.shape,
  fineId: idSchema("Fine id"),
});

export const listFinesQuerySchema = z.strictObject({
  ...paginationQueryShape,
  choreId: idSchema("Chore id").optional(),
  payerId: idSchema("User id").optional(),
  recipientId: idSchema("User id").optional(),
  status: z.enum(ChoreFineStatus).optional(),
});

export const voidFineSchema = z.strictObject({ reason: reasonSchema });

export type ListFinesQuery = z.infer<typeof listFinesQuerySchema>;
export type VoidFineInput = z.infer<typeof voidFineSchema>;
