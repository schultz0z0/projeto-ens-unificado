import { createServer } from "node:http";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

import {
  buildHermesRunSessionId,
  parseHermesEventBlock,
  parseHermesStatusPayload,
} from "./hermes-events.js";
import { prepareHermesAttachments, CHAT_ATTACHMENT_BUCKET } from "./attachments.js";
import {
  buildHermesRunRequest,
  buildHermesResponsesRequest,
  buildHermesSessionKey,
  isImageAttachment,
  shouldUseResponsesApi,
} from "./hermes-payloads.js";
import {
  bindHermesSessionFromResponse,
  bindHermesSessionToState,
  buildHermesResponseRoutingState,
  createMemoryHermesStateRepository,
  createSupabaseHermesStateRepository,
  ensureHermesConversationState,
  markHermesChainDegraded,
  markHermesResponseCompleted,
  markHermesResponseRecovered,
} from "./hermes-state.js";
import {
  createHermesSession,
  deleteHermesSession,
  isHermesSessionApiUnavailableError,
} from "./hermes-sessions.js";

const config = {
  port: Number(process.env.BRIDGE_PORT || 8080),
  dataDir: process.env.BRIDGE_DATA_DIR || "/app/data",
  allowedOrigins: (process.env.BRIDGE_ALLOWED_ORIGINS || "https://chat.solucoes-nexus.tech")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  supabaseUrl: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "",
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  attachmentBucket: process.env.CHAT_ATTACHMENTS_BUCKET || process.env.VITE_CHAT_ATTACHMENTS_BUCKET || CHAT_ATTACHMENT_BUCKET,
  hermesBaseUrl: process.env.HERMES_API_BASE_URL || "",
  hermesApiKey: process.env.HERMES_API_KEY || "",
  hermesModelName: process.env.HERMES_MODEL_NAME || "hermes-agent",
  hermesPollMs: Number(process.env.HERMES_RUN_POLL_MS || 2000),
  hermesSessionsApiEnabled: process.env.HERMES_SESSIONS_API_ENABLED !== "false",
};

const terminalStatuses = new Set(["completed", "failed", "cancelled", "canceled", "expired", "interrupted"]);

const nowIso = () => new Date().toISOString();

const jsonResponse = (res, status, payload, headers = {}) => {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    ...headers,
  });
  res.end(JSON.stringify(payload));
};

const emitSse = (event, data) => (
  `event: ${event}\ndata: ${typeof data === "string" ? data : JSON.stringify(data)}\n\n`
);

const normalizeBaseUrl = (value) => {
  if (!value) return null;
  try {
    return new URL(value);
  } catch {
    return null;
  }
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getCorsHeaders = (req) => {
  const origin = req.headers.origin;
  const allowAny = config.allowedOrigins.includes("*");
  const allowedOrigin = origin && (allowAny || config.allowedOrigins.includes(origin)) ? origin : "";

  return {
    ...(allowedOrigin ? { "Access-Control-Allow-Origin": allowedOrigin, "Vary": "Origin" } : {}),
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Authorization,Content-Type",
    "Access-Control-Max-Age": "86400",
  };
};

const readJsonBody = async (req, maxBytes = 1_000_000) => {
  let body = "";
  for await (const chunk of req) {
    body += chunk;
    if (body.length > maxBytes) {
      const error = new Error("payload_too_large");
      error.status = 413;
      throw error;
    }
  }

  try {
    return body ? JSON.parse(body) : {};
  } catch {
    const error = new Error("invalid_json");
    error.status = 400;
    throw error;
  }
};

const getBearerToken = (req) => {
  const authorization = req.headers.authorization || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || "";
};

const verifyUser = async (req) => {
  const token = getBearerToken(req);
  if (!token) {
    const error = new Error("missing_bearer_token");
    error.status = 401;
    throw error;
  }

  if (!config.supabaseUrl || !config.supabaseAnonKey) {
    return { id: "authenticated", token };
  }

  const response = await fetch(new URL("/auth/v1/user", config.supabaseUrl), {
    headers: {
      apikey: config.supabaseAnonKey,
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = new Error("invalid_supabase_session");
    error.status = 401;
    throw error;
  }

  const user = await response.json();
  if (!user?.id) {
    const error = new Error("invalid_supabase_user");
    error.status = 401;
    throw error;
  }

  return { id: user.id, token };
};

const buildSupabaseAdminHeaders = () => {
  if (!config.supabaseUrl || !config.supabaseServiceRoleKey) {
    throw new Error("missing_SUPABASE_SERVICE_ROLE_KEY");
  }

  return {
    apikey: config.supabaseServiceRoleKey,
    Authorization: `Bearer ${config.supabaseServiceRoleKey}`,
    "Content-Type": "application/json",
  };
};

const deleteSupabaseRows = async (table, filters) => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    params.set(key, `eq.${value}`);
  });

  const response = await fetch(`${config.supabaseUrl.replace(/\/$/, "")}/rest/v1/${table}?${params.toString()}`, {
    method: "DELETE",
    headers: buildSupabaseAdminHeaders(),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(`${table}.delete_failed:${payload?.message ?? response.status}`);
  }
};
const CHAT_REPLAY_CONTEXT_LIMIT = Number(process.env.CHAT_REPLAY_CONTEXT_LIMIT || 12);

const normalizeReplayContextContent = (content) => {
  if (typeof content !== "string") return "";
  return content.trim();
};

const fetchReplayContextMessages = async ({ sessionId, currentMessageText, limit = CHAT_REPLAY_CONTEXT_LIMIT }) => {
  if (!config.supabaseUrl || !config.supabaseServiceRoleKey) return [];

  const params = new URLSearchParams({
    session_id: `eq.${sessionId}`,
    select: "id,role,content,created_at",
    order: "created_at.desc,id.desc",
    limit: String(Math.max(1, limit + 2)),
  });

  const response = await fetch(`${config.supabaseUrl.replace(/\/$/, "")}/rest/v1/chat_messages?${params.toString()}`, {
    headers: buildSupabaseAdminHeaders(),
  });
  const rows = await response.json().catch(() => []);
  if (!response.ok || !Array.isArray(rows)) {
    throw new Error(`chat_messages.fetch_failed:${response.status}`);
  }

  const currentText = String(currentMessageText ?? "").trim();
  let skippedCurrentMessage = false;
  return rows
    .filter((row) => {
      const role = row?.role === "assistant" ? "assistant" : row?.role === "user" ? "user" : "";
      const messageText = normalizeReplayContextContent(row?.content);
      if (!role || !messageText) return false;
      if (!skippedCurrentMessage && role === "user" && currentText && messageText === currentText) {
        skippedCurrentMessage = true;
        return false;
      }
      return true;
    })
    .slice(0, limit)
    .reverse()
    .map((row) => ({
      role: row.role === "assistant" ? "assistant" : "user",
      messageText: normalizeReplayContextContent(row.content),
      attachments: [],
    }));
};


const assertChatSessionOwner = async ({ sessionId, userId }) => {
  const params = new URLSearchParams({
    id: `eq.${sessionId}`,
    user_id: `eq.${userId}`,
    select: "id",
  });
  const response = await fetch(`${config.supabaseUrl.replace(/\/$/, "")}/rest/v1/chat_sessions?${params.toString()}`, {
    headers: buildSupabaseAdminHeaders(),
  });
  const rows = await response.json().catch(() => []);
  if (!response.ok || !Array.isArray(rows) || rows.length === 0) {
    const error = new Error("chat_session_not_found");
    error.status = 404;
    throw error;
  }
};

const deleteChatSessionData = async ({ sessionId, userId }) => {
  await assertChatSessionOwner({ sessionId, userId });
  await deleteSupabaseRows("chat_messages", { session_id: sessionId });
  await deleteSupabaseRows("chat_sessions", { id: sessionId, user_id: userId });
};

const validateChatPayload = (payload) => {
  const sessionId = typeof payload.session_id === "string" ? payload.session_id.trim() : "";
  const messageText = typeof payload.message_text === "string" ? payload.message_text.trim() : "";
  const attachments = Array.isArray(payload.attachments) ? payload.attachments : [];

  if (!sessionId) {
    const error = new Error("missing_session_id");
    error.status = 400;
    throw error;
  }

  if (!messageText && attachments.length === 0) {
    const error = new Error("empty_message");
    error.status = 400;
    throw error;
  }

  return { session_id: sessionId, message_text: messageText, attachments };
};

class RunStore {
  constructor({ dataDir }) {
    this.dataDir = dataDir;
    this.runs = new Map();
    this.subscribers = new Map();
  }

  async init() {
    await mkdir(this.runsDir, { recursive: true });
    const files = await readdir(this.runsDir).catch(() => []);
    await Promise.all(files.filter((file) => file.endsWith(".json")).map(async (file) => {
      const raw = await readFile(path.join(this.runsDir, file), "utf8").catch(() => "");
      if (!raw) return;
      try {
        const run = JSON.parse(raw);
        if (!run?.id) return;
        if (!Array.isArray(run.events)) run.events = [];
        if (!Array.isArray(run.files)) run.files = [];
        if (!Array.isArray(run.attachments)) run.attachments = [];
        if (!terminalStatuses.has(run.status)) {
          run.status = "interrupted";
          run.error_message = "Bridge reiniciou antes do run terminar.";
          run.updated_at = nowIso();
        }
        this.runs.set(run.id, run);
        await this.persist(run);
      } catch {
        // ignore corrupted run snapshots
      }
    }));
  }

  get runsDir() {
    return path.join(this.dataDir, "runs");
  }

  get(id) {
    return this.runs.get(id) || null;
  }

  async persist(run) {
    await mkdir(this.runsDir, { recursive: true });
    await writeFile(path.join(this.runsDir, `${run.id}.json`), JSON.stringify(run, null, 2));
  }

  async save(run) {
    run.updated_at = nowIso();
    this.runs.set(run.id, run);
    await this.persist(run);
    this.notify(run.id);
  }

  subscribe(runId, res, { closeOnTerminal = false, startIndex = 0 } = {}) {
    const run = this.get(runId);
    if (!run) return null;

    const subscriber = {
      res,
      index: Math.max(0, Number.isInteger(startIndex) ? startIndex : 0),
      closeOnTerminal,
      closed: false,
    };

    const set = this.subscribers.get(runId) ?? new Set();
    set.add(subscriber);
    this.subscribers.set(runId, set);

    const cleanup = () => {
      subscriber.closed = true;
      set.delete(subscriber);
      if (set.size === 0) this.subscribers.delete(runId);
    };

    res.on("close", cleanup);
    this.flushSubscriber(runId, subscriber);
    return cleanup;
  }

  notify(runId) {
    const subscribers = this.subscribers.get(runId);
    if (!subscribers) return;
    subscribers.forEach((subscriber) => this.flushSubscriber(runId, subscriber));
  }

  flushSubscriber(runId, subscriber) {
    if (subscriber.closed) return;
    const run = this.get(runId);
    if (!run) return;

    while (subscriber.index < run.events.length) {
      const event = run.events[subscriber.index];
      subscriber.res.write(emitSse(event.event, event.data));
      subscriber.index += 1;
    }

    if (terminalStatuses.has(run.status) && subscriber.closeOnTerminal) {
      subscriber.res.end();
      subscriber.closed = true;
    }
  }
}

class HermesBridge {
  constructor({ store, hermesStateRepository }) {
    this.store = store;
    this.hermesStateRepository = hermesStateRepository;
  }

  async createRun({ user, payload }) {
    const validated = validateChatPayload(payload);
    const preparedAttachments = await prepareHermesAttachments({
      attachments: validated.attachments,
      userId: user.id,
      sessionId: validated.session_id,
      supabaseUrl: config.supabaseUrl,
      supabaseAnonKey: config.supabaseAnonKey,
      supabaseServiceRoleKey: config.supabaseServiceRoleKey,
      userToken: user.token,
      bucket: config.attachmentBucket,
    });
    const useResponsesApi = shouldUseResponsesApi(preparedAttachments);
    const replayContextMessages = await fetchReplayContextMessages({
      sessionId: validated.session_id,
      currentMessageText: validated.message_text,
    });
    const run = {
      id: randomUUID(),
      user_id: user.id,
      chat_session_id: validated.session_id,
      hermes_session_id: buildHermesRunSessionId(validated.session_id),
      hermes_run_id: null,
      hermes_response_id: null,
      hermes_conversation_id: null,
      mode: useResponsesApi ? "responses" : "runs",
      status: "queued",
      message_text: validated.message_text,
      input: "",
      attachments: preparedAttachments,
      replay_context_messages: replayContextMessages,
      output_text: "",
      files: [],
      events: [
        {
          event: "meta",
          data: {
            provider: "hermes",
            event: "bridge.run.accepted",
            run_id: null,
            bridge_run_id: null,
            mode: useResponsesApi ? "responses" : "runs",
          },
        },
      ],
      error_message: null,
      created_at: nowIso(),
      updated_at: nowIso(),
    };
    run.events[0].data.bridge_run_id = run.id;

    await this.store.save(run);
    queueMicrotask(() => {
      this.executeRun(run.id).catch(async (error) => {
        await this.failRun(run.id, error);
      });
    });

    return run;
  }

  appendEvent(run, event) {
    run.events.push(event);
    if (event.event === "delta" && typeof event.data?.delta === "string") {
      run.output_text += event.data.delta;
    }
    if (event.event === "files" && Array.isArray(event.data?.files)) {
      const seen = new Set(run.files.map((file) => file.url));
      event.data.files.forEach((file) => {
        if (!seen.has(file.url)) {
          seen.add(file.url);
          run.files.push(file);
        }
      });
    }
  }

  async appendEvents(run, events) {
    events.forEach((event) => this.appendEvent(run, event));
    await this.store.save(run);
  }

  async failRun(runId, error) {
    const run = this.store.get(runId);
    if (!run || terminalStatuses.has(run.status)) return;
    run.status = "failed";
    run.error_message = error instanceof Error ? error.message : String(error);
    this.appendEvent(run, { event: "error", data: run.error_message });
    this.appendEvent(run, { event: "done", data: { request_id: run.id } });
    await this.store.save(run);
  }

  async ensureHermesSessionBinding(run, hermesBaseUrl, { createIfMissing = true } = {}) {
    let state = await ensureHermesConversationState({
      repository: this.hermesStateRepository,
      chatSessionId: run.chat_session_id,
      userId: run.user_id,
    });

    if (state.hermes_session_id || !config.hermesSessionsApiEnabled || !createIfMissing) {
      return state;
    }

    try {
      const session = await createHermesSession({
        hermesBaseUrl,
        hermesApiKey: config.hermesApiKey,
        sessionId: run.hermes_session_id || buildHermesRunSessionId(run.chat_session_id),
        title: `Nexus ${run.chat_session_id}`,
      });
      state = await bindHermesSessionToState({
        repository: this.hermesStateRepository,
        state,
        hermesSessionId: session.id,
      });
    } catch (error) {
      if (!isHermesSessionApiUnavailableError(error)) {
        throw error;
      }
    }

    return state;
  }

  buildHermesHeaders(accept, run) {
    return {
      "Content-Type": "application/json",
      Accept: accept,
      "Cache-Control": "no-cache",
      "User-Agent": "NexusHermesBridge/1.0",
      "X-Request-Id": run.id,
      "X-Hermes-Session-Id": run.hermes_session_id,
      "X-Hermes-Session-Key": buildHermesSessionKey({
        userId: run.user_id,
        sessionId: run.chat_session_id,
      }),
      "X-Nexus-User-Id": run.user_id,
      "X-Nexus-Session-Id": run.chat_session_id,
      ...(config.hermesApiKey ? { Authorization: `Bearer ${config.hermesApiKey}` } : {}),
    };
  }

  async createHermesRun(run, hermesBaseUrl) {
    const requestPayload = buildHermesRunRequest({
      sessionId: run.hermes_session_id,
      messageText: run.message_text,
      attachments: run.attachments,
      replayContextMessages: run.replay_context_messages,
    });
    run.input = requestPayload.input;

    const response = await fetch(new URL("/v1/runs", hermesBaseUrl.origin), {
      method: "POST",
      headers: this.buildHermesHeaders("application/json", run),
      body: JSON.stringify(requestPayload),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload?.message || payload?.error || `hermes_run_create_failed:${response.status}`);
    }

    const hermesRunId =
      typeof payload.run_id === "string"
        ? payload.run_id
        : typeof payload.id === "string"
          ? payload.id
          : "";

    if (!hermesRunId) {
      throw new Error("hermes_run_create_missing_run_id");
    }

    return hermesRunId;
  }

  async fetchHermesEvents(run, hermesBaseUrl) {
    return await fetch(new URL(`/v1/runs/${encodeURIComponent(run.hermes_run_id)}/events`, hermesBaseUrl.origin), {
      headers: this.buildHermesHeaders("text/event-stream", run),
    });
  }

  async pollHermesStatus(run, hermesBaseUrl) {
    const response = await fetch(new URL(`/v1/runs/${encodeURIComponent(run.hermes_run_id)}`, hermesBaseUrl.origin), {
      headers: this.buildHermesHeaders("application/json", run),
    });
    if (!response.ok) return false;

    const payload = await response.json().catch(() => ({}));
    const parsed = parseHermesStatusPayload(payload, {
      requestId: run.id,
      runId: run.hermes_run_id,
      sessionId: run.hermes_session_id,
      conversation: run.hermes_conversation_id,
      streamedText: run.output_text,
    });

    if (!parsed.terminal || !parsed.parsed) return false;
    await this.applyParsedResult(run, parsed.parsed);
    return true;
  }

  async consumeEventsResponse(run, response, options = {}) {
    if (!response.ok || !response.body) return "open";

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value) continue;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          const outcome = await this.parseAndApplyEventBlock(run, part, options);
          if (outcome === "terminal" || outcome === "retry") return outcome;
        }
      }

      if (buffer.trim()) {
        const outcome = await this.parseAndApplyEventBlock(run, buffer, options);
        buffer = "";
        if (outcome === "terminal" || outcome === "retry") return outcome;
      }

      return "open";
    } finally {
      try {
        reader.releaseLock();
      } catch {
        // ignore reader release errors
      }
    }
  }

  async parseAndApplyEventBlock(run, eventBlock, options = {}) {
    const parsed = parseHermesEventBlock(eventBlock, {
      requestId: run.id,
      runId: run.hermes_run_id,
      sessionId: run.hermes_session_id,
      conversation: run.hermes_conversation_id,
      streamedText: run.output_text,
    });

    if (options.shouldRetryParsed?.(parsed)) {
      return "retry";
    }

    await this.applyParsedResult(run, parsed, options);
    return parsed.completed || parsed.failed ? "terminal" : "open";
  }

  async applyParsedResult(run, parsed, options = {}) {
    if (parsed.events.length > 0) {
      await this.appendEvents(run, parsed.events);
    }
    if (parsed.responseId) {
      run.hermes_response_id = parsed.responseId;
    }
    if (options.onParsed) {
      await options.onParsed(parsed);
    }
    if (parsed.completed) {
      run.status = "completed";
      await this.store.save(run);
    }
    if (parsed.failed) {
      run.status = "failed";
      await this.store.save(run);
    }
  }

  async executeRunsApi(run, hermesBaseUrl) {
    run.hermes_run_id = await this.createHermesRun(run, hermesBaseUrl);
    this.appendEvent(run, {
      event: "meta",
      data: {
        provider: "hermes",
        event: "run.created",
        run_id: run.hermes_run_id,
        session_id: run.hermes_session_id,
      },
    });
    await this.store.save(run);

    while (!terminalStatuses.has(run.status)) {
      const eventsResponse = await this.fetchHermesEvents(run, hermesBaseUrl);
      const stoppedByEvents = await this.consumeEventsResponse(run, eventsResponse);
      if (stoppedByEvents === "terminal" || terminalStatuses.has(run.status)) break;

      const stoppedByStatus = await this.pollHermesStatus(run, hermesBaseUrl);
      if (stoppedByStatus || terminalStatuses.has(run.status)) break;

      this.appendEvent(run, { event: "status", data: { text: "Hermes segue executando a tarefa...", tone: "info" } });
      await this.store.save(run);
      await wait(config.hermesPollMs);
    }

    if (run.status === "completed" && !run.events.some((event) => event.event === "done")) {
      this.appendEvent(run, { event: "done", data: { request_id: run.id } });
      await this.store.save(run);
    }
  }

  async fetchHermesResponse(run, hermesBaseUrl, routingState, imageTransport) {
    const requestPayload = buildHermesResponsesRequest({
      modelName: config.hermesModelName,
      userId: run.user_id,
      sessionId: run.chat_session_id,
      messageText: run.message_text,
      attachments: run.attachments,
      replayContextMessages: run.replay_context_messages,
      conversationId: routingState.conversationId,
      previousResponseId: routingState.previousResponseId,
      imageTransport,
    });
    run.input = JSON.stringify(requestPayload.input);

    return await fetch(new URL("/v1/responses", hermesBaseUrl.origin), {
      method: "POST",
      headers: this.buildHermesHeaders("text/event-stream", run),
      body: JSON.stringify(requestPayload),
    });
  }

  async executeResponsesApi(run, hermesBaseUrl, initialState) {
    let state = initialState;
    let routingState = buildHermesResponseRoutingState({ state });
    run.hermes_conversation_id = routingState.conversationId;
    const hasImageAttachments = run.attachments.some((attachment) => isImageAttachment(attachment));
    let imageTransport = "inline";
    let attemptedRemoteImage = false;

    while (!terminalStatuses.has(run.status)) {
      const response = await this.fetchHermesResponse(run, hermesBaseUrl, routingState, imageTransport);
      if (!response.ok || !response.body) {
        if (hasImageAttachments && !attemptedRemoteImage) {
          attemptedRemoteImage = true;
          imageTransport = "remote";
          this.appendEvent(run, {
            event: "status",
            data: { text: "Hermes vai tentar ler a imagem por URL segura.", tone: "warning" },
          });
          await this.store.save(run);
          continue;
        }
        const body = await response.text().catch(() => "");
        throw new Error(body.trim() || `hermes_responses_failed:${response.status}`);
      }

      state = await bindHermesSessionFromResponse({
        repository: this.hermesStateRepository,
        state,
        run,
        response,
      });
      routingState = buildHermesResponseRoutingState({ state });

      const result = await this.consumeEventsResponse(run, response, {
        shouldRetryParsed: (parsed) => (
          parsed.failed &&
          hasImageAttachments &&
          !attemptedRemoteImage &&
          !parsed.streamedText?.trim()
        ),
        onParsed: async (parsed) => {
          if (parsed.recoveredFromFailure && parsed.responseId) {
            state = await markHermesResponseRecovered({
              repository: this.hermesStateRepository,
              state,
              responseId: parsed.responseId,
              errorCode: parsed.errorCode ?? "hermes_recovered_failure",
            });
            routingState = buildHermesResponseRoutingState({ state });
            return;
          }

          if (parsed.completed && parsed.responseId) {
            state = await markHermesResponseCompleted({
              repository: this.hermesStateRepository,
              state,
              responseId: parsed.responseId,
            });
            routingState = buildHermesResponseRoutingState({ state });
            return;
          }

          if (parsed.failed) {
            state = await markHermesChainDegraded({
              repository: this.hermesStateRepository,
              state,
              errorCode: parsed.errorCode ?? "hermes_response_failed",
            });
            routingState = buildHermesResponseRoutingState({ state });
          }
        },
      });

      if (result === "retry") {
        attemptedRemoteImage = true;
        imageTransport = "remote";
        run.output_text = "";
        this.appendEvent(run, {
          event: "status",
          data: { text: "Hermes vai tentar ler a imagem por URL segura.", tone: "warning" },
        });
        await this.store.save(run);
        continue;
      }

      if (result === "terminal" || terminalStatuses.has(run.status)) break;
      throw new Error("hermes_responses_stream_closed_without_terminal_event");
    }
  }

  async executeRun(runId) {
    const hermesBaseUrl = normalizeBaseUrl(config.hermesBaseUrl);
    if (!hermesBaseUrl) {
      throw new Error("missing_or_invalid_HERMES_API_BASE_URL");
    }

    const run = this.store.get(runId);
    if (!run) return;

    const state = await this.ensureHermesSessionBinding(run, hermesBaseUrl, {
      createIfMissing: run.mode !== "responses",
    });
    run.hermes_session_id = state.hermes_session_id || buildHermesRunSessionId(run.chat_session_id);
    run.hermes_conversation_id = state.hermes_conversation_id;
    run.status = "running";
    this.appendEvent(run, { event: "status", data: { text: "Hermes iniciou a tarefa.", tone: "info" } });
    await this.store.save(run);

    if (run.mode === "responses") {
      await this.executeResponsesApi(run, hermesBaseUrl, state);
    } else {
      await this.executeRunsApi(run, hermesBaseUrl);
    }
  }
}

const store = new RunStore({ dataDir: config.dataDir });
const hermesStateRepository = config.supabaseUrl && config.supabaseServiceRoleKey
  ? createSupabaseHermesStateRepository({
      supabaseUrl: config.supabaseUrl,
      supabaseServiceRoleKey: config.supabaseServiceRoleKey,
    })
  : createMemoryHermesStateRepository();
const bridge = new HermesBridge({ store, hermesStateRepository });

const writeSseHeaders = (req, res) => {
  res.writeHead(200, {
    ...getCorsHeaders(req),
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
};

const handleRequest = async (req, res) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    res.writeHead(204, corsHeaders);
    res.end();
    return;
  }

  const url = new URL(req.url || "/", "http://localhost");

  if (req.method === "GET" && url.pathname === "/health") {
    jsonResponse(res, 200, {
      ok: true,
      service: "nexus-hermes-bridge",
      hermesConfigured: Boolean(normalizeBaseUrl(config.hermesBaseUrl)),
      supabaseStorageConfigured: Boolean(config.supabaseUrl && (config.supabaseServiceRoleKey || config.supabaseAnonKey)),
      supabaseStateConfigured: Boolean(config.supabaseUrl && config.supabaseServiceRoleKey),
      attachmentBucket: config.attachmentBucket,
    }, corsHeaders);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/chat/session/delete") {
    const user = await verifyUser(req);
    const payload = await readJsonBody(req);
    const sessionId = typeof payload.session_id === "string" ? payload.session_id.trim() : "";
    if (!sessionId) {
      jsonResponse(res, 400, { error: "missing_session_id" }, corsHeaders);
      return;
    }

    const state = await hermesStateRepository.get(sessionId, user.id).catch(() => null);
    const hermesBaseUrl = normalizeBaseUrl(config.hermesBaseUrl);
    if (state?.hermes_session_id && hermesBaseUrl) {
      try {
        await deleteHermesSession({
          hermesBaseUrl,
          hermesApiKey: config.hermesApiKey,
          hermesSessionId: state.hermes_session_id,
        });
      } catch {
        // Best effort: local deletion must not depend on Hermes being reachable.
      }
    }

    await hermesStateRepository.delete(sessionId, user.id).catch(() => {});
    await deleteChatSessionData({ sessionId, userId: user.id });
    jsonResponse(res, 200, { ok: true }, corsHeaders);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/chat/runs") {
    const user = await verifyUser(req);
    const payload = await readJsonBody(req);
    const run = await bridge.createRun({ user, payload });
    jsonResponse(res, 202, { run }, corsHeaders);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/chat/stream") {
    const user = await verifyUser(req);
    const payload = await readJsonBody(req);
    const run = await bridge.createRun({ user, payload });
    writeSseHeaders(req, res);
    store.subscribe(run.id, res, { closeOnTerminal: true });
    return;
  }

  const runMatch = url.pathname.match(/^\/api\/chat\/runs\/([^/]+)(?:\/events)?$/);
  if (runMatch && req.method === "GET") {
    const user = await verifyUser(req);
    const runId = decodeURIComponent(runMatch[1]);
    const run = store.get(runId);
    if (!run || run.user_id !== user.id) {
      jsonResponse(res, 404, { error: "run_not_found" }, corsHeaders);
      return;
    }

    if (url.pathname.endsWith("/events")) {
      writeSseHeaders(req, res);
      const cursor = Number(url.searchParams.get("cursor") ?? "0");
      store.subscribe(run.id, res, {
        closeOnTerminal: true,
        startIndex: Number.isFinite(cursor) ? Math.max(0, Math.floor(cursor)) : 0,
      });
      return;
    }

    jsonResponse(res, 200, { run }, corsHeaders);
    return;
  }

  jsonResponse(res, 404, { error: "not_found" }, corsHeaders);
};

await store.init();

const server = createServer((req, res) => {
  handleRequest(req, res).catch((error) => {
    const status = Number.isInteger(error.status) ? error.status : 500;
    jsonResponse(res, status, {
      error: error.message || "internal_error",
    }, getCorsHeaders(req));
  });
});

server.listen(config.port, "0.0.0.0", () => {
  console.log(JSON.stringify({
    service: "nexus-hermes-bridge",
    status: "listening",
    port: config.port,
    hermesConfigured: Boolean(normalizeBaseUrl(config.hermesBaseUrl)),
  }));
});
