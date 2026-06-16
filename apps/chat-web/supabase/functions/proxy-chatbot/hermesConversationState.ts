import { buildHermesConversationId } from "./hermesResponsesAdapter.ts";

export type HermesChainHealth = "healthy" | "degraded" | "recovering";

export type HermesConversationStateRecord = {
  chat_session_id: string;
  user_id: string;
  hermes_session_id: string | null;
  hermes_conversation_id: string;
  last_response_id: string | null;
  last_good_response_id: string | null;
  chain_health: HermesChainHealth;
  last_error_code: string | null;
  last_error_at: string | null;
};

export type HermesConversationStateRepository = {
  get: (chatSessionId: string, userId: string) => Promise<HermesConversationStateRecord | null>;
  upsert: (record: HermesConversationStateRecord) => Promise<HermesConversationStateRecord>;
  patch: (
    chatSessionId: string,
    userId: string,
    changes: Partial<HermesConversationStateRecord>,
  ) => Promise<HermesConversationStateRecord>;
  delete: (chatSessionId: string, userId: string) => Promise<void>;
};

export const buildInitialHermesConversationState = ({
  chatSessionId,
  userId,
}: {
  chatSessionId: string;
  userId: string;
}): HermesConversationStateRecord => ({
  chat_session_id: chatSessionId,
  user_id: userId,
  hermes_session_id: null,
  hermes_conversation_id: buildHermesConversationId(userId, chatSessionId),
  last_response_id: null,
  last_good_response_id: null,
  chain_health: "healthy",
  last_error_code: null,
  last_error_at: null,
});

export const buildRecoveryConversationId = (conversationId: string, attempt: number) =>
  `${conversationId}:recovery:${attempt}`;

export const ensureHermesConversationState = async ({
  repository,
  chatSessionId,
  userId,
}: {
  repository: HermesConversationStateRepository;
  chatSessionId: string;
  userId: string;
}) => {
  const existing = await repository.get(chatSessionId, userId);
  if (existing) return existing;

  return await repository.upsert(buildInitialHermesConversationState({ chatSessionId, userId }));
};

export const bindHermesSessionToState = async ({
  repository,
  state,
  hermesSessionId,
}: {
  repository: HermesConversationStateRepository;
  state: HermesConversationStateRecord;
  hermesSessionId: string;
}) => {
  return await repository.patch(state.chat_session_id, state.user_id, {
    hermes_session_id: hermesSessionId,
  });
};

export const markHermesResponseCompleted = async ({
  repository,
  state,
  responseId,
}: {
  repository: HermesConversationStateRepository;
  state: HermesConversationStateRecord;
  responseId: string | null;
}) => {
  return await repository.patch(state.chat_session_id, state.user_id, {
    last_response_id: responseId,
    last_good_response_id: responseId,
    chain_health: "healthy",
    last_error_code: null,
    last_error_at: null,
  });
};

export const markHermesResponseRecovered = async ({
  repository,
  state,
  responseId,
  errorCode,
}: {
  repository: HermesConversationStateRepository;
  state: HermesConversationStateRecord;
  responseId: string | null;
  errorCode: string;
}) => {
  return await repository.patch(state.chat_session_id, state.user_id, {
    last_response_id: responseId,
    last_good_response_id: state.last_good_response_id,
    chain_health: "degraded",
    last_error_code: errorCode,
    last_error_at: new Date().toISOString(),
  });
};

export const markHermesChainDegraded = async ({
  repository,
  state,
  errorCode,
}: {
  repository: HermesConversationStateRepository;
  state: HermesConversationStateRecord;
  errorCode: string;
}) => {
  return await repository.patch(state.chat_session_id, state.user_id, {
    chain_health: "degraded",
    last_error_code: errorCode,
    last_error_at: new Date().toISOString(),
  });
};

export const markHermesChainRecovering = async ({
  repository,
  state,
  nextConversationId,
  errorCode,
}: {
  repository: HermesConversationStateRepository;
  state: HermesConversationStateRecord;
  nextConversationId: string;
  errorCode: string;
}) => {
  return await repository.patch(state.chat_session_id, state.user_id, {
    hermes_conversation_id: nextConversationId,
    chain_health: "recovering",
    last_error_code: errorCode,
    last_error_at: new Date().toISOString(),
  });
};

export const clearHermesConversationState = async ({
  repository,
  chatSessionId,
  userId,
}: {
  repository: HermesConversationStateRepository;
  chatSessionId: string;
  userId: string;
}) => {
  await repository.delete(chatSessionId, userId);
};

export const createSupabaseHermesConversationStateRepository = (
  supabaseAdmin: {
    from: (table: string) => {
      select: (columns: string) => {
        eq: (column: string, value: string) => {
          eq: (innerColumn: string, innerValue: string) => {
            maybeSingle: () => Promise<{ data: HermesConversationStateRecord | null; error: { message: string } | null }>;
          };
        };
      };
      upsert: (
        payload: HermesConversationStateRecord,
        options: { onConflict: string },
      ) => {
        select: (columns: string) => {
          single: () => Promise<{ data: HermesConversationStateRecord | null; error: { message: string } | null }>;
        };
      };
      update: (changes: Partial<HermesConversationStateRecord>) => {
        eq: (column: string, value: string) => {
          eq: (innerColumn: string, innerValue: string) => {
            select: (columns: string) => {
              single: () => Promise<{ data: HermesConversationStateRecord | null; error: { message: string } | null }>;
            };
          };
        };
      };
      delete: () => {
        eq: (column: string, value: string) => {
          eq: (innerColumn: string, innerValue: string) => Promise<{ error: { message: string } | null }>;
        };
      };
    };
  },
): HermesConversationStateRepository => ({
  async get(chatSessionId, userId) {
    const { data, error } = await supabaseAdmin
      .from("chat_session_hermes_state")
      .select("*")
      .eq("chat_session_id", chatSessionId)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      throw new Error(`chat_session_hermes_state.get_failed:${error.message}`);
    }

    return data;
  },
  async upsert(record) {
    const { data, error } = await supabaseAdmin
      .from("chat_session_hermes_state")
      .upsert(record, { onConflict: "chat_session_id" })
      .select("*")
      .single();

    if (error || !data) {
      throw new Error(`chat_session_hermes_state.upsert_failed:${error?.message ?? "unknown"}`);
    }

    return data;
  },
  async patch(chatSessionId, userId, changes) {
    const { data, error } = await supabaseAdmin
      .from("chat_session_hermes_state")
      .update(changes)
      .eq("chat_session_id", chatSessionId)
      .eq("user_id", userId)
      .select("*")
      .single();

    if (error || !data) {
      throw new Error(`chat_session_hermes_state.patch_failed:${error?.message ?? "unknown"}`);
    }

    return data;
  },
  async delete(chatSessionId, userId) {
    const { error } = await supabaseAdmin
      .from("chat_session_hermes_state")
      .delete()
      .eq("chat_session_id", chatSessionId)
      .eq("user_id", userId);

    if (error) {
      throw new Error(`chat_session_hermes_state.delete_failed:${error.message}`);
    }
  },
});
