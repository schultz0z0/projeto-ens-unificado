import type { HermesConversationStateRecord } from "./hermesConversationState.ts";
import { buildRecoveryConversationId } from "./hermesConversationState.ts";

export type HermesRecoveryStrategy =
  | {
      strategy: "rotate_conversation";
      nextConversationId: string;
      previousResponseId: string | null;
      reason: string;
    }
  | {
      strategy: "create_new_session";
      nextConversationId: string;
      previousResponseId: null;
      reason: string;
    }
  | {
      strategy: "give_up";
      reason: string;
    };

export const isHermesContextFailure = (message: string) => {
  const normalized = message.trim().toLowerCase();
  return (
    normalized.includes("nonetype") ||
    normalized.includes("object is not iterable") ||
    normalized.includes("upstream_empty_response") ||
    normalized.includes("response.failed")
  );
};

export const buildHermesRecoveryPlan = ({
  state,
  attemptCount,
  errorMessage,
}: {
  state: HermesConversationStateRecord;
  attemptCount: number;
  errorMessage: string;
}): HermesRecoveryStrategy => {
  const reason = errorMessage.trim() || "hermes_context_failure";

  if (!isHermesContextFailure(reason)) {
    return { strategy: "give_up", reason };
  }

  if (attemptCount === 0) {
    return {
      strategy: "rotate_conversation",
      nextConversationId: buildRecoveryConversationId(state.hermes_conversation_id, 1),
      previousResponseId: state.last_good_response_id,
      reason,
    };
  }

  if (attemptCount === 1) {
    return {
      strategy: "create_new_session",
      nextConversationId: buildRecoveryConversationId(state.hermes_conversation_id, 2),
      previousResponseId: null,
      reason,
    };
  }

  return { strategy: "give_up", reason };
};
