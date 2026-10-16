# Files Read — Complete Summary

## Files Successfully Read

| # | File | Lines | Status |
|---|------|-------|--------|
| 1 | [prompt.md](./prompt.md) | 1112 | ✅ Read in full |
| 2 | [ASSIGNMENT.md](file:///d:/DarkCoders-OpenClaw-Assignment/DarkCoders-OpenClaw-Assignment/living-ai-talk/ASSIGNMENT.md) | 142 | ✅ Read in full |
| 3 | [AGENTS.md](file:///d:/DarkCoders-OpenClaw-Assignment/DarkCoders-OpenClaw-Assignment/living-ai-talk/AGENTS.md) | 24 | ✅ Read in full |
| 4 | [DarkCoders-OpenClaw-Assignment.pdf](file:///d:/DarkCoders-OpenClaw-Assignment/DarkCoders-OpenClaw-Assignment/living-ai-talk/DarkCoders-OpenClaw-Assignment.pdf) | 3 pages | ✅ Read via browser |

---

## 1. `prompt.md` — Master Prompt (1112 lines)

A comprehensive, 14-part engineering prompt that acts as a **senior-level investigation & implementation guide**. Key parts:

| Part | Title | Purpose |
|------|-------|---------|
| 1 | Official Assignment Context | Authoritative spec: agent purpose, voice, real tools, live visibility, human approval, existing 3D/WebXR console |
| 2 | Operating Rules | 10 rules: evidence-first, no fabrication, preserve working code, security-first, minimal complexity |
| 3 | Phase A: Repository Discovery | Inspect env, build repo map, trace app flow, OpenClaw integration, blueprint analysis |
| 4 | Phase B: Agent Concept Selection | Propose up to 3 ideas, evaluate on 12+ criteria, recommend one |
| 5 | Phase C: Gap Analysis | Requirement-by-requirement matrix with status, evidence, missing work |
| 6 | Phase D: Agent & Tool Architecture | Define agent, tools, skill structure, trust boundaries |
| 7 | Phase E: Approval & Safety Design | Risk classification, lifecycle, safeguards for 14+ threat vectors |
| 8 | Phase F: Voice, Screens, UX | Natural speech, choices, navigation, progress, error handling |
| 9 | Phase G: Implementation Roadmap | 12 stages (Stage 0–11) with exact deliverables per stage |
| 10 | Phase H: Testing Strategy | Functional, error, and safety test matrices |
| 11 | Phase I: Evaluation & Demonstration | Baseline / Strong / Exceptional criteria + 9-point demo script |
| 12 | Final Deliverables | App code, `openclaw/` folder, README with 17 required sections |
| 13 | Required Response Format | 15-section investigation report structure |
| 14 | Execution Instructions | Step-by-step first-pass instructions — **investigate only, do NOT implement** |

### Key Integration Points Required
- `src/routes/api/agent.ts` — bridge between console and agent
- `src/lib/settings/voice.ts` — agent registration (`AGENTS` config)
- `src/components/console-panels.tsx` — approval panel
- `src/config/unified-plan.yaml` — architectural blueprint (700+ requirements)
- `ASSIGNMENT.md` — full assignment spec

### Agent Response Contract
- **Plain replies** — text displayed as-is
- **Interactive screens** — `{ kind: "screen", screen: { text, choices (max 4), navigation }, app_commands }`
- **Action proposals** — `action_proposal: { id, title, tool, summary, risk }`

---

## 2. `ASSIGNMENT.md` — Official Assignment (142 lines)

The official assignment from Dark Coders titled **"Give our voice console something worth talking to."**

### What to Build
1. **An agent with a point of view** — solves a real problem, built on OpenClaw
2. **A voice** — natural voice in/out
3. **Real work, not just chat** — tools and skills that actually work
4. **A sense of caution** — risky actions require human approval

### What's Already Provided
- Working console (hold-to-talk, hands-free, live step-by-step, 3D WebXR room)
- Starting blueprint (`src/config/unified-plan.yaml`)
- Approval panel (already wired)
- Frontend works out of the box

### Plug-in Points
1. **Bridge**: `src/routes/api/agent.ts` → `OPENCLAW_GATEWAY_URL`
2. **Agent Registration**: `src/lib/settings/voice.ts` (`AGENTS`)
3. **Approval Panel**: `src/components/console-panels.tsx`

### Evaluation Levels
- **Baseline** — talks, answers, uses a tool or two
- **Strong** — handles messy cases, clean code, thoughtful engineering
- **Exceptional** — extensible, trustworthy, does things not asked for

### Deliverables
- Code (repo or zip)
- `openclaw/` folder with agents and skills
- Short README (what, decisions, AI usage)

### Running
```bash
npm install
cp .env.example .env       # set OPENCLAW_GATEWAY_URL and model keys
npm run typecheck && npm test
npm run dev
```

---

## 3. `AGENTS.md` — Project Agent Rules (24 lines)

Lovable-connected project rules:

- **Lovable sync**: Don't rewrite published git history (no force push, rebase, amend, squash of pushed commits)
- **Dark Coders branding**: Map palette/typography to CSS semantic tokens
- **Brand assets**: Serve via Lovable asset pointer, derive favicon
- **Model providers**: Per-browser settings (`src/lib/settings/store.ts`); local models from browser, cloud via `/api/llm`; optional HashiCorp Vault key lookup
- **Spatial chat**: Alternate presentation of voice console state (never forks conversation)
- **Live theming**: CSS custom properties on document root (`src/lib/settings/theme.ts`)
- **WebXR headset**: Lazily loaded overlay from console messages; Apple Vision Pro style (glass panels, calm void)
- **Spatial controls**: XR controller rays + hand ray/touch with hold-to-talk
- **Architecture YAML**: Parse as bounded data only; review progress separate from deployed capabilities
- **Architecture review**: Inside planning editor with own review state
- **Local ASR**: Route through separate HTTP adapter, sharing console capture/error state
- **Model allowlisting**: Only allowlisted models in `src/lib/ai/models.ts`; unknown picks error (never silently replaced)

---

## 4. `DarkCoders-OpenClaw-Assignment.pdf` — Visual Assignment Brief (3 pages)

A branded/designed version of the assignment with the same content as `ASSIGNMENT.md`:

| Section | Content |
|---------|---------|
| 01 // THE IDEA | Skip boilerplate, build the agents behind the voice console |
| 02 // WHAT YOU'LL BUILD | Agent with purpose, voice, real tools, human approval for risky actions |
| 03 // WHAT WE'RE HANDING YOU | Console, blueprint, approval panel, working frontend |
| 04 // WHAT WE'D LOVE TO SEE | Voice I/O, live thinking, real actions, knows its limits |
| 05 // WHAT YOU'RE WORKING WITH | Console architecture overview (visual diagram) |
| 06 // WHERE TO PLUG IN | Bridge (`api/agent.ts`), agent list, approval panel |
| 07 // TIME | Weekend, half-day core |
| 08 // GROUND RULES | Use AI tools, rough is fine, no fake results |
| 09 // HOW WE'LL READ IT | Baseline → Strong → Exceptional |

> [!NOTE]
> The PDF is essentially the **visual/branded version** of `ASSIGNMENT.md`. No additional requirements were found beyond what's in the markdown file. The PDF adds a visual console architecture diagram (section 05) not present in the text version.

---

## Key Takeaway

The PDF and `ASSIGNMENT.md` are consistent — no conflicting requirements. The `prompt.md` is a **much more detailed engineering guide** that expands on the assignment into a full investigation-first, plan-then-implement methodology. The `AGENTS.md` defines project-level coding rules for the Lovable-connected repo.
