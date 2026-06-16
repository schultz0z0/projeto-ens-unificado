import { describe, expect, it } from "vitest";

import { buildInitialHermesConversationState } from "./hermesConversationState";
import { buildHermesRecoveryPlan, isHermesContextFailure } from "./hermesRecoveryStrategy";

describe("hermesRecoveryStrategy", () => {
  it("detecta erros estruturais de contexto do Hermes", () => {
    expect(isHermesContextFailure("'NoneType' object is not iterable")).toBe(true);
    expect(isHermesContextFailure("upstream_empty_response")).toBe(true);
    expect(isHermesContextFailure("outro erro")).toBe(false);
  });

  it("primeiro tenta girar a conversation reaproveitando o last_good_response_id", () => {
    const state = {
      ...buildInitialHermesConversationState({
        chatSessionId: "session-1",
        userId: "user-1",
      }),
      last_good_response_id: "resp_ok",
    };

    expect(buildHermesRecoveryPlan({
      state,
      attemptCount: 0,
      errorMessage: "'NoneType' object is not iterable",
    })).toEqual({
      strategy: "rotate_conversation",
      nextConversationId: "nexus:user-1:session-1:recovery:1",
      previousResponseId: "resp_ok",
      reason: "'NoneType' object is not iterable",
    });
  });

  it("na segunda tentativa cria nova sessao Hermes e zera a ancora explicita", () => {
    const state = buildInitialHermesConversationState({
      chatSessionId: "session-2",
      userId: "user-2",
    });

    expect(buildHermesRecoveryPlan({
      state,
      attemptCount: 1,
      errorMessage: "upstream_empty_response",
    })).toEqual({
      strategy: "create_new_session",
      nextConversationId: "nexus:user-2:session-2:recovery:2",
      previousResponseId: null,
      reason: "upstream_empty_response",
    });
  });
});
