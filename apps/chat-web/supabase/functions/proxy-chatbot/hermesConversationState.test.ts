import { describe, expect, it } from "vitest";

import {
  bindHermesSessionToState,
  buildInitialHermesConversationState,
  buildRecoveryConversationId,
  ensureHermesConversationState,
  markHermesChainDegraded,
  markHermesChainRecovering,
  markHermesResponseCompleted,
  markHermesResponseRecovered,
  type HermesConversationStateRecord,
  type HermesConversationStateRepository,
} from "./hermesConversationState";

const createMemoryRepository = (seed?: HermesConversationStateRecord): HermesConversationStateRepository => {
  const store = new Map<string, HermesConversationStateRecord>();
  if (seed) {
    store.set(seed.chat_session_id, seed);
  }

  return {
    async get(chatSessionId, userId) {
      const item = store.get(chatSessionId) ?? null;
      if (!item || item.user_id !== userId) return null;
      return item;
    },
    async upsert(record) {
      store.set(record.chat_session_id, record);
      return record;
    },
    async patch(chatSessionId, userId, changes) {
      const current = store.get(chatSessionId);
      if (!current || current.user_id !== userId) {
        throw new Error("state_not_found");
      }

      const next = { ...current, ...changes };
      store.set(chatSessionId, next);
      return next;
    },
    async delete(chatSessionId) {
      store.delete(chatSessionId);
    },
  };
};

describe("hermesConversationState", () => {
  it("cria estado Hermes inicial com conversation deterministica", async () => {
    const repository = createMemoryRepository();
    const state = await ensureHermesConversationState({
      repository,
      chatSessionId: "session-1",
      userId: "user-1",
    });

    expect(state).toEqual({
      chat_session_id: "session-1",
      user_id: "user-1",
      hermes_session_id: null,
      hermes_conversation_id: "nexus:user-1:session-1",
      last_response_id: null,
      last_good_response_id: null,
      chain_health: "healthy",
      last_error_code: null,
      last_error_at: null,
    });
  });

  it("nao recria o estado quando ele ja existe", async () => {
    const existing = buildInitialHermesConversationState({
      chatSessionId: "session-1",
      userId: "user-1",
    });
    const repository = createMemoryRepository(existing);

    const state = await ensureHermesConversationState({
      repository,
      chatSessionId: "session-1",
      userId: "user-1",
    });

    expect(state).toBe(existing);
  });

  it("vincula hermes_session_id e promove response_id bom ao concluir com sucesso", async () => {
    const initial = buildInitialHermesConversationState({
      chatSessionId: "session-2",
      userId: "user-2",
    });
    const repository = createMemoryRepository(initial);

    const withSession = await bindHermesSessionToState({
      repository,
      state: initial,
      hermesSessionId: "hsess_123",
    });

    const completed = await markHermesResponseCompleted({
      repository,
      state: withSession,
      responseId: "resp_ok",
    });

    expect(completed.hermes_session_id).toBe("hsess_123");
    expect(completed.last_response_id).toBe("resp_ok");
    expect(completed.last_good_response_id).toBe("resp_ok");
    expect(completed.chain_health).toBe("healthy");
    expect(completed.last_error_code).toBeNull();
  });

  it("marca cadeia degradada quando a resposta falha mas ainda gera response_id recuperavel", async () => {
    const initial = {
      ...buildInitialHermesConversationState({
        chatSessionId: "session-3",
        userId: "user-3",
      }),
      last_good_response_id: "resp_prev_ok",
    };
    const repository = createMemoryRepository(initial);

    const recovered = await markHermesResponseRecovered({
      repository,
      state: initial,
      responseId: "resp_recovered",
      errorCode: "NoneType",
    });

    expect(recovered.last_response_id).toBe("resp_recovered");
    expect(recovered.last_good_response_id).toBe("resp_prev_ok");
    expect(recovered.chain_health).toBe("degraded");
    expect(recovered.last_error_code).toBe("NoneType");
    expect(recovered.last_error_at).toBeTruthy();
  });

  it("gira a conversation ao entrar em recovery", async () => {
    const initial = buildInitialHermesConversationState({
      chatSessionId: "session-4",
      userId: "user-4",
    });
    const repository = createMemoryRepository(initial);
    const nextConversationId = buildRecoveryConversationId(initial.hermes_conversation_id, 1);

    const recovering = await markHermesChainRecovering({
      repository,
      state: initial,
      nextConversationId,
      errorCode: "NoneType",
    });

    expect(recovering.hermes_conversation_id).toBe(`${initial.hermes_conversation_id}:recovery:1`);
    expect(recovering.chain_health).toBe("recovering");
    expect(recovering.last_error_code).toBe("NoneType");
  });

  it("mantem a conversation atual e apenas sinaliza degradacao quando necessario", async () => {
    const initial = buildInitialHermesConversationState({
      chatSessionId: "session-5",
      userId: "user-5",
    });
    const repository = createMemoryRepository(initial);

    const degraded = await markHermesChainDegraded({
      repository,
      state: initial,
      errorCode: "upstream_empty_response",
    });

    expect(degraded.hermes_conversation_id).toBe("nexus:user-5:session-5");
    expect(degraded.chain_health).toBe("degraded");
    expect(degraded.last_error_code).toBe("upstream_empty_response");
  });
});
