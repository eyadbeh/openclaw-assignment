import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveGatewayModel, toOpenClawTarget } from "./models.ts";

describe("resolveGatewayModel", () => {
  it("maps a portfolio chip or openclaw route to its gateway model", () => {
    assert.equal(resolveGatewayModel("gpt-5.6-terra"), "openai/gpt-5.6-terra");
    assert.equal(resolveGatewayModel("gemini-3.1-pro"), "google/gemini-3.1-pro-preview");
    assert.equal(resolveGatewayModel("openclaw/researcher"), "openclaw/researcher");
  });
  it("uses the default agent target when none is picked", () => {
    assert.equal(resolveGatewayModel(undefined), "openclaw/default");
  });
  it("refuses unknown models instead of swapping them", () => {
    assert.equal(resolveGatewayModel("gpt-5.6-sol-pro"), null);
  });
  it("routes console agents to OpenClaw agent targets", () => {
    assert.equal(toOpenClawTarget("ciso"), "openclaw/ciso");
    assert.equal(toOpenClawTarget("general"), "openclaw/default");
    assert.equal(toOpenClawTarget(undefined), "openclaw/default");
  });
});
