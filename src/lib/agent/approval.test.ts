import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  createProposal,
  resolveProposal,
  consumeApproval,
  getProposal,
  _resetStore,
  ApprovalError,
} from "./approval.server.ts";

describe("approval store", () => {
  beforeEach(() => _resetStore());

  it("creates a proposal with a unique ID", () => {
    const a = createProposal("write_fix", { path: "a.ts", content: "x" });
    const b = createProposal("write_fix", { path: "b.ts", content: "y" });
    assert.notEqual(a.id, b.id);
    assert.equal(a.status, "pending");
    assert.equal(a.tool, "write_fix");
  });

  it("approves a pending proposal", () => {
    const record = createProposal("write_fix", { path: "a.ts", content: "x" });
    const resolved = resolveProposal(record.id, true);
    assert.equal(resolved.status, "approved");
  });

  it("denies a pending proposal", () => {
    const record = createProposal("write_fix", { path: "a.ts", content: "x" });
    const resolved = resolveProposal(record.id, false);
    assert.equal(resolved.status, "denied");
  });

  it("rejects approval of an unknown ID", () => {
    assert.throws(() => resolveProposal("non-existent-id", true), ApprovalError);
  });

  it("rejects double approval", () => {
    const record = createProposal("write_fix", { path: "a.ts", content: "x" });
    resolveProposal(record.id, true);
    assert.throws(() => resolveProposal(record.id, true), ApprovalError);
  });

  it("rejects approval after denial", () => {
    const record = createProposal("write_fix", { path: "a.ts", content: "x" });
    resolveProposal(record.id, false);
    assert.throws(() => resolveProposal(record.id, true), ApprovalError);
  });

  it("consumes an approved proposal exactly once", () => {
    const record = createProposal("write_fix", { path: "a.ts", content: "x" });
    resolveProposal(record.id, true);
    const consumed = consumeApproval(record.id);
    assert.deepEqual(consumed.args, { path: "a.ts", content: "x" });
    // Second consumption fails
    assert.throws(() => consumeApproval(record.id), ApprovalError);
  });

  it("rejects consumption of a denied proposal", () => {
    const record = createProposal("write_fix", { path: "a.ts", content: "x" });
    resolveProposal(record.id, false);
    assert.throws(() => consumeApproval(record.id), ApprovalError);
  });

  it("rejects consumption of a pending proposal", () => {
    const record = createProposal("write_fix", { path: "a.ts", content: "x" });
    assert.throws(() => consumeApproval(record.id), ApprovalError);
  });

  it("looks up proposals by ID", () => {
    const record = createProposal("write_fix", { path: "a.ts", content: "x" });
    const found = getProposal(record.id);
    assert.equal(found?.id, record.id);
    assert.equal(getProposal("missing"), null);
  });
});
