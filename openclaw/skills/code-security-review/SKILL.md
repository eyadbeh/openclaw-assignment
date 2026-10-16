---
name: code-security-review
description: Review repository code for security vulnerabilities (hardcoded secrets, injection, XSS, insecure deserialization) and propose fixes that require human approval.
---

# Code Security Review

Use this skill when the operator asks for a security review, a vulnerability scan,
or a fix for a suspicious code section in the `living-ai-talk` workspace.

## How the tools work

The review runs through the voice console's workspace tools (executed server-side
by `living-ai-talk`, never through a shell):

| Tool | Arguments | Effect |
|------|-----------|--------|
| `read_file` | `path` | Reads a text file inside the workspace (binary and >500 KB files are refused) |
| `list_files` | `path` | Lists a directory inside the workspace (max 200 entries) |
| `search_code` | `pattern`, `path` | Literal text search across workspace files (max 50 matches) |
| `write_fix` | `path`, `content`, `description` | **Does not write directly.** Produces an `action_proposal`; the operator must approve it in the console's Approval panel |

Security boundaries you must respect:

- File operations stay inside the repository workspace (traversal, absolute paths
  and symlink escapes are rejected).
- Secret files (`.env*`, `*.key/*.pem`, SSH keys, `.git/`) are blocked at the
  server layer. Never ask for their contents; report that secrets belong to the
  operator only.
- Every state-changing action waits for a human decision. Never claim a fix was
  applied before the Approval panel confirms execution.

## Review workflow

1. Scope the review with `list_files` (start at `src/`; skip generated directories).
2. Read the relevant files with `read_file`.
3. Search for these vulnerability patterns with `search_code`:
   - Hardcoded secrets: `password`, `secret`, `api_key`, `apiKey`, `private_key`, `token`
   - SQL injection: dynamic query construction (`execute(`, `raw(`, `query(`)
   - Path traversal: unsanitized `../`, `path.join`, `path.resolve`
   - XSS: `innerHTML`, `dangerouslySetInnerHTML`, `document.write`
   - Insecure deserialization: `eval(`, `Function(`, unvalidated `JSON.parse` of untrusted input
   - Missing input validation: unchecked `request.body` access, `as any` escapes
4. Report findings ranked by severity (high → low), each with file, line and evidence.
5. For the highest-severity issue, prepare one concrete fix and propose it via
   `write_fix` — one proposal per turn, then stop and wait for the operator.
6. Read-only questions can be answered immediately; never fabricate results you
   have not observed in the tool output.
