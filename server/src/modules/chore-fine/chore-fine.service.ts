import { Prisma, ChoreFineStatus } from "../../generated/prisma/client";
import { AppError } from "../../utils/AppError";
import { requireFound } from "../../utils/helpers";
import { withChores } from "../chore/chore.access";
import { choreUserSelect, fineSelect, toFine } from "../chore/chore.shared";
import type { ListFinesQuery, VoidFineInput } from "./chore-fine.validation";

type ChoreUser = Prisma.UserGetPayload<{ select: typeof choreUserSelect }>;

/** Fine history, newest first. Fines are kept out of expense balances. */
export function listFines(userId: string, groupId: string, query: ListFinesQuery) {
  return withChores(userId, groupId, {}, async ({ tx }) => {
    const where: Prisma.ChoreFineWhereInput = {
      assignment: { chore: { groupId }, choreId: query.choreId },
      payerId: query.payerId,
      status: query.status,
      ...(query.recipientId ? { shares: { some: { recipientId: query.recipientId } } } : {}),
    };
    const rows = await tx.choreFine.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      select: fineSelect,
    });
    const total = await tx.choreFine.count({ where });
    return { fines: rows.map(toFine), total, page: query.page, limit: query.limit };
  });
}

/** ACTIVE fines netted per member, including members who left the group. */
export function getFineSummary(userId: string, groupId: string) {
  return withChores(userId, groupId, {}, async ({ tx }) => {
    const fines = await tx.choreFine.findMany({
      where: { status: ChoreFineStatus.ACTIVE, assignment: { chore: { groupId } } },
      select: {
        payer: { select: choreUserSelect },
        shares: { select: { amount: true, recipient: { select: choreUserSelect } } },
      },
    });

    const zero = new Prisma.Decimal(0);
    const totals = new Map<string, { user: ChoreUser; owed: Prisma.Decimal; receivable: Prisma.Decimal }>();
    const entry = (user: ChoreUser) => {
      let t = totals.get(user.id);
      if (!t) {
        t = { user, owed: zero, receivable: zero };
        totals.set(user.id, t);
      }
      return t;
    };
    for (const fine of fines) {
      const payer = entry(fine.payer);
      for (const share of fine.shares) {
        payer.owed = payer.owed.add(share.amount);
        const recipient = entry(share.recipient);
        recipient.receivable = recipient.receivable.add(share.amount);
      }
    }

    const members = [...totals.values()]
      .sort((a, b) => a.user.name.localeCompare(b.user.name))
      .map((t) => ({
        user: t.user,
        totalOwed: t.owed.toFixed(2),
        totalReceivable: t.receivable.toFixed(2),
        net: t.receivable.sub(t.owed).toFixed(2),
      }));
    return { members };
  });
}

/** Cancels a fine; the row and its shares are kept as VOIDED. */
export function voidFine(userId: string, groupId: string, fineId: string, input: VoidFineInput) {
  return withChores(userId, groupId, { owner: "void fines" }, async ({ tx }) => {
    const fine = requireFound(
      await tx.choreFine.findFirst({
        where: { id: fineId, assignment: { chore: { groupId } } },
        select: { status: true },
      }),
      "Fine not found",
    );
    if (fine.status === ChoreFineStatus.VOIDED) {
      throw new AppError(409, "Fine is already voided");
    }

    const updated = await tx.choreFine.update({
      where: { id: fineId },
      data: { status: ChoreFineStatus.VOIDED, voidedById: userId, voidReason: input.reason },
      select: fineSelect,
    });
    return { fine: toFine(updated) };
  });
}
