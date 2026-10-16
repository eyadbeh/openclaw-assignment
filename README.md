# OpenClaw Voice & Spatial Console (`living-ai-talk`)

A DarkCoders voice, chat, and 3D WebXR console designed for multi-agent orchestration on **OpenClaw**, featuring a **Code Security Reviewer (CISO)** agent with real workspace tools and server-enforced human approval.

> **Candidates:** Read **[`ASSIGNMENT.md`](./ASSIGNMENT.md)** for full assignment instructions, architecture integration points, and deliverables.

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env
```

Connect the OpenClaw gateway (free, fully local):

1. In **OpenClaw Companion**, finish onboarding with a local Ollama model
   (`ollama pull qwen3:4b`, Provider = Ollama, Mode = Local Only,
   base URL `http://127.0.0.1:11434`).
2. Enable the Gateway's HTTP surface using `openclaw/openclaw.example.json5`
   (only the `gateway.http.endpoints` block in needed; validate with `openclaw doctor`).
3. Paste the gateway token into `.env`:
   `OPENCLAW_API_KEY="<token from Companion>"` (keep
   `OPENCLAW_GATEWAY_URL="http://127.0.0.1:18789"`).
4. Register the CISO agent with the `agents.entries.ciso` block (optional — without
   it the console still works through the gateway's default agent).

```bash
# Verify types, tests, and production build
npm run typecheck   # 0 errors
npm test            # 39/39 pass
npm run build       # production bundle

# Start development server
npm run dev         # http://localhost:8080
```

## Agent: CISO · Code Security Reviewer

The CISO agent reviews source code for security vulnerabilities using real workspace tools.

### Tools

| Tool | Type | Description |
|------|------|-------------|
| `read_file` | Read-only | Reads a text file within the workspace |
| `list_files` | Read-only | Lists directory contents |
| `search_code` | Read-only | Searches for text patterns in source files |
| `write_fix` | Write (approval required) | Proposes a code fix — requires human approval |

### How It Works

1. Select the **CISO** agent from the voice console or Settings → Voice & Agents.
2. Ask the agent to review code (e.g., "Review the API routes for security issues").
3. The agent uses `read_file`, `list_files`, and `search_code` to examine the codebase.
4. For any fix, the agent proposes a `write_fix` with a detailed description.
5. The proposal appears in the **Approval panel** with Approve / Deny buttons.
6. Approving sends a verified request to `POST /api/agent/approve` — the server executes the write using stored arguments. Denying, forging, or replaying the request is rejected.

## Security Architecture

### Workspace Boundary

- All file operations are confined to the repository root directory.
- Path traversal (`..`), absolute paths, null bytes, and symlink escapes are rejected.
- Binary files (null bytes in first 8KB) cannot be read.
- Files larger than 500KB are refused.
- No shell execution — tools use only `fs` APIs.

### Server-Side Approval Enforcement

- Proposals have server-generated `crypto.randomUUID()` identifiers.
- The server stores the exact operation and arguments in an in-memory `ActionRecord` store.
- Approval is submitted through `POST /api/agent/approve` with `{ proposalId, approved }`.
- The approved operation executes using **stored** arguments — the client cannot substitute different arguments.
- Denied, expired (5-minute TTL), unknown, or already-consumed proposals cannot execute.
- Duplicate submissions cannot execute the operation twice.
- The server reports the real `fs.writeFile` result (success or error).

### Trust Model

| Layer | Responsibility |
|-------|---------------|
| Client (browser) | Displays proposals, sends proposalId + boolean |
| Server (agent route) | Stores proposals, verifies IDs, executes with stored args |
| Workspace module | Resolves paths, enforces boundary, detects binary |
| Tool dispatcher | Routes to correct tool, rejects unknown tools |

## OpenClaw Integration Status

| Component | Status |
|-----------|--------|
| Real OpenClaw skill (`openclaw/skills/code-security-review/SKILL.md`) | ✅ Correct `SKILL.md` format, loadable via `skills.load.extraDirs` |
| Real gateway config example (`openclaw/openclaw.example.json5`) | ✅ chatCompletions endpoint + ciso agent with read-only gateway tools |
| Agent targeting (`x-openclaw-agent-id`, `openclaw/ciso` model target) | ✅ Implemented in `/api/agent` |
| Session continuity (`user: conv:<id>` per console thread) | ✅ Implemented in `/api/agent` |
| Gateway transport (`/v1/chat/completions` streaming + non-streaming) | ✅ Implemented, SSE adapter re-emits to the console |
| Secrets denylist (`.env*`, `*.key`, `.git/`) in the workspace sandbox | ✅ Implemented and tested |
| Tool execution (server-side) | ✅ Implemented and tested |
| Human approval enforcement | ✅ Server-side, tested |
| Live end-to-end run against a real gateway | ⚠️ Requires your local Companion gateway to be up while testing |
| Voice interaction (speak, listen, screens) | ✅ Pre-existing, preserved |
| 3D WebXR spatial view | ✅ Pre-existing, preserved |

> **Honest disclaimer:** tool execution is handled server-side within the
> application (hybrid model — OpenClaw provides the agent/model, the console
> executes the workspace tools so approval enforcement stays in tested code).
> The `openclaw/` folder follows OpenClaw's real formats (`SKILL.md`, config
> example). Live behavior depends on your local gateway: browser chat shows the
> real error when the gateway is unreachable — see Settings → Models for
> fallback providers (Ollama, LM Studio, cloud).

## Key Scripts

- `npm run dev` — Start the Vite + TanStack Start dev server
- `npm run build` — Build client, SSR, and Nitro server bundles
- `npm run typecheck` — Run TypeScript compiler checks (`tsc --noEmit`)
- `npm test` — Run the full test suite (39 tests across 6 suites)
- `npm run lint` — Run ESLint

## Test Suite

| Suite | Tests | Coverage |
|-------|-------|----------|
| Approval store | 10 | Create, approve, deny, forge, duplicate, expire, consume |
| Tool dispatch | 16 | read_file, list_files, search_code, write_fix, traversal, binary, secrets denylist |
| Gateway models | 5 | Allowlist, agent targets, unknown rejection |
| Architecture YAML | 3 | Specification parsing, review separation |
| Local ASR | 3 | Host validation, credential rejection |
| Spatial conversation | 3 | Pagination, action proposals, XR parsing |

## Architecture Reference

- **`ASSIGNMENT.md`** — Candidate challenge brief, requirements, and grading rubric
- **`src/config/unified-plan.yaml`** — `VoiceChatOpenClawArchitecture` specification
- **`src/routes/index.tsx`** — Main voice/chat/spatial console and run lifecycle
- **`src/routes/api/agent.ts`** — Agent route with tool dispatch loop and model interaction
- **`src/routes/api/agent.approve.ts`** — Server-side approval endpoint
- **`src/lib/agent/workspace.server.ts`** — Workspace boundary enforcement
- **`src/lib/agent/tools.server.ts`** — Tool implementations (read_file, list_files, search_code, write_fix)
- **`src/lib/agent/approval.server.ts`** — In-memory action record store
- **`src/lib/settings/voice.ts`** — Agent roster (`AGENTS`) and voice/ASR settings
- **`src/lib/voice/screen.ts`** — Screen, voice command, tool request, and action proposal parser
- **`src/lib/voice/prompt.ts`** — System prompt and JSON output schema with tool_request
- **`openclaw/`** — Real OpenClaw deliverable: SKILL.md skill, gateway config example
- **`docs/`** — Investigation reports and the engineer handoff guide

## Demo Script

1. Start the dev server: `npm run dev`
2. Open `http://localhost:8080` in a browser.
3. Open Settings (gear icon) → Voice & Agents → select **CISO · Code Security Reviewer**.
4. Close settings and type or speak: _"List the files in the src/routes/api directory."_
5. The agent uses `list_files` and responds with the real directory contents.
6. Type: _"Read the agent.ts file and check for security issues."_
7. The agent uses `read_file` to read the actual file and reports findings.
8. Type: _"Search the codebase for hardcoded secrets."_
9. The agent uses `search_code` and reports any matches.
10. If the agent proposes a fix via `write_fix`, the **Approval panel** (Run tab) shows the proposal.
11. Click **Approve** to execute the write, or **Deny** to refuse. The server enforces the decision.
12. The outcome (success, error, or denial) is reported back in the conversation.

> **Note:** Steps 4–12 require the OpenClaw gateway to be reachable (Companion running + token in `.env`). Without a model, the tools and approval system are verified by the test suite (`npm test`).

## Where AI helped

This project was built with AI coding assistants (AI tools are explicitly
encouraged by the assignment — this section is the record of how they were used):

- **Investigation & planning** — an AI assistant read the full repository and
  produced the evidence-based gap analysis in `docs/investigation_report.md`,
  `docs/final_verification_report.md`, and `docs/HANDOFF.md` (verified facts
  versus assumptions, with file references).
- **Implementation** — the CISO agent scaffold (workspace sandbox, four tools,
  server-side approval store, `/api/agent` tool loop, approval endpoint, and 39
  tests), plus the OpenClaw gateway wiring (agent targeting, session keys,
  secrets denylist) were written with AI assistance and human review.
- **Documentation** — first drafts of the README and `openclaw/` docs, edited by
  the human author.
- **Human decisions** — the agent concept (Code Security Reviewer), the hybrid
  compute model (OpenClaw for reasoning, console for tool execution + approval),
  every architectural approval gate, and all final reviews were human decisions.
- **Boundaries kept** — no fabricated results anywhere: unit tests run against
  the real filesystem, the approval panel executes real writes only after a real
  decision, and honest errors surface in the UI.
