import type { HermesPreparedAttachment, HermesReplayContextMessage } from "./multimodalPayload.ts";
import { buildHermesInput } from "./multimodalPayload.ts";

export const buildHermesConversationId = (userId: string, sessionId: string) => `nexus:${userId}:${sessionId}`;

const getHermesModelName = () => {
  const denoEnv = typeof Deno !== "undefined" ? Deno.env.get("HERMES_MODEL_NAME") : undefined;
  return (denoEnv ?? "hermes-agent").trim() || "hermes-agent";
};

export const buildHermesResponsesRequest = ({
  userId,
  sessionId,
  messageText,
  attachments,
  conversationId,
  previousResponseId,
  replayContextMessages,
}: {
  userId: string;
  sessionId: string;
  messageText: string;
  attachments: HermesPreparedAttachment[];
  conversationId?: string;
  previousResponseId?: string | null;
  replayContextMessages?: HermesReplayContextMessage[];
}) => ({
  model: getHermesModelName(),
  store: true,
  stream: true,
  conversation: conversationId ?? buildHermesConversationId(userId, sessionId),
  ...(previousResponseId ? { previous_response_id: previousResponseId } : {}),
  metadata: {
    nexus_user_id: userId,
    nexus_session_id: sessionId,
    source: "nexus-ai-frontend",
  },
  input: buildHermesInput({
    messageText,
    attachments,
    replayContextMessages,
  }),
});
