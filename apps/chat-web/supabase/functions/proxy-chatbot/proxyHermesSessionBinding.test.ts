import { beforeEach, describe, expect, it, vi } from "vitest";

import { buildInitialHermesConversationState, type HermesConversationStateRecord, type HermesConversationStateRepository } from "./hermesConversationState";
import { ensureHermesSessionBinding } from "./proxyHermesSessionBinding";
import { createHermesSession } from "./hermesSessionsClient";

vi.mock("./hermesSessionsClient.ts", () => ({
  createHermesSession: vi.fn().mockResolvedValue({ id: "hsess_created", title: "Nexus" }),
  isHermesSessionApiUnavailableError: (error: unknown) =>
    error instanceof Error && /hermes_session_create_failed:(404|405|501)/.test(error.message),
}));

const createMemoryRepository = (seed?: HermesConversationStateRecord): HermesConversationStateRepository => {
  const store = new Map<string, HermesConversationStateRecord>();
  if (seed) store.set(seed.chat_session_id, seed);

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
    async patch(chatSessionId, _userId, changes) {
      const current = store.get(chatSessionId);
      if (!current) throw new Error("missing");
      const next = { ...current, ...changes };
      store.set(chatSessionId, next);
      return next;
    },
    async delete(chatSessionId) {
      store.delete(chatSessionId);
    },
  };
};

describe("proxyHermesSessionBinding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("garante uma sessao Hermes quando ainda nao existe binding", async () => {
    const repository = createMemoryRepository();

    const state = await ensureHermesSessionBinding({
      repository,
      chatSessionId: "session-1",
      userId: "user-1",
      hermesBaseUrl: new URL("https://hermes.example"),
      hermesApiKey: "secret",
      sessionsApiEnabled: true,
    });

    expect(state.hermes_session_id).toBe("hsess_created");
    expect(state.hermes_conversation_id).toBe("nexus:user-1:session-1");
  });

  it("reaproveita o binding existente sem criar outra sessao Hermes", async () => {
    const repository = createMemoryRepository({
      ...buildInitialHermesConversationState({
        chatSessionId: "session-2",
        userId: "user-2",
      }),
      hermes_session_id: "hsess_existing",
    });

    const state = await ensureHermesSessionBinding({
      repository,
      chatSessionId: "session-2",
      userId: "user-2",
      hermesBaseUrl: new URL("https://hermes.example"),
      hermesApiKey: "secret",
      sessionsApiEnabled: true,
    });

    expect(state.hermes_session_id).toBe("hsess_existing");
  });

  it("degrada para responses-only quando sessionsApi nao esta disponivel", async () => {
    const repository = createMemoryRepository();

    const state = await ensureHermesSessionBinding({
      repository,
      chatSessionId: "session-3",
      userId: "user-3",
      hermesBaseUrl: new URL("https://hermes.example"),
      hermesApiKey: "secret",
      sessionsApiEnabled: false,
    });

    expect(state.hermes_session_id).toBeNull();
    expect(createHermesSession).not.toHaveBeenCalled();
  });

  it("degrada para responses-only quando o Hermes responde 405 ao criar sessao", async () => {
    vi.mocked(createHermesSession).mockRejectedValueOnce(new Error("hermes_session_create_failed:405"));
    const repository = createMemoryRepository();

    const state = await ensureHermesSessionBinding({
      repository,
      chatSessionId: "session-4",
      userId: "user-4",
      hermesBaseUrl: new URL("https://hermes.example"),
      hermesApiKey: "secret",
      sessionsApiEnabled: true,
    });

    expect(state.hermes_session_id).toBeNull();
    expect(state.hermes_conversation_id).toBe("nexus:user-4:session-4");
  });
});
