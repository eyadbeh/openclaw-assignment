import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/agent/approve")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const { resolveProposal, consumeApproval, setResult, ApprovalError } = await import("@/lib/agent/approval.server");
        const { executeApprovedWrite } = await import("@/lib/agent/tools.server");

        const json = (body: unknown, status = 200) =>
          new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

        let proposalId: string;
        let approved: boolean;
        try {
          const body = (await request.json()) as { proposalId?: unknown; approved?: unknown };
          if (typeof body.proposalId !== "string" || !body.proposalId.trim()) return json({ error: "Missing proposalId" }, 400);
          if (typeof body.approved !== "boolean") return json({ error: "Missing approved (boolean)" }, 400);
          proposalId = body.proposalId.trim();
          approved = body.approved;
        } catch {
          return json({ error: "Invalid request body" }, 400);
        }

        try {
          // Phase 1: Record the decision.
          const record = resolveProposal(proposalId, approved);

          if (!approved) {
            return json({ status: "denied", proposalId: record.id, message: "Action denied. No changes were made." });
          }

          // Phase 2: Execute the approved action using the stored arguments.
          const { args } = consumeApproval(record.id);
          const result = await executeApprovedWrite(args);
          setResult(record.id, result.output);

          return json({
            status: result.ok ? "executed" : "error",
            proposalId: record.id,
            message: result.output,
          });
        } catch (error) {
          const message = error instanceof ApprovalError ? error.message : "Approval failed";
          return json({ error: message }, 400);
        }
      },
    },
  },
});
