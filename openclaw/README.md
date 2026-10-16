# OpenClaw Integration — CISO · Code Security Reviewer

This folder is the runnable OpenClaw deliverable for the voice console. It follows
**OpenClaw's real formats**: skills are `SKILL.md` folders and agents live in
`~/.openclaw/openclaw.json` (not in per-agent YAML files).

## Files

```
openclaw/
├── skills/
│   └── code-security-review/
│       └── SKILL.md            # Real OpenClaw skill (frontmatter + instructions)
├── openclaw.example.json5      # Merge into ~/.openclaw/openclaw.json
└── README.md                   # This file
```

## Compute model: hybrid

The CISO agent's **thinking runs through the OpenClaw Gateway** (OpenAI-compatible
`/v1/chat/completions`, conversations targeted at the `openclaw/ciso` agent). The
**workspace tools execute server-side inside `living-ai-talk`** — this keeps the
tested approval enforcement in the app and works with any gateway model, including
a free local Ollama model. Gateway-native tools are kept read-only in the example
config as defense in depth.

## Setup (OpenClaw Companion, free local path)

1. In OpenClaw Companion, finish onboarding with a **local Ollama** model
   (install Ollama, then `ollama pull qwen3:4b`, choose *Ollama → Local Only*,
   base URL `http://127.0.0.1:11434`).
2. Point the gateway at this repo and allow its HTTP surface: apply the
   `gateway.http.endpoints` block from `openclaw.example.json5` to
   `~/.openclaw/openclaw.json` (Companion → config, or the Control UI Config tab),
   then validate with `openclaw doctor`.
3. Register the CISO agent: apply the `agents.entries.ciso` block (replace `<repo>`
   with this repository's absolute path — it must also match your OS user, since
   the task runs as that user).
4. Copy the gateway **token** (Companion settings or `gateway.auth.token`) into
   `living-ai-talk/.env` as `OPENCLAW_API_KEY`, keeping
   `OPENCLAW_GATEWAY_URL="http://127.0.0.1:18789"`.
5. Start the app: `npm run dev`, select **CISO** in Settings → Voice & Agents, and
   ask for a review. The console targets `openclaw/ciso`, falls back to
   `openclaw/default` when no dedicated agent exists, and keeps one gateway
   session per conversation via a stable `user: conv:<id>` value.

## Agent: CISO · Code Security Reviewer

The CISO agent reviews repository source code for security vulnerabilities and
proposes fixes through the console.

### Tools (executed server-side by the console)

| Tool | Type | Description |
|------|------|-------------|
| `read_file` | Read-only | Reads a text file within the workspace |
| `list_files` | Read-only | Lists directory contents |
| `search_code` | Read-only | Searches for text patterns in source files |
| `write_fix` | Write (approval required) | Proposes a code fix — requires human approval |

### Security Properties

- **Workspace boundary:** all file operations are confined to the repository root.
- **Path traversal protection:** `..`, absolute paths, null bytes, and symlink escapes are rejected.
- **Secrets denylist:** `.env*`, `*.key`/`*.pem`, SSH keys, `.git/` internals can be neither read nor written.
- **Binary detection:** files with null bytes in the first 8KB are refused.
- **Size limits:** files larger than 500KB cannot be read.
- **No shell execution:** tools use only `fs` APIs, never `child_process`.
- **Approval enforcement:** write operations require server-side human approval with UUID-based proposal tracking.

### Human Approval Workflow

1. The CISO agent proposes a `write_fix` via `tool_request`; the console intercepts it.
2. The server creates an `ActionRecord` with a `crypto.randomUUID()` identifier.
3. The console displays the proposal in the Approval panel with Approve/Deny buttons.
4. Clicking Approve/Deny sends `POST /api/agent/approve` with `{ proposalId, approved }`.
5. The server verifies the proposal exists, is pending, and hasn't expired (5-minute TTL).
6. If approved, the server executes the write using the **stored** arguments (not client-provided).
7. If denied, expired, or already consumed, execution is refused.

## Honest status

- Tool execution + approval enforcement: implemented, covered by 39 passing tests.
- Gateway code path (agent targeting headers, `/v1/chat/completions`, session keys):
  implemented against the published OpenClaw Gateway HTTP API.
- Live end-to-end gateway run: depends on your local Companion gateway being up
  while testing — see the root `README.md` for the current verification status.
