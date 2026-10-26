-- Existing admins become regular members before ADMIN is dropped.
UPDATE "group_members" SET "role" = 'MEMBER' WHERE "role" = 'ADMIN';

-- AlterEnum (PostgreSQL cannot drop an enum value, so recreate the type)
BEGIN;
CREATE TYPE "GroupRole_new" AS ENUM ('OWNER', 'MEMBER');
ALTER TABLE "group_members" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "group_members" ALTER COLUMN "role" TYPE "GroupRole_new" USING ("role"::text::"GroupRole_new");
ALTER TYPE "GroupRole" RENAME TO "GroupRole_old";
ALTER TYPE "GroupRole_new" RENAME TO "GroupRole";
DROP TYPE "GroupRole_old";
ALTER TABLE "group_members" ALTER COLUMN "role" SET DEFAULT 'MEMBER';
COMMIT;
