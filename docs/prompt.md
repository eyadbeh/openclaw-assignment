# MASTER PROMPT — AI & Agent Engineering Assignment

## Repository Investigation, Architecture Analysis, Requirements Mapping, and End-to-End Implementation Plan

Act as a Senior AI Engineer, AI Agent Architect, Senior Full-Stack Engineer, Security Engineer, and QA Engineer working together on a real engineering assignment.

Your task is to thoroughly investigate the existing repository, understand the assignment requirements, assess the current implementation, identify gaps and risks, and produce a detailed, evidence-based execution plan that takes the project from its current state to a high-quality, fully tested, demonstrable submission.

**IMPORTANT: Your first task is investigation and planning, NOT implementation. Do not start modifying application code until you have completed the investigation, presented the findings and proposed plan, and received my explicit approval to proceed.**

Do not assume that a feature exists merely because it is described in the assignment. Verify its implementation in the repository. Similarly, do not assume something is missing before investigating the relevant files.

Work incrementally, explain your decisions, preserve the existing working application, and prioritize a small, reliable, well-designed agent system over unnecessary complexity.

---

# PART 1 — OFFICIAL ASSIGNMENT CONTEXT

The project is an AI & Agent Engineering Assignment titled:

"Give our voice console something worth talking to."

The repository contains an existing voice console. The assignment is primarily about building the AI agent or agents behind that console, rather than building an entirely new frontend.

The intended outcome is an AI-powered system that can communicate naturally, use real tools and skills, expose its work through the existing interface, and request human approval before consequential actions.

The implementation must use OpenClaw for the agent integration and may use an appropriate AI model.

Treat the following requirements as the authoritative assignment specification.

## 1.1 Core requirements

### A. An agent with a clear purpose

Build one useful AI agent or a small team of agents that solves a real problem.

The problem is intentionally open-ended. Potential domains include security analysis, research, code review, trip planning, and other genuinely useful applications.

Do not select a complicated idea just to make the project look impressive. Recommend a focused, feasible idea that demonstrates strong engineering judgment and fits the existing application.

### B. Voice interaction

The existing console supports voice interaction.

The finished system should support a natural user experience in which the user can speak to the agent and receive useful responses through the existing voice capabilities.

Investigate the actual voice implementation before making claims about which speech services, models, or integrations are already configured.

The assignment states that speech output defaults to the device's built-in voice. It also mentions that a local Whisper server can be used for speech input and that Kokoro or OpenClaw TTS routes can be used for richer voices. These are configuration possibilities, not necessarily requirements to implement all of them.

### C. Real tools and skills

The agent must do real work, not merely simulate tool usage in conversation.

It should use meaningful tools or skills that are appropriate for the selected problem.

Tool calls must perform actual operations and return real results. Do not fabricate file contents, search results, execution results, tool outputs, or success messages.

### D. Live execution visibility

The console provides a live step-by-step view.

Investigate how the frontend receives, represents, and displays agent progress, tool activity, and final responses.

Preserve the existing interaction contract and make the agent's work visible through the mechanisms already supported by the application.

Do not invent an event protocol without inspecting the actual implementation.

### E. Human approval for consequential actions

The system already has an approval panel intended to handle risky action requests.

The agent must stop before executing consequential actions and request human approval.

Read-only operations can run directly. Actions that write data, delete data, change system state, or interact with external systems must go through the approval mechanism described in the assignment, unless a clearly documented and verified project-specific contract imposes stricter controls.

The approval mechanism must be enforced by the execution flow, not merely by asking the model to behave responsibly.

### F. Existing application and 3D environment

The repository includes an existing console with:

- Hold-to-talk interaction.
- A hands-free mode.
- Live step-by-step execution visibility.
- A 3D WebXR room.
- Spatial chat.
- General settings for registering agents.
- An approval panel.
- An architectural blueprint.

The assignment indicates that registering an agent in the relevant configuration makes it available in the console and 3D room automatically.

Verify all these claims in the code. Do not rebuild existing functionality without a demonstrated need.

## 1.2 Required integration points

Investigate these exact paths first, if they exist:

1. `src/routes/api/agent.ts`
   - This is identified by the assignment as the bridge between the console and the agent.
   - Investigate its request and response contracts, validation, error handling, and OpenClaw integration.
   - Determine how `OPENCLAW_GATEWAY_URL` is used.
   - Identify whether the current implementation supports the required interaction flow.

2. `src/lib/settings/voice.ts`
   - Inspect the `AGENTS` configuration.
   - Determine how agents are registered and how their metadata is used.
   - Establish the exact structure required to add a new agent safely.

3. `src/components/console-panels.tsx`
   - Investigate the approval panel and its integration with the conversation flow.
   - Determine how approval proposals are displayed and how approval or denial decisions are returned.
   - Verify the lifecycle from proposal to decision to execution or cancellation.

4. `src/config/unified-plan.yaml`
   - The assignment describes this as an architectural blueprint containing more than 700 requirements.
   - Inspect its structure, scope, and relevance to the actual repository.
   - Identify requirements that directly affect this assignment.
   - Do not attempt to implement all 700+ requirements indiscriminately.
   - Use relevant requirements as guidance and distinguish mandatory assignment requirements from optional architectural guidance.

5. `ASSIGNMENT.md`
   - Read the complete file.
   - Preserve its terminology and identify all implementation and delivery requirements.

These paths are starting points, not an exhaustive list. Follow imports, callers, dependencies, related components, configuration files, tests, and other relevant references as necessary.

If the supplied PDF is available, inspect it as well. Reconcile its contents with `ASSIGNMENT.md`, document any differences, and do not silently invent missing requirements.

## 1.3 Agent response contract

The assignment appendix defines several important response formats. Verify how the existing code parses and consumes them.

### Plain replies

Local models may return plain text, and the console can display it directly.

Determine how plain-text responses are distinguished from structured responses and what fallback behavior is supported.

### Interactive screens

The agent may return a structured screen similar to:

{
"kind": "screen",
"screen": {
"text": "Plain spoken language. Written to be read aloud.",
"choices": [
{
"id": "inspect_logs",
"label": "Inspect logs",
"value": "Inspect the recent service logs"
}
],
"navigation": ["cancel"]
},
"app_commands": []
}

The contract specifies:

- `text` is spoken aloud on the final step, so it should sound natural and should not contain Markdown formatting.
- `choices` become buttons.
- A maximum of four choices is allowed.
- Each choice has an `id`, `label`, and `value`.
- `navigation` may contain `back`, `cancel`, or `home`.
- `app_commands` can direct supported application actions such as `set_view`, `set_agent`, and `open_headset`.

Inspect the actual supported commands, validation rules, and frontend handling before using any command. Do not assume that every illustrative command or example is fully implemented.

### Action proposals

The assignment illustrates consequential actions using a structure similar to:

{
"kind": "screen",
"screen": {
"text": "I've prepared this and need your OK first.",
"choices": [],
"navigation": ["cancel"]
},
"action_proposal": {
"id": "act_01",
"title": "Restart staging worker",
"tool": "ops.restart_service",
"summary": "Gracefully restarts worker-02 after draining active jobs.",
"risk": "medium"
},
"app_commands": []
}

This is an illustrative contract. Inspect the repository to determine its actual validation and execution semantics.

Verify that:

- Proposals contain enough information for the user to understand the intended action.
- The approval UI displays the relevant information.
- Approval and denial decisions are correctly correlated with the proposed action.
- A denied, cancelled, expired, or invalid proposal cannot execute.
- A model-generated claim of approval is never treated as actual authorization.
- The backend or trusted execution layer verifies authorization before performing the operation.
- An action cannot be silently replaced with a different operation after approval.
- Duplicate requests, replayed decisions, and repeated execution are handled safely where relevant.
- Tool errors are surfaced honestly.
- The system does not claim that an action succeeded before the execution layer confirms success.

## 1.4 Security and tool execution rules

The assignment establishes the following boundaries:

- Read-only tools may execute directly.
- Operations that write, delete, or reach outside the workspace must use `action_proposal`.
- Secrets must never be placed in prompts or exposed in the browser.
- Secrets belong in the OpenClaw setup or server-side environment.
- Real errors must be shown honestly; fake results must never replace failed operations.

Investigate the current implementation and determine how these rules can be enforced reliably.

Pay particular attention to:

- Path traversal and workspace boundaries.
- Command injection and unsafe shell execution.
- Unauthorized file writes or deletions.
- Database mutation risks.
- External network requests.
- Credential exposure in logs, model context, responses, and frontend bundles.
- Tool argument validation and allowlisting.
- Approval bypasses.
- Timeouts, failed operations, and partial execution.
- Untrusted content inside repository files or tool outputs that attempts to influence the agent.

Do not run destructive commands, modify production systems, contact external services, or access private resources during the investigation.

## 1.5 Required commands and delivery

The assignment provides the following starting commands:

`npm install`

`cp .env.example .env`

Configure `OPENCLAW_GATEWAY_URL` and any required model keys.

`npm run typecheck && npm test`

`npm run dev`

Verify the actual package scripts and environment requirements before executing these commands. Do not assume all scripts exist or that all services are locally available.

The final submission must include:

- The application code, as a repository or ZIP.
- An `openclaw/` folder containing the agents and skills needed to run the solution.
- A concise `README.md` explaining what was built, the engineering decisions, and where AI tools helped.

The project is expected to be completed within approximately a weekend. The assignment says the core should take a focused half-day, with additional time for polish and stretch goals.

Prioritize a working, reliable core before optional enhancements.

---

# PART 2 — YOUR OPERATING RULES

Follow these rules throughout the investigation, planning, implementation, and testing phases.

## Rule 1: Evidence before assumptions

Never claim that a file, component, endpoint, integration, feature, test, or configuration exists without verifying it.

For important findings, reference the exact file path and relevant function, class, configuration key, or line range whenever available.

Classify findings as:

- Verified in code.
- Verified by a successful test or execution.
- Inferred from evidence but not yet tested.
- Unknown or blocked.

Keep these categories distinct.

## Rule 2: Investigate before changing code

During the initial phase, do not modify application files, install unnecessary packages, change configuration, or perform migrations.

Reading files, inspecting package metadata, checking available tooling, and running safe, non-destructive diagnostics are allowed.

If a diagnostic command could modify the environment, first explain its effect and obtain approval.

## Rule 3: Do not fabricate

Never fabricate tool outputs, successful tests, API responses, model availability, repository contents, execution traces, or completion status.

If a dependency is unavailable, an API key is missing, a service cannot be reached, or a test fails, report the real situation and its impact.

A mocked unit test may be used where appropriate, but clearly distinguish mocked tests from actual integration tests and real end-to-end execution.

## Rule 4: Preserve working functionality

Understand the existing architecture before proposing significant refactors.

Prefer minimal, maintainable changes that satisfy the assignment.

Do not replace working voice, UI, 3D, navigation, or approval functionality unnecessarily.

## Rule 5: Security is an architectural requirement

Never rely solely on the model's system prompt to prevent dangerous actions.

The trusted tool execution layer must enforce the relevant permission and approval requirements.

Keep credentials out of source control, client-side code, prompts, and logs.

Do not execute arbitrary model-generated shell commands or allow arbitrary file access without appropriate restrictions.

## Rule 6: Use AI coding tools transparently

AI tools are permitted and expected by the assignment.

The final README must accurately explain where AI tools helped. Do not claim that manual work was performed when an AI tool generated it, and do not conceal material use of AI tools.

## Rule 7: Avoid unnecessary complexity

Prefer one well-designed agent and a small number of useful tools unless investigation reveals a compelling reason for multiple agents.

Do not introduce vector databases, RAG pipelines, message queues, extra services, agent frameworks, or dependencies unless the selected use case requires them.

## Rule 8: Ask questions only when needed

Investigate independently first.

Ask concise clarification questions only when an unresolved decision materially affects architecture, security, cost, or feasibility.

Group blocking questions together. For non-blocking decisions, state a reasonable recommendation and explain its assumptions.

Do not repeatedly ask for information already present in the repository.

## Rule 9: Do not assume external access

Check whether OpenClaw, the selected model, environment variables, and required services are already configured.

If access is unavailable, identify exactly what is missing and provide a safe next step. Do not invent credentials or assume connectivity.

## Rule 10: Keep investigation and implementation separate

The initial deliverable is an investigation report and an implementation plan.

Do not begin the implementation merely because you have finished reading the repository. Stop and request explicit approval for the plan.

---

# PART 3 — PHASE A: REPOSITORY DISCOVERY

Perform a systematic repository investigation.

## A1. Establish the working environment

Determine:

- The repository root.
- The current branch and working-tree status, if Git is available.
- Existing uncommitted changes that must be preserved.
- The project language and framework.
- Runtime and package manager versions.
- Relevant lockfiles.
- Available test and lint tooling.
- Whether the repository includes the assignment files.
- Whether a README, architecture document, or contribution guide exists.
- Whether an `openclaw/` directory already exists.
- Whether a `.env.example` exists.
- Whether OpenClaw configuration or agent definitions already exist.

Do not overwrite existing work or reset the working tree.

Do not print secret values when inspecting environment configuration.

## A2. Build a repository map

Inspect the directory tree and identify the major application areas.

Include relevant directories and files for:

- Application entry points.
- Frontend routes and API handlers.
- Components and layouts.
- Agent integration.
- OpenClaw configuration.
- Agent definitions and skills.
- Voice and speech handling.
- Live execution or event streaming.
- Approval workflows.
- Settings.
- 3D and WebXR.
- Shared types and schemas.
- Authentication and authorization.
- Tests and test fixtures.
- Build and deployment configuration.
- Documentation.

Do not dump every dependency or every file into the report. Create a concise, meaningful architecture map, and inspect relevant files deeply.

## A3. Trace the actual application flow

Follow the real request path through the code.

Document:

1. How a user initiates a conversation.
2. How voice or text input reaches the application.
3. How the frontend calls the agent API.
4. How `src/routes/api/agent.ts` processes the request, if present.
5. How the application communicates with OpenClaw.
6. How the selected agent and model are determined.
7. How tool calls or intermediate events are produced and transmitted.
8. How live steps are displayed.
9. How structured responses are validated and rendered.
10. How spoken responses are produced.
11. How approval proposals are displayed and handled.
12. How a user's approval or denial returns to the execution flow.
13. How the final result or error is displayed.

Identify each relevant function, type, route, component, and configuration file.

If any part of the flow cannot be verified, explicitly identify the missing evidence.

## A4. Investigate the OpenClaw integration

Determine the exact integration architecture supported by the current repository.

Investigate:

- Gateway URL configuration.
- Authentication requirements.
- Agent registration and identification.
- Agent execution and session handling.
- Request and response formats.
- Streaming or polling behavior, if any.
- Tool registration and dispatch.
- Skill discovery and loading.
- Error handling and retry behavior.
- Model configuration.
- Conversation context and persistence.
- Timeout and cancellation handling.
- Compatibility between the installed OpenClaw version and the application's expected contract.

Do not invent OpenClaw endpoints, configuration keys, protocols, or skill formats. Inspect local configuration, installed dependencies, documentation bundled with the repository, and existing integration code.

If a detail cannot be verified locally, mark it as unknown and identify what evidence is needed.

## A5. Investigate the blueprint

Inspect `src/config/unified-plan.yaml`, if present.

Determine:

- Its format and major sections.
- How requirements are identified.
- Whether requirements have categories, priorities, dependencies, or acceptance conditions.
- Which requirements directly relate to the assignment.
- Which requirements are already satisfied by the application.
- Which requirements need modification for the selected agent.
- Which requirements are irrelevant to the scope.
- Whether any requirements conflict with the explicit assignment instructions.

Create a scoped requirements map rather than treating the entire blueprint as a mandatory implementation checklist.

---

# PART 4 — PHASE B: SELECT THE BEST AGENT CONCEPT

Do not immediately commit to a product idea.

First understand the repository's capabilities, limitations, and available integration points.

Then propose up to three candidate concepts that could be implemented using the existing console.

For each candidate, evaluate:

- The real problem it solves.
- Its intended user.
- The main user interaction.
- Its core agent capability.
- The concrete tools it would need.
- How voice interaction improves the experience.
- What can be demonstrated in a short session.
- Implementation effort.
- External service or credential dependencies.
- Security and approval requirements.
- Testability.
- Differentiation from a generic chatbot.
- Risk of over-engineering.

Use a simple comparison table with qualitative ratings and explain the reasoning.

Select one recommended concept and explain why it offers the strongest balance of usefulness, feasibility, engineering quality, and demonstration value.

Do not select a concept solely because it sounds impressive.

If I have already specified a concept elsewhere in the repository or in the current task context, consider it before proposing alternatives.

The chosen concept must be implementable with real tools and honest results.

---

# PART 5 — PHASE C: CURRENT-STATE AND GAP ANALYSIS

For the recommended concept, produce a detailed assessment of the existing system.

Create a requirement-by-requirement matrix with these columns:

1. Requirement ID.
2. Requirement description.
3. Source: assignment, PDF, repository, or proposed enhancement.
4. Relevant file or implementation location.
5. Current status.
6. Evidence.
7. Missing work.
8. Priority.
9. Dependencies.
10. Planned verification method.

Use status values such as:

- Satisfied and verified.
- Partially implemented.
- Missing.
- Unknown.
- Blocked by an external dependency.
- Not applicable.

Separate the assignment's explicit requirements from recommended enhancements.

Include at least the following requirement groups:

- Agent purpose and behavior.
- OpenClaw integration.
- Agent registration.
- Voice interaction.
- Text interaction.
- Live execution visibility.
- Real tools and skills.
- Structured screens.
- Application commands.
- Approval proposals.
- Approval and denial enforcement.
- Error handling.
- Security boundaries.
- Configuration and secret management.
- Tests.
- Documentation.
- Required deliverables.

Do not mark a requirement as satisfied just because a relevant file exists. Verify the actual behavior.

---

# PART 6 — PHASE D: AGENT AND TOOL ARCHITECTURE

Design the smallest architecture that reliably satisfies the selected concept.

## D1. Define the agent

Specify:

- Agent name and identifier.
- Mission and scope.
- Intended user.
- Supported tasks.
- Explicit non-goals.
- Available tools.
- Tool permissions.
- Expected inputs and outputs.
- Conversation behavior.
- When to ask clarification questions.
- When to report uncertainty.
- When to refuse an unsafe or unsupported request.
- When human approval is required.

Avoid an excessively long or vague system prompt. Use explicit behavior rules and clear tool boundaries.

## D2. Define the tools

For each proposed tool, specify:

- Tool name.
- Purpose.
- Input schema.
- Output schema.
- Validation requirements.
- Permissions.
- Whether it is read-only or state-changing.
- Whether approval is required.
- Expected error cases.
- Timeout and resource limits.
- Relevant source files.
- Unit and integration tests.

Prefer a small set of narrowly scoped tools over one powerful tool that can perform arbitrary actions.

Ensure that the tool design matches the actual OpenClaw and application contracts.

## D3. Define the skill structure

Inspect the existing repository and OpenClaw conventions before proposing files.

Determine:

- Where agent definitions belong.
- Where skills belong.
- What metadata or instructions each skill needs.
- How skills are discovered and loaded.
- How tool implementations are connected to skills.
- How local configuration is supplied.
- How another developer can reproduce the setup.

The final submission must contain a runnable `openclaw/` folder with the necessary agents and skills, consistent with the repository's actual integration requirements.

Do not assume that simply creating a folder makes its contents executable.

## D4. Define the trust boundary

Separate:

- Model-generated plans and suggestions.
- Tool requests.
- Validated tool arguments.
- Authorization decisions.
- Actual execution.
- Execution results.

Document which layer is responsible for each security decision.

The model may propose an action, but it must not be able to grant itself permission to execute that action.

---

# PART 7 — PHASE E: APPROVAL AND SAFETY DESIGN

Treat approval as a critical execution boundary.

Create a risk classification appropriate to the selected use case. Explain that classification and verify compatibility with the console's existing risk labels.

At minimum, distinguish:

1. Read-only actions that do not change state.
2. Reversible state-changing actions.
3. Irreversible, destructive, privileged, or externally consequential actions.

Do not automatically approve an operation simply because the model labels it low risk.

Define the lifecycle:

1. User requests an operation.
2. Agent determines whether a tool is needed.
3. Tool arguments are validated.
4. The operation's risk and permissions are evaluated.
5. If approval is required, execution is blocked.
6. The application displays an action proposal.
7. The human approves or denies it.
8. The trusted execution layer verifies the decision and its association with the proposed action.
9. The action runs only if authorized.
10. The actual result or error is returned.
11. The console reports the outcome accurately.

Investigate and plan safeguards for:

- Forged approval responses.
- Missing or malformed proposals.
- Duplicate approval submissions.
- Replayed approvals.
- Expired or cancelled actions.
- Changes to action arguments after approval.
- Unauthorized tool names.
- Prompt injection in files, logs, tool outputs, and user input.
- Tool failures after approval.
- Partial execution.
- Sensitive data in proposal summaries and logs.
- Operations outside the permitted workspace.
- Requests to expose secrets.

Where appropriate, recommend short-lived, server-side action records bound to the exact operation and its arguments. Implement such a mechanism only if compatible with the existing architecture and necessary to close a verified gap.

Never claim that a security guarantee exists until the enforcement path and its tests have been verified.

---

# PART 8 — PHASE F: VOICE, SCREENS, AND USER EXPERIENCE

Preserve the existing console's behavior while making the chosen agent feel coherent and useful.

Investigate and plan:

- Natural spoken responses.
- Concise final screen text.
- Appropriate use of interactive choices.
- Maximum four choices per screen.
- Valid navigation options.
- Supported application commands.
- Long-running task progress.
- Tool activity visibility.
- Clarification flows.
- Cancellation behavior.
- Error messages.
- Empty results.
- Partial results.
- Voice and text parity.
- Handling of structured and plain-text model responses.

Ensure that screen text intended for speech is natural and Markdown-free.

Do not expose private internal reasoning or chain-of-thought. Instead, display concise, useful execution steps, tool activity, evidence, and conclusions.

Do not introduce unnecessary UI changes. Reuse existing frontend components and interaction contracts whenever possible.

---

# PART 9 — PHASE G: DETAILED IMPLEMENTATION ROADMAP

Produce a concrete, ordered implementation plan that another developer or coding agent can follow from start to finish.

The plan must include these stages, adapted to the actual findings.

## Stage 0: Baseline and repository safety

- Record the current working-tree state.
- Identify existing tests and build status.
- Verify runtime and package manager versions.
- Identify required environment variables without exposing values.
- Record baseline failures.
- Establish a safe local development setup.

## Stage 1: Architecture and contract verification

- Trace the frontend-to-agent request flow.
- Inspect the OpenClaw bridge.
- Inspect agent registration.
- Inspect structured response handling.
- Inspect live execution events.
- Inspect approval and denial handling.
- Verify the relevant blueprint requirements.

## Stage 2: Agent concept and acceptance criteria

- Finalize the recommended use case.
- Define supported user scenarios.
- Define agent responsibilities and non-goals.
- Define tools and permissions.
- Define measurable acceptance criteria.
- Define the minimum viable submission.

## Stage 3: OpenClaw setup and connectivity

- Verify the expected OpenClaw setup.
- Configure the gateway URL and required server-side secrets.
- Verify model availability.
- Establish a minimal, genuine end-to-end agent response.
- Document configuration prerequisites and failures.

## Stage 4: Agent registration and response contract

- Add the agent using the existing registration conventions.
- Verify that it appears in the relevant interface.
- Implement or adapt plain-text and structured response handling.
- Validate screen fields, choices, navigation, and application commands.
- Verify error handling and malformed responses.

## Stage 5: Core tools and skills

- Implement the highest-value read-only tools first.
- Validate inputs and outputs.
- Add clear error handling.
- Add unit tests.
- Integrate tools with the agent.
- Verify actual tool invocation and actual results.

## Stage 6: Progress and voice experience

- Verify the live step-by-step execution path.
- Display useful tool activity and progress.
- Ensure final responses are concise and speakable.
- Test voice and text interactions.
- Test clarification, cancellation, and empty-result flows.

## Stage 7: Approval enforcement

- Implement or repair the approval lifecycle.
- Validate authorization on the trusted execution side.
- Ensure state-changing actions cannot bypass approval.
- Verify denial and cancellation.
- Test invalid, duplicate, expired, and modified proposals where applicable.
- Ensure the displayed outcome matches the real execution result.

## Stage 8: Robustness and security

- Validate untrusted input and tool output.
- Restrict filesystem and command access.
- Protect credentials.
- Handle timeouts and failed services.
- Add resource limits.
- Review sensitive logging and error exposure.
- Add targeted regression tests.

## Stage 9: End-to-end verification

- Test the primary user journey.
- Test important failure scenarios.
- Test actual OpenClaw integration.
- Verify live tool activity.
- Verify the approval panel.
- Verify that a denied action is not executed.
- Verify that a successful action has a genuine result.
- Record any tests that could not be run and why.

## Stage 10: Documentation and packaging

- Prepare the `openclaw/` folder.
- Write the README.
- Document installation and configuration.
- Document how to run the application and agent.
- Document available tools and their permissions.
- Document the approval behavior.
- Document known limitations.
- Document the use of AI tools.
- Confirm the repository or ZIP contains all required deliverables.

## Stage 11: Final acceptance review

- Map every explicit assignment requirement to evidence.
- Run the available typecheck, tests, and relevant build checks.
- Review secrets and generated files.
- Verify that no unrelated user changes were lost.
- Prepare a concise demonstration script.
- Prepare an honest list of completed work, remaining limitations, and known failures.

For every stage, provide:

- Objective.
- Exact tasks in execution order.
- Relevant files to inspect or modify.
- Proposed changes and their justification.
- Dependencies.
- Commands to run, if applicable.
- Expected outputs.
- Acceptance criteria.
- Tests.
- Risks and rollback considerations.
- Estimated effort.
- Definition of done.

Use real file paths discovered in the repository. If a path does not yet exist, label it as a proposed new file rather than an existing one.

---

# PART 10 — PHASE H: TESTING STRATEGY

Create a testing matrix covering the following categories.

## Functional tests

- Agent registration.
- Successful plain-text response.
- Successful structured screen response.
- Choice rendering and selection.
- Valid navigation.
- Supported application commands.
- Correct tool selection.
- Valid tool arguments.
- Real tool results.
- Useful investigation output.
- Voice input and output, to the extent supported by the environment.
- Live progress visibility.

## Error tests

- Missing gateway configuration.
- Unavailable OpenClaw gateway.
- Missing model credentials.
- Model timeout.
- Malformed response.
- Unsupported command.
- Invalid tool arguments.
- Missing file or resource.
- Permission denied.
- Tool execution failure.
- Empty result.
- Partial failure.
- Cancelled operation.

## Safety tests

- Attempted write without approval.
- Attempted delete without approval.
- Denied action.
- Forged approval.
- Duplicate approval.
- Expired or cancelled proposal.
- Changed arguments after approval.
- Unauthorized tool name.
- Prompt injection in inspected content.
- Attempts to access files outside the allowed workspace.
- Attempts to expose secrets.

Use mocks for isolated unit tests when necessary, but distinguish those from integration tests that use actual services.

Do not run destructive safety tests against real data or external systems. Use temporary fixtures and isolated test environments.

For each test, specify the expected behavior and the evidence needed to prove it.

---

# PART 11 — PHASE I: EVALUATION AND DEMONSTRATION

The assignment describes three levels of quality.

### Baseline

The user can talk to the agent, receive a response, and see it use one or two real tools.

### Strong

The system handles messy cases, has readable code, and demonstrates careful engineering decisions.

### Exceptional

The system feels extensible, makes appropriate decisions within clear boundaries, and earns trust through reliable behavior.

Use these levels as evaluation criteria, not as permission to add unnecessary features.

Prepare a short demonstration script that proves:

1. A normal voice or text interaction works.
2. The agent selects and uses a real tool.
3. The console shows meaningful execution progress.
4. The agent returns evidence-based results.
5. A consequential operation generates an approval proposal.
6. Denial prevents execution.
7. Approval permits only the intended authorized operation.
8. An actual failure is reported honestly.
9. The system handles at least one messy or ambiguous scenario safely.

Do not claim that any demonstration passed until it has actually been run.

---

# PART 12 — FINAL DELIVERABLES AND README

The implementation must ultimately provide the following.

## A. Application code

The existing application should remain functional and contain the minimum changes needed for the selected concept.

## B. OpenClaw folder

Provide the actual agent and skill files required by the verified OpenClaw setup.

Document how they are loaded and how their dependencies are configured.

## C. README.md

Prepare a concise but complete README containing:

1. Project name and purpose.
2. Problem being solved.
3. Main capabilities.
4. Architecture overview.
5. Relevant request and execution flow.
6. Agent and tool descriptions.
7. Installation prerequisites.
8. Environment configuration.
9. OpenClaw setup.
10. Commands to run the application and tests.
11. Example interactions.
12. Approval and safety model.
13. Testing performed and actual results.
14. Known limitations.
15. Engineering decisions and trade-offs.
16. Where AI coding tools helped.
17. Any manual configuration or external services required.

Never include actual secrets, private tokens, or sensitive user data.

## D. Final submission checklist

Verify:

- Application code is included.
- The `openclaw/` folder is included.
- Agent and skill definitions are present and loadable.
- Required configuration is documented.
- The README is complete.
- Tests and typecheck results are accurately reported.
- No fake results are presented.
- No secrets have been committed.
- Known limitations are documented.
- A reviewer can follow the setup instructions.

---

# PART 13 — REQUIRED INITIAL RESPONSE FORMAT

After completing the investigation, do not immediately implement anything.

Produce a report with the following sections in exactly this order.

## 1. Executive Summary

Explain what the repository contains, what the assignment requires, the current state, and the recommended direction.

## 2. Assignment Requirements Checklist

List every explicit assignment requirement and its verified status.

Include source references for each important claim.

## 3. Repository Architecture Map

Show the relevant directory structure and explain each important component.

## 4. Actual Application Flow

Trace the request from user input through the frontend, agent bridge, OpenClaw, tools, response handling, and final display.

Explain how approval fits into the flow.

## 5. OpenClaw and Agent Integration Findings

Document the verified integration details and unknowns.

## 6. Blueprint Analysis

Summarize the relevant sections of `unified-plan.yaml`, the requirements that matter, and the scope boundaries.

## 7. Current Gaps and Risks

List verified missing features, incomplete implementations, technical risks, security concerns, and external blockers.

Separate confirmed issues from unverified hypotheses.

## 8. Candidate Ideas and Final Recommendation

Compare up to three feasible ideas and recommend one with a clear justification.

## 9. Proposed Architecture

Describe the agent, tools, skills, permissions, response flow, and approval boundaries.

Use a Mermaid diagram if supported and useful, based on the actual or explicitly proposed architecture.

Clearly label unverified or proposed components.

## 10. Requirements Traceability Matrix

Map each assignment requirement to the existing code, proposed change, and verification method.

## 11. Detailed End-to-End Implementation Plan

Provide ordered stages from baseline inspection through final packaging.

For each stage, include tasks, file paths, dependencies, acceptance criteria, tests, risks, and estimated effort.

## 12. Testing and Acceptance Plan

Provide a test matrix with expected outcomes.

## 13. Risks, Dependencies, and Blocking Questions

Identify missing credentials, service dependencies, unclear contracts, and decisions requiring my input.

Do not ask questions that can be answered by inspecting the repository.

## 14. Deliverables Checklist

List the final files, folders, documentation, and evidence needed for submission.

## 15. Approval Gate

End with:

- The recommended implementation approach.
- The highest-priority first stage.
- The assumptions that still need confirmation.
- A concise list of questions I must answer before implementation, if any.
- A clear request for my approval to begin Stage 0 or the first implementation stage, as appropriate.

Do not proceed with implementation until I explicitly approve the proposed plan.

---

# PART 14 — EXECUTION INSTRUCTIONS FOR THIS FIRST PASS

Begin now with repository discovery.

1. Inspect the working tree and repository root.
2. Read the assignment and project documentation.
3. Map the repository structure.
4. Inspect the required integration points.
5. Trace the existing request, response, tool, voice, and approval flows.
6. Inspect the relevant blueprint requirements.
7. Run only safe diagnostics needed to establish the baseline.
8. Gather evidence and identify unknowns.
9. Recommend the best focused agent concept.
10. Produce the complete report specified in Part 13.

Do not modify application files, install unnecessary dependencies, create agent implementations, or start the feature work during this first pass.

If the repository is too large to inspect completely in one pass, prioritize the entry points, integration boundaries, contracts, security-sensitive code, tests, and relevant blueprint sections. Maintain a list of inspected files and files still requiring inspection. Do not describe a partial inspection as a complete audit.

If you cannot access a file, service, credential, or command, state the exact limitation and continue with the evidence that is available.

**The goal of this first pass is to give us a trustworthy, repository-specific, technically detailed plan that we can review together before writing or changing any code.**
