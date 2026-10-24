export type ApiEnvelope<T> = {
  status: "success" | "error";
  data: T | null;
  meta?: Record<string, unknown>;
  errors?: Array<{ message: string; code?: string }>;
};

// ─── Enums ───────────────────────────────────────────────────────────────────

export type GroupRole = "OWNER" | "ADMIN" | "MEMBER";

// ─── Domain Models ───────────────────────────────────────────────────────────

/** Authenticated user (safe public fields only, no password) */
export type AuthUser = {
  id: string;
  name: string;
  email: string;
};

/** Group record returned by most group endpoints */
export type Group = {
  id: string;
  name: string;
  description: string | null;
  /** 8-character uppercase join code. Only visible to OWNER/ADMIN */
  joinCode: string | null;
  createdById: string;
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
  isArchived: boolean;
  archivedAt: string | null; // ISO date string
  /** The authenticated user's role in this group */
  role: GroupRole;
  /** Total number of current members */
  memberCount: number;
};

/** Safe user fields embedded inside membership records */
export type MemberUser = {
  id: string;
  name: string;
  email: string;
};

/** Full membership record (list members endpoint) */
export type GroupMemberRecord = {
  id: string;
  userId: string;
  groupId: string;
  role: GroupRole;
  joinedAt: string; // ISO date string
  user: MemberUser;
};

/** Membership without user info (GET /members/me) */
export type MembershipScalars = {
  id: string;
  userId: string;
  groupId: string;
  role: GroupRole;
  joinedAt: string; // ISO date string
};

/** Split record embedded in an expense */
export type ExpenseSplit = {
  id: string;
  userId: string;
  /** Decimal string, e.g. "250.00" */
  amount: string;
  user: MemberUser;
};

/** Full expense record (detail / create / update) */
export type ExpenseDetail = {
  id: string;
  description: string;
  /** Decimal string, e.g. "500.00" */
  amount: string;
  paidById: string;
  groupId: string;
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
  paidBy: MemberUser;
  splits: ExpenseSplit[];
};

/** Expense item returned in list views (same shape as ExpenseDetail) */
export type ExpenseListItem = ExpenseDetail;

/** Per-member balance in a group */
export type MemberBalance = {
  userId: string;
  name: string;
  email: string;
  /** Decimal string */
  totalPaid: string;
  /** Decimal string */
  totalShares: string;
  /** Decimal string; positive = owed money back, negative = owes money */
  netBalance: string;
};

/** One suggested payment to settle debts */
export type SettlementSuggestion = {
  fromUserId: string;
  fromName: string;
  toUserId: string;
  toName: string;
  /** Decimal string */
  amount: string;
};

// ─── Pagination Meta ─────────────────────────────────────────────────────────

export type PaginationMeta = {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};
