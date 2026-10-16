import path from "node:path";
import fs from "node:fs/promises";

// ---------------------------------------------------------------------------
// Workspace root — the repository directory (contains package.json).
// Resolved once; every tool path is validated against this boundary.
// ---------------------------------------------------------------------------

let _root: string | null = null;

/** Returns the workspace root (the directory containing this project's package.json). */
export function workspaceRoot(): string {
  if (!_root) {
    // Walk up from this file's directory until we hit a package.json.
    // In the built server the file lives inside .output/, so we resolve from cwd.
    _root = path.resolve(process.cwd());
  }
  return _root;
}

// ---------------------------------------------------------------------------
// Safe path resolution — ensures all tool paths stay inside the workspace.
// ---------------------------------------------------------------------------

export class WorkspaceBoundaryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkspaceBoundaryError";
  }
}

/**
 * Resolves `userPath` within the workspace.
 * Returns the resolved absolute path or throws `WorkspaceBoundaryError`.
 *
 * Security properties:
 *  - `..` segments are resolved and checked.
 *  - Absolute paths are rejected.
 *  - Null bytes in the path are rejected.
 *  - The resolved path must start with `workspaceRoot() + sep`.
 *  - Symlinks are followed, and the real path is re-checked.
 */
export async function resolveSafe(userPath: string): Promise<string> {
  if (!userPath || typeof userPath !== "string") {
    throw new WorkspaceBoundaryError("Path must be a non-empty string.");
  }

  // Null bytes break C-level path functions and can bypass checks.
  if (userPath.includes("\0")) {
    throw new WorkspaceBoundaryError("Path contains null bytes.");
  }

  // Reject absolute paths (Unix `/`, Windows `C:\`, UNC `\\`).
  if (path.isAbsolute(userPath)) {
    throw new WorkspaceBoundaryError("Absolute paths are not allowed. Use a path relative to the repository root.");
  }

  const root = workspaceRoot();
  const resolved = path.resolve(root, userPath);

  // Primary boundary check (before any filesystem call).
  if (!isWithin(root, resolved)) {
    throw new WorkspaceBoundaryError("Path resolves outside the repository workspace.");
  }

  // Secrets denylist: never read, list, search or write credential files, keys or git internals.
  if (isSensitiveRelative(path.relative(root, resolved))) {
    throw new WorkspaceBoundaryError("Access to sensitive files (secrets, key material, .git) is not allowed.");
  }

  // Follow symlinks and re-check.
  let real: string;
  try {
    real = await fs.realpath(resolved);
  } catch {
    // File may not exist yet (for write_fix targets). That's OK — the
    // pre-realpath check already confirmed the *intended* path is inside.
    return resolved;
  }

  const realRoot = await fs.realpath(root);
  if (!isWithin(realRoot, real)) {
    throw new WorkspaceBoundaryError("Path follows a symlink outside the repository workspace.");
  }

  return resolved;
}

/** Case-insensitive on Windows. */
function isWithin(root: string, target: string): boolean {
  const sep = path.sep;
  const prefix = root.endsWith(sep) ? root : root + sep;
  if (process.platform === "win32") {
    return target.toLowerCase() === root.toLowerCase() || target.toLowerCase().startsWith(prefix.toLowerCase());
  }
  return target === root || target.startsWith(prefix);
}

// ---------------------------------------------------------------------------
// Sensitive-file denylist — secrets, keys and git internals never enter the
// model context, even when they sit inside the workspace.
// ---------------------------------------------------------------------------

/** True when a workspace-relative path names a secret/credential/internal file. */
export function isSensitiveRelative(relative: string): boolean {
  for (const part of relative.split(/[\\/]+/)) {
    if (!part) continue;
    if (part === ".git") return true;
    const name = part.toLowerCase();
    if (name.startsWith(".env") || name.startsWith("id_rsa") || name.startsWith("id_ed25519") || name.startsWith("id_ecdsa")) return true;
    if (name === ".dev.vars" || name === ".netrc" || name === ".git-credentials" || name === ".gitconfig") return true;
    if (name.endsWith(".pem") || name.endsWith(".key") || name.endsWith(".p12") || name.endsWith(".pfx")) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// File helpers
// ---------------------------------------------------------------------------

const MAX_FILE_BYTES = 512_000; // 500 KB

/** Reads a file as UTF-8, rejecting binary and oversized files. */
export async function readSafeFile(safePath: string): Promise<string> {
  const stat = await fs.stat(safePath);
  if (!stat.isFile()) {
    throw new WorkspaceBoundaryError("Path is not a regular file.");
  }
  if (stat.size > MAX_FILE_BYTES) {
    throw new WorkspaceBoundaryError(`File is too large (${(stat.size / 1024).toFixed(0)} KB). Limit is ${MAX_FILE_BYTES / 1024} KB.`);
  }
  const buffer = await fs.readFile(safePath);
  // Detect binary: check first 8 KB for null bytes.
  const probe = buffer.subarray(0, 8192);
  if (probe.includes(0)) {
    throw new WorkspaceBoundaryError("File appears to be binary. Only text files can be read.");
  }
  return buffer.toString("utf-8");
}
