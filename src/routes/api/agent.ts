import { createFileRoute } from "@tanstack/react-router";
import { OUTPUT_FORMAT, SYSTEM_PROMPT, planContextMessage } from "@/lib/voice/prompt";
import type { GatewayOptions } from "@/lib/ai/responses.server";
import { dispatchTool, isKnownTool } from "@/lib/agent/tools.server";
import { createProposal } from "@/lib/agent/approval.server";
import { parseScreen } from "@/lib/voice/screen";
import { resolveGatewayModel, toOpenClawTarget } from "@/lib/ai/models";

type Turn = { role: "user" | "assistant"; text: string };

export const Route = createFileRoute("/api/agent")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const { streamResponses, collectResponses } = await import("@/lib/ai/responses.server");
        // Dynamic import removed for frequently used modules; using static imports instead.
        let turns: Turn[] = [];
        let context: string | undefined;
        let modelName: string | undefined;
        let consoleAgent: string | undefined;
        let conversationId: string | undefined;
        try {
          const body = (await request.json()) as { turns?: Turn[]; context?: unknown; model?: unknown; agent?: unknown; conversationId?: unknown };
          if (Array.isArray(body.turns)) turns = body.turns.filter((t) => t && typeof t.text === "string");
          if (typeof body.context === "string") context = body.context;
          if (typeof body.model === "string") modelName = body.model;
          if (typeof body.agent === "string" && body.agent.trim()) consoleAgent = body.agent.trim().slice(0, 64);
          if (typeof body.conversationId === "string" && body.conversationId.trim()) conversationId = body.conversationId.trim().slice(0, 64);
        } catch {
          turns = [];
        }
        if (!turns.length) {
          return new Response(JSON.stringify({ error: "Nothing to answer" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const model = resolveGatewayModel(modelName);
        if (!model) {
          return new Response(JSON.stringify({ error: `${modelName} isn't offered by the built-in AI service` }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        // On the OpenClaw Gateway the `model` field targets an agent, not a provider model.
        // The console agent routes to openclaw/<agentId> and any provider model rides the
        // x-openclaw-model header, so backend model ids are never sent where an agent belongs.
        const explicitAgentTarget = model.startsWith("openclaw/") && model !== "openclaw/default" ? model : null;
        const gatewayTarget = explicitAgentTarget ?? toOpenClawTarget(consoleAgent);
        const sessionUser = conversationId && /^[A-Za-z0-9_.:\-]{1,64}$/.test(conversationId) ? `conv:${conversationId}` : undefined;
        const agentHeader = gatewayTarget === "openclaw/default" ? undefined : gatewayTarget.slice("openclaw/".length);
        const backendModel = model.startsWith("openclaw/") ? undefined : model;
        const gw: GatewayOptions = {
          ...(agentHeader ? { agentId: agentHeader } : {}),
          ...(sessionUser ? { sessionUser } : {}),
          ...(backendModel ? { backendModel } : {}),
        };

        const plan = planContextMessage(context);
        const buildInput = (extra: Array<{ role: string; content: Array<{ type: string; text: string }> }> = []) => [
          { role: "system", content: [{ type: "input_text", text: SYSTEM_PROMPT }] },
          ...(plan ? [{ role: "system", content: [{ type: "input_text", text: plan }] }] : []),
          ...turns.slice(-12).map((turn) => ({
            role: turn.role,
            content: [
              turn.role === "assistant"
                ? { type: "output_text", text: turn.text }
                : { type: "input_text", text: turn.text },
            ],
          })),
          ...extra,
        ];

        // --- Tool dispatch loop (max 5 read-only tool calls) ---
        const toolMessages: Array<{ role: string; content: Array<{ type: string; text: string }> }> = [];
        const MAX_TOOL_ROUNDS = 5;

        for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
          // Collect the full response (non-streaming) to check for tool_request.
          let fullText: string;
          try {
            fullText = await collectResponses(request, buildInput(toolMessages), { text: { format: OUTPUT_FORMAT } }, gatewayTarget, gw);
          } catch (error) {
            if (request.signal.aborted) return new Response(null, { status: 499 });
            const message = error instanceof Error ? error.message : "Model call failed";
            return new Response(JSON.stringify({ error: message }), {
              status: 502,
              headers: { "Content-Type": "application/json" },
            });
          }

          const screen = parseScreen(fullText);
          const toolReq = screen?.toolRequest;

          // No tool request — return the final response to the client.
          if (!toolReq) {
            return new Response(fullText, {
              status: 200,
              headers: { "Content-Type": "application/json", "Cache-Control": "no-cache" },
            });
          }

          // Validate tool name.
          if (!isKnownTool(toolReq.tool)) {
            // Inject error and let model try again.
            toolMessages.push({
              role: "user",
              content: [{ type: "input_text", text: `[TOOL ERROR] Unknown tool: ${toolReq.tool}. Available tools: read_file, list_files, search_code, write_fix.` }],
            });
            continue;
          }

          // write_fix: create a server-side proposal and return immediately.
          if (toolReq.tool === "write_fix") {
            const toolResult = await dispatchTool({ tool: toolReq.tool, args: toolReq.args });
            if (toolResult.needsApproval) {
              const proposal = createProposal(toolReq.tool, toolResult.needsApproval.args);
              // Rebuild the response with the server-generated proposal ID.
              const enriched = JSON.stringify({
                kind: "screen",
                screen: { text: `Proposal ready for your approval: ${toolResult.needsApproval.title}. ${toolResult.needsApproval.summary}`, choices: [], navigation: ["cancel"] },
                action_proposal: {
                  id: proposal.id,
                  title: toolResult.needsApproval.title,
                  tool: toolReq.tool,
                  summary: toolResult.needsApproval.summary,
                  risk: toolResult.needsApproval.risk,
                },
                app_commands: screen.commands ?? [],
                tool_request: null,
              });
              return new Response(enriched, {
                status: 200,
                headers: { "Content-Type": "application/json", "Cache-Control": "no-cache" },
              });
            }
            // If write_fix validation failed (e.g., path traversal), inject error.
            toolMessages.push({
              role: "user",
              content: [{ type: "input_text", text: `[TOOL ERROR] ${toolResult.output}` }],
            });
            continue;
          }

          // Read-only tool: execute and inject result.
          const toolResult = await dispatchTool({ tool: toolReq.tool, args: toolReq.args });
          // Add the model's response and the tool result to the conversation.
          toolMessages.push(
            { role: "assistant", content: [{ type: "output_text", text: fullText }] },
            { role: "user", content: [{ type: "input_text", text: `[TOOL RESULT] ${toolResult.ok ? toolResult.output : `Error: ${toolResult.output}`}` }] },
          );
        }

        // Exhausted tool rounds — stream the final response.
        return streamResponses(request, buildInput(toolMessages), { text: { format: OUTPUT_FORMAT } }, gatewayTarget, gw);
      },
    },
  },
});
