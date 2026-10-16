import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { dispatchTool, isKnownTool } from "./tools.server.ts";

describe("tool dispatch", () => {
  it("rejects unknown tools", async () => {
    assert.equal(isKnownTool("exec_shell"), false);
    const result = await dispatchTool({ tool: "exec_shell" as any, args: {} });
    assert.equal(result.ok, false);
    assert.match(result.output, /Unknown tool/);
  });

  it("read_file returns real package.json content", async () => {
    const result = await dispatchTool({ tool: "read_file", args: { path: "package.json" } });
    assert.equal(result.ok, true);
    assert.match(result.output, /tanstack_start_ts/);
  });

  it("read_file rejects path traversal with ..", async () => {
    const result = await dispatchTool({ tool: "read_file", args: { path: "../../etc/passwd" } });
    assert.equal(result.ok, false);
    assert.match(result.output, /outside/i);
  });

  it("read_file rejects absolute paths", async () => {
    const result = await dispatchTool({ tool: "read_file", args: { path: "/etc/passwd" } });
    assert.equal(result.ok, false);
    assert.match(result.output, /Absolute/i);
  });

  it("read_file rejects null bytes in paths", async () => {
    const result = await dispatchTool({ tool: "read_file", args: { path: "src/\0evil" } });
    assert.equal(result.ok, false);
    assert.match(result.output, /null/i);
  });

  it("read_file detects binary files", async () => {
    // Use a known image asset that's under the size limit
    const result = await dispatchTool({ tool: "read_file", args: { path: "src/assets/darkcoders-logo.png" } });
    assert.equal(result.ok, false);
    assert.match(result.output, /binary/i);
  });

  it("read_file rejects missing path argument", async () => {
    const result = await dispatchTool({ tool: "read_file", args: {} });
    assert.equal(result.ok, false);
    assert.match(result.output, /Missing/);
  });

  it("read_file blocks env secret files", async () => {
    const result = await dispatchTool({ tool: "read_file", args: { path: ".env" } });
    assert.equal(result.ok, false);
    assert.match(result.output, /sensitive/i);
  });

  it("read_file blocks .env.example variants too", async () => {
    const result = await dispatchTool({ tool: "read_file", args: { path: ".env.example" } });
    assert.equal(result.ok, false);
    assert.match(result.output, /sensitive/i);
  });

  it("write_fix blocks writes to secret files", async () => {
    const result = await dispatchTool({
      tool: "write_fix",
      args: { path: ".env", content: "hacked", description: "tamper" },
    });
    assert.equal(result.ok, false);
    assert.match(result.output, /sensitive/i);
  });

  it("list_files returns real directory entries", async () => {
    const result = await dispatchTool({ tool: "list_files", args: { path: "src/routes/api" } });
    assert.equal(result.ok, true);
    assert.match(result.output, /agent\.ts/);
    assert.match(result.output, /llm\.ts/);
  });

  it("list_files rejects path outside workspace", async () => {
    const result = await dispatchTool({ tool: "list_files", args: { path: "../../.." } });
    assert.equal(result.ok, false);
    assert.match(result.output, /outside/i);
  });

  it("search_code finds real matches", async () => {
    const result = await dispatchTool({ tool: "search_code", args: { pattern: "getApiKey", path: "src/lib/ai" } });
    assert.equal(result.ok, true);
    assert.match(result.output, /gateway\.server/);
  });

  it("search_code rejects empty pattern", async () => {
    const result = await dispatchTool({ tool: "search_code", args: { pattern: "" } });
    assert.equal(result.ok, false);
    assert.match(result.output, /Missing/);
  });

  it("write_fix creates approval request instead of executing", async () => {
    const result = await dispatchTool({
      tool: "write_fix",
      args: { path: "README.md", content: "test content", description: "Test fix" },
    });
    assert.equal(result.ok, true);
    assert.ok(result.needsApproval);
    assert.equal(result.needsApproval?.risk, "high");
    assert.match(result.output, /awaiting human approval/i);
  });

  it("write_fix rejects path traversal", async () => {
    const result = await dispatchTool({
      tool: "write_fix",
      args: { path: "../../outside.txt", content: "evil" },
    });
    assert.equal(result.ok, false);
    assert.match(result.output, /outside/i);
  });
});
