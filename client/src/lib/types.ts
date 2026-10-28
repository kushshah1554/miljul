export type ApiEnvelope<T> = {
  status: "success" | "error";
  data: T | null;
  meta?: Record<string, unknown>;
  errors?: Array<{ message: string; code?: string }>;
};

// ─── Enums ───────────────────────────────────────────────────────────────────

export type GroupRole = "OWNER" | "MEMBER";

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
  /** 8-character uppercase join code. Only visible to OWNER */
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
  /** IANA timezone used for chore deadlines, e.g. "Asia/Kathmandu" */
  timezone: string;
  /** Non-null while a group-wide chore pause is active */
  choresPausedAt: string | null;
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

// ─── Chores (matches Chore.md) ──────────────────────────────────────────────

export type ChoreStatus = "ACTIVE" | "PAUSED" | "NEEDS_ATTENTION" | "ARCHIVED";

export type ChoreAssignmentStatus =
  | "PENDING"
  | "SUBMITTED"
  | "APPROVED"
  | "REJECTED"
  | "SKIPPED"
  | "WAIVED";

export type ChoreSkipMode = "DEFER" | "FORFEIT";
export type ChoreReviewDecision = "APPROVED" | "REJECTED";
export type ChoreFineReason = "OVERDUE" | "QUALITY";
export type ChoreFineStatus = "ACTIVE" | "VOIDED";

export type ChoreParticipant = {
  userId: string;
  user: MemberUser;
  /** Original-queue position, 0-based */
  position: number;
  joinedAt: string;
  removedAt: string | null;
  unavailableUntil: string | null;
  unavailableReason: string | null;
};

export type ChoreChecklistItem = {
  id: string;
  label: string;
  position: number;
};

export type ChoreCycle = {
  id: string;
  number: number;
  /** userIds, current-cycle queue */
  order: string[];
  /** order[0..lockedCount) already had (or are having) their turn */
  lockedCount: number;
  startedAt: string;
  endedAt: string | null;
};

export type UpcomingTurn = {
  userId: string;
  startsAt: string;
  endsAt: string;
  cycleNumber: number;
};

export type ChoreAssignment = {
  id: string;
  choreId: string;
  cycleId: string;
  userId: string;
  user: MemberUser;
  startsAt: string;
  endsAt: string;
  deadlineAt: string;
  status: ChoreAssignmentStatus;
  isOverdue: boolean;
  wasLate: boolean;
  firstSubmittedAt: string | null;
  submittedAt: string | null;
  submissionNote: string | null;
  skipRequestedAt: string | null;
  skipRequestReason: string | null;
  skipMode: ChoreSkipMode | null;
  closedBy: MemberUser | null;
  closedAt: string | null;
  closeReason: string | null;
  replacedById: string | null;
};

/** "My assignments" rows also carry the chore's name */
export type MyChoreAssignment = ChoreAssignment & { choreName: string };

export type ChoreReview = {
  id: string;
  reviewer: MemberUser;
  decision: ChoreReviewDecision;
  results: Array<{ itemId: string; label: string; passed: boolean }>;
  feedback: string | null;
  createdAt: string;
};

export type ChoreFine = {
  id: string;
  assignmentId: string;
  choreId: string;
  choreName: string;
  payer: MemberUser;
  reasons: ChoreFineReason[];
  status: ChoreFineStatus;
  /** Decimal string, sum of shares */
  totalAmount: string;
  shares: Array<{ recipient: MemberUser; amount: string }>;
  voidedBy: MemberUser | null;
  voidReason: string | null;
  createdAt: string;
};

export type ChorePause = {
  id: string;
  /** null = group-wide pause */
  choreId: string | null;
  pausedBy: MemberUser;
  pausedAt: string;
  reason: string | null;
  resumedBy: MemberUser | null;
  resumedAt: string | null;
  resumeReason: string | null;
};

export type ChoreSummary = {
  id: string;
  name: string;
  description: string | null;
  intervalDays: number;
  /** Minutes after local midnight, 690 = 11:30 */
  deadlineMinutes: number;
  /** Decimal string */
  finePerMember: string;
  status: ChoreStatus;
  /** Paused individually OR by a group-wide pause */
  isFrozen: boolean;
  currentAssignment: ChoreAssignment | null;
  nextRotationAt: string | null;
};

export type ChoreDetail = ChoreSummary & {
  createdBy: MemberUser;
  createdAt: string;
  updatedAt: string;
  participants: ChoreParticipant[];
  originalQueue: string[];
  currentCycle: ChoreCycle | null;
  upcoming: UpcomingTurn[];
  checklist: ChoreChecklistItem[];
  openAssignments: ChoreAssignment[];
};

export type FineSummaryMember = {
  user: MemberUser;
  /** Decimal strings */
  totalOwed: string;
  totalReceivable: string;
  net: string;
};

// ─── Pagination Meta ─────────────────────────────────────────────────────────

export type PaginationMeta = {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};
