import { z } from "zod";
import { groupIdParamSchema } from "../group/group.validation";

// The balance endpoints only need a groupId route param.
// Re-export the shared schema for use in the controller.
export { groupIdParamSchema };

// Inferred type aliases kept here for symmetry with other validation modules.
export type BalanceGroupIdParam = z.infer<typeof groupIdParamSchema>;
