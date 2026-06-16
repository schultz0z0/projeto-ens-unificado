import {
  bindHermesSessionToState,
  ensureHermesConversationState,
  type HermesConversationStateRecord,
  type HermesConversationStateRepository,
} from "./hermesConversationState.ts";
import { createHermesSession, isHermesSessionApiUnavailableError } from "./hermesSessionsClient.ts";

export const ensureHermesSessionBinding = async ({
  repository,
  chatSessionId,
  userId,
  hermesBaseUrl,
  hermesApiKey,
  sessionsApiEnabled,
}: {
  repository: HermesConversationStateRepository;
  chatSessionId: string;
  userId: string;
  hermesBaseUrl: URL;
  hermesApiKey: string;
  sessionsApiEnabled: boolean;
}) => {
  const state = await ensureHermesConversationState({
    repository,
    chatSessionId,
    userId,
  });

  if (state.hermes_session_id) {
    return state;
  }

  if (!sessionsApiEnabled) {
    return state;
  }

  let session;
  try {
    session = await createHermesSession({
      hermesBaseUrl,
      hermesApiKey,
      title: `Nexus ${chatSessionId}`,
    });
  } catch (error) {
    if (isHermesSessionApiUnavailableError(error)) {
      return state;
    }
    throw error;
  }

  return await bindHermesSessionToState({
    repository,
    state,
    hermesSessionId: session.id,
  });
};

export const buildHermesResponseRoutingState = ({
  state,
  previousResponseId,
}: {
  state: HermesConversationStateRecord;
  previousResponseId?: string | null;
}) => ({
  conversationId: state.hermes_conversation_id,
  previousResponseId: previousResponseId ?? state.last_good_response_id,
  hermesSessionId: state.hermes_session_id,
});
