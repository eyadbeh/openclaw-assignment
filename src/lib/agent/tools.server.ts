import path from "node:path";
import fs from "node:fs/promises";
import { resolveSafe, readSafeFile, workspaceRoot, WorkspaceBoundaryError } from "./workspace.server.ts";

// ---------------------------------------------------------------------------
// Tool registry
// ---------------------------------------------------------------------------

export type ToolName = "read_file" | "list_files" | "search_code" | "write_fix";

export type ToolRequest = {
  tool: ToolName;
  args: Record<string, unknown>;
};

export type ToolResult = {
  tool: ToolName;
  ok: boolean;
  output: string;
  /** Set when the tool requires human approval before execution. */
  needsApproval?: {
    title: string;
    summary: string;
    risk: "low" | "medium" | "high";
    args: Record<string, unknown>;
  };
};

const TOOL_NAMES: ReadonlySet<string> = new Set<ToolName>(["read_file", "list_files", "search_code", "write_fix"]);

export function isKnownTool(name: string): name is ToolName {
  return TOOL_NAMES.has(name);
}

// ---------------------------------------------------------------------------
// Tool implementations
// ---------------------------------------------------------------------------

/** Reads a text file's content within the workspace. */
async function readFile(args: Record<string, unknown>): Promise<ToolResult> {
  const filePath = String(args["path"] ?? "");
  if (!filePath) return { tool: "read_file", ok: false, output: "Missing required argument: path" };
  try {
    const safe = await resolveSafe(filePath);
    const content = await readSafeFile(safe);
    const relative = path.relative(workspaceRoot(), safe);
    return { tool: "read_file", ok: true, output: `File: ${relative}\n\n${content}` };
  } catch (error) {
    const message = error instanceof WorkspaceBoundaryError ? error.message : error instanceof Error ? error.message : "Read failed";
    return { tool: "read_file", ok: false, output: message };
  }
}

/** Lists files and directories within a workspace directory. */
async function listFiles(args: Record<string, unknown>): Promise<ToolResult> {
  const dirPath = String(args["path"] ?? ".");
  try {
    const safe = await resolveSafe(dirPath);
    const stat = await fs.stat(safe);
    if (!stat.isDirectory()) return { tool: "list_files", ok: false, output: "Path is not a directory." };
    const entries = await fs.readdir(safe, { withFileTypes: true });
    const lines = entries
      .sort((a, b) => {
        // directories first, then alphabetical
        if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
        return a.name.localeCompare(b.name);
      })
      .map((entry) => `${entry.isDirectory() ? "📁" : "📄"} ${entry.name}`)
      .slice(0, 200); // cap at 200 entries
    const relative = path.relative(workspaceRoot(), safe) || ".";
    const truncated = entries.length > 200 ? `\n(showing 200 of ${entries.length})` : "";
    return { tool: "list_files", ok: true, output: `Directory: ${relative}\n\n${lines.join("\n")}${truncated}` };
  } catch (error) {
    const message = error instanceof WorkspaceBoundaryError ? error.message : error instanceof Error ? error.message : "List failed";
    return { tool: "list_files", ok: false, output: message };
  }
}

/** Searches for a text pattern in workspace files. */
async function searchCode(args: Record<string, unknown>): Promise<ToolResult> {
  const pattern = String(args["pattern"] ?? "");
  const searchDir = String(args["path"] ?? ".");
  if (!pattern) return { tool: "search_code", ok: false, output: "Missing required argument: pattern" };
  if (pattern.length > 200) return { tool: "search_code", ok: false, output: "Pattern is too long (max 200 characters)." };

  try {
    const safeDir = await resolveSafe(searchDir);
    const stat = await fs.stat(safeDir);
    if (!stat.isDirectory()) return { tool: "search_code", ok: false, output: "Path is not a directory." };

    const matches: string[] = [];
    await walkAndSearch(safeDir, pattern, matches, 0);
    if (!matches.length) return { tool: "search_code", ok: true, output: `No matches found for "${pattern}".` };
    const truncated = matches.length >= 50 ? "\n(results capped at 50 matches)" : "";
    return { tool: "search_code", ok: true, output: `Found ${matches.length} match${matches.length === 1 ? "" : "es"} for "${pattern}":\n\n${matches.join("\n")}${truncated}` };
  } catch (error) {
    const message = error instanceof WorkspaceBoundaryError ? error.message : error instanceof Error ? error.message : "Search failed";
    return { tool: "search_code", ok: false, output: message };
  }
}

const SKIP_DIRS = new Set(["node_modules", ".git", ".output", "dist", ".next", ".cache", ".nitro"]);
const MAX_SEARCH_SIZE = 256_000; // Skip files > 250 KB

async function walkAndSearch(dir: string, pattern: string, matches: string[], depth: number): Promise<void> {
  if (depth > 15 || matches.length >= 50) return;
  let entries;
  try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return; }
  for (const entry of entries) {
    if (matches.length >= 50) return;
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name) || entry.name.startsWith(".")) continue;
      await walkAndSearch(path.join(dir, entry.name), pattern, matches, depth + 1);
    } else if (entry.isFile()) {
      try {
        const full = path.join(dir, entry.name);
        const stat = await fs.stat(full);
        if (stat.size > MAX_SEARCH_SIZE) continue;
        const buf = await fs.readFile(full);
        if (buf.subarray(0, 512).includes(0)) continue; // skip binary
        const text = buf.toString("utf-8");
        const lines = text.split("\n");
        const relative = path.relative(workspaceRoot(), full);
        for (let i = 0; i < lines.length && matches.length < 50; i++) {
          if (lines[i]!.includes(pattern)) {
            matches.push(`${relative}:${i + 1}: ${lines[i]!.trim().slice(0, 120)}`);
          }
        }
      } catch { /* skip unreadable files */ }
    }
  }
}

/** Proposes a file write — does NOT execute. Returns an approval request. */
async function writeFix(args: Record<string, unknown>): Promise<ToolResult> {
  const filePath = String(args["path"] ?? "");
  const content = String(args["content"] ?? "");
  const description = String(args["description"] ?? "Apply code fix");
  if (!filePath) return { tool: "write_fix", ok: false, output: "Missing required argument: path" };
  if (!content) return { tool: "write_fix", ok: false, output: "Missing required argument: content" };

  try {
    // Validate path is within workspace (but don't execute the write).
    await resolveSafe(filePath);
    return {
      tool: "write_fix",
      ok: true,
      output: `Proposed fix for ${filePath} — awaiting human approval.`,
      needsApproval: {
        title: description,
        summary: `Write ${content.length} characters to ${filePath}`,
        risk: "high",
        args: { path: filePath, content },
      },
    };
  } catch (error) {
    const message = error instanceof WorkspaceBoundaryError ? error.message : error instanceof Error ? error.message : "Path validation failed";
    return { tool: "write_fix", ok: false, output: message };
  }
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

/** Dispatches a tool request. Unknown tools are rejected. */
export async function dispatchTool(request: ToolRequest): Promise<ToolResult> {
  switch (request.tool) {
    case "read_file": return readFile(request.args);
    case "list_files": return listFiles(request.args);
    case "search_code": return searchCode(request.args);
    case "write_fix": return writeFix(request.args);
    default: return { tool: request.tool, ok: false, output: `Unknown tool: ${request.tool}` };
  }
}

/** Executes an approved write_fix with the stored arguments. */
export async function executeApprovedWrite(args: Record<string, unknown>): Promise<ToolResult> {
  const filePath = String(args["path"] ?? "");
  const content = String(args["content"] ?? "");
  try {
    const safe = await resolveSafe(filePath);
    await fs.writeFile(safe, content, "utf-8");
    const relative = path.relative(workspaceRoot(), safe);
    return { tool: "write_fix", ok: true, output: `Successfully wrote ${content.length} characters to ${relative}.` };
  } catch (error) {
    const message = error instanceof WorkspaceBoundaryError ? error.message : error instanceof Error ? error.message : "Write failed";
    return { tool: "write_fix", ok: false, output: message };
  }
}
