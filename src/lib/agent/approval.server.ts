import crypto from "node:crypto";

// ---------------------------------------------------------------------------
// Server-side action record store for human approval enforcement.
//
// Every state-changing tool call creates a record here. The operation
// executes ONLY if the record is verified as approved. This is an
// in-memory store — records are lost on server restart. That is
// acceptable for this local prototype; a production system would use
// a persistent store.
// ---------------------------------------------------------------------------

export type ProposalStatus = "pending" | "approved" | "denied" | "executed" | "expired";

export type ActionRecord = {
  id: string;
  tool: string;
  args: Record<string, unknown>;
  argsHash: string;
  status: ProposalStatus;
  createdAt: number;
  expiresAt: number;
  result?: string;
};

const EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
const store = new Map<string, ActionRecord>();

/** Hash the arguments so we can verify they haven't changed. */
function hashArgs(args: Record<string, unknown>): string {
  return crypto.createHash("sha256").update(JSON.stringify(args)).digest("hex");
}

/** Creates a new pending proposal. Returns the record with a server-generated ID. */
export function createProposal(tool: string, args: Record<string, unknown>): ActionRecord {
  sweepExpired();
  const record: ActionRecord = {
    id: crypto.randomUUID(),
    tool,
    args,
    argsHash: hashArgs(args),
    status: "pending",
    createdAt: Date.now(),
    expiresAt: Date.now() + EXPIRY_MS,
  };
  store.set(record.id, record);
  return record;
}

/** Looks up a proposal by ID. Returns null if not found. */
export function getProposal(id: string): ActionRecord | null {
  sweepExpired();
  return store.get(id) ?? null;
}

export class ApprovalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApprovalError";
  }
}

/**
 * Resolves a proposal decision. Returns the record ONLY if the decision
 * transitions from `pending` to `approved` or `denied`.
 *
 * Throws ApprovalError for:
 *  - Unknown proposal ID
 *  - Proposal not in pending state
 *  - Expired proposal
 */
export function resolveProposal(id: string, approved: boolean): ActionRecord {
  sweepExpired();
  const record = store.get(id);
  if (!record) throw new ApprovalError("Unknown proposal ID.");
  if (record.status !== "pending") throw new ApprovalError(`Proposal is already ${record.status}.`);
  if (Date.now() > record.expiresAt) {
    record.status = "expired";
    throw new ApprovalError("Proposal has expired.");
  }
  record.status = approved ? "approved" : "denied";
  return record;
}

/**
 * Marks an approved proposal as executed, storing the result.
 * Returns the stored arguments for execution.
 *
 * Throws ApprovalError if the proposal is not in the `approved` state
 * or if the arguments hash doesn't match (tamper detection).
 */
export function consumeApproval(id: string): { tool: string; args: Record<string, unknown> } {
  const record = store.get(id);
  if (!record) throw new ApprovalError("Unknown proposal ID.");
  if (record.status !== "approved") throw new ApprovalError(`Cannot execute: proposal is ${record.status}.`);
  if (hashArgs(record.args) !== record.argsHash) throw new ApprovalError("Proposal arguments have been tampered with.");
  record.status = "executed";
  return { tool: record.tool, args: record.args };
}

/** Stores the execution result on a consumed record. */
export function setResult(id: string, result: string): void {
  const record = store.get(id);
  if (record) record.result = result;
}

/** Sweep expired records to prevent unbounded growth. */
function sweepExpired(): void {
  const now = Date.now();
  for (const [id, record] of store) {
    if (record.status === "pending" && now > record.expiresAt) {
      record.status = "expired";
    }
    // Remove very old records (> 30 minutes) regardless of status.
    if (now - record.createdAt > 30 * 60 * 1000) {
      store.delete(id);
    }
  }
}

/** Resets the store (for testing only). */
export function _resetStore(): void {
  store.clear();
}
