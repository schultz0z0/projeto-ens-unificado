import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { materializeHermesAttachments, type PreparedAttachment, isImageAttachment } from "./attachmentTransport.ts"
import { resolveAttachmentForUser } from "./attachmentResolver.ts"
import { parseAllowedOrigins, resolveAllowedOrigin } from "./cors.ts"
import { validateHermesBaseUrl } from "./hermesBaseUrlPolicy.ts"
import { assertHermesCapabilities, buildHermesSessionKey } from "./hermesCapabilities.ts"
import { parseHermesRunEventBlock } from "./hermesRunEventParser.ts"
import { parseHermesRunStatusPayload } from "./hermesRunStatus.ts"
import { buildHermesRunRequest, buildHermesRunSessionId } from "./hermesRunsAdapter.ts"
import { buildHermesResponsesRequest } from "./hermesResponsesAdapter.ts"
import { parseHermesEventBlock } from "./hermesStreamEventParser.ts"
import { resolveHermesStreamTiming } from "./hermesStreamTiming.ts"
import { extractReplayContextFromHistory, type ReplayContextMessage } from "./multimodalContextMemory.ts"
import {
  bindHermesSessionToState,
  createSupabaseHermesConversationStateRepository,
  markHermesChainDegraded,
  markHermesChainRecovering,
  markHermesResponseCompleted,
  markHermesResponseRecovered,
} from "./hermesConversationState.ts"
import { buildHermesRecoveryPlan } from "./hermesRecoveryStrategy.ts"
import { createHermesSession, deleteHermesSession } from "./hermesSessionsClient.ts"
import { buildHermesResponseRoutingState, ensureHermesSessionBinding } from "./proxyHermesSessionBinding.ts"
import {
  buildHermesInput,
  buildHermesPdfFallbackInput,
  proxyChatRequestSchema,
} from "./multimodalPayload.ts"

const textEncoder = new TextEncoder()
const HERMES_RUN_STATUS_POLL_MS = 2000

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const resolveRequestOrigin = (origin: string | null) => {
  const allowedOrigins = parseAllowedOrigins(Deno.env.get('ALLOWED_ORIGINS'))
  if (allowedOrigins.includes('*')) return '*'
  return resolveAllowedOrigin(origin, allowedOrigins)
}

const getCorsHeaders = (req: Request) => {
  const origin = req.headers.get('Origin')
  const allowOrigin = resolveRequestOrigin(origin)
  const allowAll = allowOrigin === '*'

  return {
    ...(allowAll ? { 'Access-Control-Allow-Origin': '*' } : (allowOrigin ? { 'Access-Control-Allow-Origin': allowOrigin, Vary: 'Origin' } : {})),
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, accept',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Expose-Headers': 'X-Request-Id',
  }
}

const json = (payload: unknown, init: ResponseInit & { headers?: HeadersInit } = {}) => {
  const headers = new Headers(init.headers)
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  return new Response(JSON.stringify(payload), { ...init, headers })
}

const isProd = () => {
  const env = (Deno.env.get('SUPABASE_ENV') ?? Deno.env.get('DENO_ENV') ?? '').toLowerCase()
  return env === 'prod' || env === 'production'
}

const assertAllowedOrigin = (req: Request, cors: HeadersInit) => {
  const origin = req.headers.get('Origin')

  if (origin && !resolveRequestOrigin(origin)) {
    return json({ error: 'forbidden_origin' }, { status: 403, headers: cors })
  }

  return null
}

const resolveHermesBaseUrl = (
  config: { hermes_enabled?: boolean | null; hermes_base_url?: string | null } | null,
) => {
  const defaultBaseUrl = Deno.env.get('HERMES_DEFAULT_BASE_URL') ?? ''
  const candidate =
    config?.hermes_enabled && config.hermes_base_url
      ? config.hermes_base_url
      : defaultBaseUrl

  return validateHermesBaseUrl(candidate, Deno.env.get('HERMES_ALLOWED_HOSTS'), defaultBaseUrl)
}

const emitSse = (event: string, data: unknown) => {
  const serialized = typeof data === 'string' ? data : JSON.stringify(data)
  return textEncoder.encode(`event: ${event}\ndata: ${serialized}\n\n`)
}

const buildSseHeaders = (cors: HeadersInit, requestId: string) => {
  const headers = new Headers(cors)
  headers.set('Content-Type', 'text/event-stream; charset=utf-8')
  headers.set('Cache-Control', 'no-cache, no-transform')
  headers.set('Connection', 'keep-alive')
  headers.set('X-Accel-Buffering', 'no')
  headers.set('Content-Encoding', 'none')
  headers.set('X-Request-Id', requestId)
  return headers
}

const startStreamHeartbeat = (
  streamController: ReadableStreamDefaultController<Uint8Array>,
  heartbeatMs: number,
) => {
  if (heartbeatMs <= 0) return () => {}

  let stopped = false
  const intervalId = setInterval(() => {
    if (stopped) return
    try {
      streamController.enqueue(emitSse('status', {
        text: 'Hermes ainda está trabalhando na tarefa...',
        tone: 'info',
      }))
    } catch {
      stopped = true
      clearInterval(intervalId)
    }
  }, heartbeatMs)

  return () => {
    stopped = true
    clearInterval(intervalId)
  }
}

const getSubPath = (reqUrl: string) => {
  const url = new URL(reqUrl)
  const pathname = url.pathname
  const marker = '/proxy-chatbot'
  const idx = pathname.lastIndexOf(marker)
  if (idx === -1) return null
  const rest = pathname.slice(idx + marker.length)
  return rest.length === 0 ? '/' : rest
}

const parseDeleteSessionPayload = (rawBody: unknown) => {
  if (!rawBody || typeof rawBody !== 'object' || Array.isArray(rawBody)) return null
  const sessionId = 'session_id' in rawBody && typeof rawBody.session_id === 'string'
    ? rawBody.session_id.trim()
    : ''

  if (!sessionId) return null

  return {
    session_id: sessionId,
  }
}

const prepareHermesAttachments = async ({
  supabaseAdmin,
  attachments,
  userId,
  sessionId,
}: {
  supabaseAdmin: ReturnType<typeof createClient>
  attachments: typeof proxyChatRequestSchema._type.attachments
  userId: string
  sessionId: string
}): Promise<PreparedAttachment[]> => {
  return await Promise.all(
    attachments.map((attachment) =>
      resolveAttachmentForUser({
        supabaseAdmin,
        attachment,
        userId,
        sessionId,
      })
    ),
  )
}

const loadReplayContextMessages = async ({
  supabaseAdmin,
  sessionId,
  currentTurnStoragePaths,
}: {
  supabaseAdmin: ReturnType<typeof createClient>
  sessionId: string
  currentTurnStoragePaths: string[]
}): Promise<ReplayContextMessage[]> => {
  const { data, error } = await supabaseAdmin
    .from('chat_messages')
    .select('role, content, created_at')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
    .limit(12)

  if (error) {
    throw new Error(`chat_messages.replay_lookup_failed:${error.message}`)
  }

  return extractReplayContextFromHistory({
    messages: (data ?? []) as Array<{ role: 'user' | 'assistant'; content: string; created_at: string }>,
    currentTurnStoragePaths,
    maxMessages: 2,
    maxAttachments: 4,
  })
}

const getPdfFallbackFiles = (attachments: PreparedAttachment[]) =>
  attachments
    .filter((attachment) => attachment.mime_type === 'application/pdf' && attachment.extracted_text)
    .map((attachment) => ({
      name: attachment.name,
      extractedText: attachment.extracted_text as string,
    }))

const getSseEventName = (eventBlock: string) => {
  const eventLine = eventBlock
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.startsWith('event:'))

  return eventLine ? eventLine.slice('event:'.length).trim() : 'message'
}

const looksLikeHermesInternalErrorText = (text: string) => {
  const normalized = text.trim().replace(/^['"]+|['"]+$/g, '').toLowerCase()
  if (!normalized) return false

  return (
    normalized === 'nonetype object is not iterable' ||
    normalized.includes('unsupported_content_type') ||
    normalized.startsWith('traceback') ||
    normalized.includes('server error')
  )
}

serve(async (req) => {
  const cors = getCorsHeaders(req)
  const requestId = crypto.randomUUID()
  let debugStage = 'request:init'

  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const originCheck = assertAllowedOrigin(req, cors)
  if (originCheck) return originCheck

  if (req.method !== 'POST') {
    return json({ error: 'method_not_allowed', request_id: requestId }, { status: 405, headers: cors })
  }

  const contentLength = Number(req.headers.get('content-length') ?? '0')
  if (Number.isFinite(contentLength) && contentLength > 20_000) {
    return json({ error: 'payload_too_large', request_id: requestId }, { status: 413, headers: cors })
  }

  try {
    debugStage = 'env:read'
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const hermesApiKey = (Deno.env.get('HERMES_API_KEY') ?? '').trim()

    if (!supabaseServiceRoleKey) throw new Error('missing_env:SUPABASE_SERVICE_ROLE_KEY')
    if (!hermesApiKey) throw new Error('missing_env:HERMES_API_KEY')

    debugStage = 'routing:resolve_sub_path'
    const subPath = getSubPath(req.url)
    if (subPath !== '/api/chat/stream' && subPath !== '/api/chat/session/delete') {
      return json({ error: 'not_found', request_id: requestId }, { status: 404, headers: cors })
    }

    debugStage = 'request:parse_json'
    const rawBody = await req.json().catch(() => null)
    if (rawBody === null || typeof rawBody !== 'object' || Array.isArray(rawBody)) {
      return json({ error: 'invalid_payload', request_id: requestId }, { status: 400, headers: cors })
    }

    debugStage = 'auth:get_user'
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    })
    const { data: userData, error: userErr } = await supabase.auth.getUser()
    if (userErr || !userData?.user) {
      return json({ error: 'unauthorized', request_id: requestId }, { status: 401, headers: cors })
    }

    debugStage = 'supabase:create_admin_client'
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey)
    const hermesStateRepository = createSupabaseHermesConversationStateRepository(supabaseAdmin)
    if (subPath === '/api/chat/session/delete') {
      debugStage = 'delete:parse_payload'
      const deletePayload = parseDeleteSessionPayload(rawBody)
      if (!deletePayload) {
        return json({ error: 'invalid_payload', request_id: requestId }, { status: 400, headers: cors })
      }

      debugStage = 'delete:load_state'
      const hermesState = await hermesStateRepository.get(deletePayload.session_id, userData.user.id)
      if (hermesState?.hermes_session_id) {
        try {
          debugStage = 'delete:load_integration'
          const { data: deleteIntegration } = await supabaseAdmin
            .from('user_chat_integrations')
            .select('hermes_enabled, hermes_base_url')
            .eq('user_id', userData.user.id)
            .maybeSingle()

          debugStage = 'delete:resolve_hermes_base_url'
          const deleteHermesBaseUrl = resolveHermesBaseUrl(deleteIntegration)
          debugStage = 'delete:remote_cleanup'
          await deleteHermesSession({
            hermesBaseUrl: deleteHermesBaseUrl,
            hermesApiKey,
            hermesSessionId: hermesState.hermes_session_id,
          })
        } catch {
          // best effort cleanup: a conversa local nao deve depender da disponibilidade do Hermes
        }
      }

      debugStage = 'delete:remove_chat_session'
      const { error: deleteChatError } = await supabaseAdmin
        .from('chat_sessions')
        .delete()
        .eq('id', deletePayload.session_id)
        .eq('user_id', userData.user.id)

      if (deleteChatError) {
        return json(
          { error: 'chat_session_delete_failed', request_id: requestId, message: deleteChatError.message },
          { status: 500, headers: cors },
        )
      }

      return json({ ok: true, request_id: requestId }, { status: 200, headers: cors })
    }

    debugStage = 'integration:lookup_user'
    const { data: userIntegration, error: integrationError } = await supabaseAdmin
      .from('user_chat_integrations')
      .select('hermes_enabled, hermes_base_url')
      .eq('user_id', userData.user.id)
      .maybeSingle()

    if (integrationError) {
      return json(
        { error: 'integration_lookup_failed', request_id: requestId, message: integrationError.message },
        { status: 500, headers: cors },
      )
    }

    debugStage = 'hermes:resolve_base_url'
    const hermesBaseUrl = resolveHermesBaseUrl(userIntegration)
    debugStage = 'hermes:capabilities'
    const hermesCapabilities = await assertHermesCapabilities({
      hermesBaseUrl,
      hermesApiKey,
    })

    debugStage = 'request:validate_stream_payload'
    const parsed = proxyChatRequestSchema.safeParse(rawBody)
    if (!parsed.success) {
      const issues = parsed.error.issues.map((issue) => ({ path: issue.path, code: issue.code, message: issue.message }))
      return json(
        { error: 'invalid_payload', request_id: requestId, ...(isProd() ? {} : { issues }) },
        { status: 400, headers: cors },
      )
    }

    debugStage = 'hermes:ensure_session_binding'
    let hermesState = await ensureHermesSessionBinding({
      repository: hermesStateRepository,
      chatSessionId: parsed.data.session_id,
      userId: userData.user.id,
      hermesBaseUrl,
      hermesApiKey,
      sessionsApiEnabled: hermesCapabilities.sessionsApi,
    })
    debugStage = 'hermes:build_session_key'
    const hermesSessionKey = buildHermesSessionKey({
      userId: userData.user.id,
      sessionId: parsed.data.session_id,
    })
    const upstreamUrl = new URL('/v1/responses', hermesBaseUrl.origin)
    const { timeoutMs, heartbeatMs } = resolveHermesStreamTiming(Deno.env)
    debugStage = 'attachments:prepare'
    const preparedAttachments = await prepareHermesAttachments({
      supabaseAdmin,
      attachments: parsed.data.attachments,
      userId: userData.user.id,
      sessionId: parsed.data.session_id,
    })
    debugStage = 'attachments:load_replay_context'
    const replayContextMessages = parsed.data.attachments.length === 0
      ? await loadReplayContextMessages({
          supabaseAdmin,
          sessionId: parsed.data.session_id,
          currentTurnStoragePaths: parsed.data.attachments.map((attachment) => attachment.storage_path),
        })
      : []
    debugStage = 'attachments:prepare_replay_context'
    const preparedReplayContextMessages = await Promise.all(
      replayContextMessages.map(async (message) => ({
        messageText: message.messageText,
        attachments: await prepareHermesAttachments({
          supabaseAdmin,
          attachments: message.attachments,
          userId: userData.user.id,
          sessionId: parsed.data.session_id,
        }),
      })),
    )
    debugStage = 'hermes:build_request_payload'
    const activePreparedAttachments = [
      ...preparedAttachments,
      ...preparedReplayContextMessages.flatMap((message) => message.attachments),
    ]
    const currentTurnAttachmentCount = preparedAttachments.length
    const replayAttachmentCount = preparedReplayContextMessages.reduce(
      (total, message) => total + message.attachments.length,
      0,
    )
    const hasImageAttachments = activePreparedAttachments.some((attachment) => isImageAttachment(attachment))
    const canUseRunsApi = hermesCapabilities.runsApi && activePreparedAttachments.every((attachment) => (
      !isImageAttachment(attachment) && Boolean(attachment.extracted_text?.trim())
    ))
    const pdfFallbackFiles = getPdfFallbackFiles(activePreparedAttachments)
    const materializeReplayContextMessages = (imageTransport: 'inline' | 'remote') =>
      preparedReplayContextMessages.map((message) => ({
        messageText: message.messageText,
        attachments: materializeHermesAttachments(message.attachments, imageTransport),
      }))
    const buildResponsesPayload = ({
      input,
      conversationId,
      previousResponseId,
      attachments,
    }: {
      input: ReturnType<typeof buildHermesInput> | ReturnType<typeof buildHermesPdfFallbackInput>
      conversationId: string
      previousResponseId?: string | null
      attachments: PreparedAttachment[]
    }) =>
      ({
        ...buildHermesResponsesRequest({
          userId: userData.user.id,
          sessionId: parsed.data.session_id,
          messageText: parsed.data.message_text,
          attachments: materializeHermesAttachments(attachments, 'inline'),
          replayContextMessages: materializeReplayContextMessages('inline'),
          conversationId,
          previousResponseId,
        }),
        input,
      })

    let routingState = buildHermesResponseRoutingState({ state: hermesState })
    const nativeRequestPayload = buildResponsesPayload({
      input: buildHermesInput({
        messageText: parsed.data.message_text,
        attachments: materializeHermesAttachments(preparedAttachments, 'inline'),
        replayContextMessages: materializeReplayContextMessages('inline'),
      }),
      conversationId: routingState.conversationId,
      previousResponseId: routingState.previousResponseId,
      attachments: preparedAttachments,
    })

    const controller = new AbortController()
    req.signal.addEventListener('abort', () => controller.abort(), { once: true })
    const timeoutId = timeoutMs > 0 ? setTimeout(() => controller.abort(), timeoutMs) : null
    const clearStreamTimeout = () => {
      if (timeoutId !== null) clearTimeout(timeoutId)
    }
    const buildHermesRequestHeaders = (accept: string) => ({
      'Content-Type': 'application/json',
      'Accept': accept,
      'Cache-Control': 'no-cache',
      'Authorization': `Bearer ${hermesApiKey}`,
      'X-Request-Id': requestId,
      [hermesCapabilities.sessionKeyHeader]: hermesSessionKey,
      'X-Hermes-Session-Id': routingState.hermesSessionId ?? parsed.data.session_id,
      'X-Nexus-User-Id': userData.user.id,
      'X-Nexus-Session-Id': parsed.data.session_id,
      'User-Agent': 'NexusAI-ProxyChatbot/2.0',
    })
    const fetchUpstream = async ({
      input,
      conversationId,
      previousResponseId,
      hermesSessionId,
    }: {
      input: ReturnType<typeof buildHermesInput> | ReturnType<typeof buildHermesPdfFallbackInput>
      conversationId: string
      previousResponseId?: string | null
      hermesSessionId: string | null
    }) =>
      await fetch(upstreamUrl, {
      method: 'POST',
      headers: {
        ...buildHermesRequestHeaders('text/event-stream'),
        'X-Hermes-Session-Id': hermesSessionId ?? parsed.data.session_id,
      },
      body: JSON.stringify(buildResponsesPayload({
        input,
        conversationId,
        previousResponseId,
        attachments: preparedAttachments,
      })),
      signal: controller.signal,
    })

    if (canUseRunsApi) {
      debugStage = 'hermes:runs_create'
      const runSessionId = buildHermesRunSessionId(parsed.data.session_id)
      const runCreateRes = await fetch(new URL('/v1/runs', hermesBaseUrl.origin), {
        method: 'POST',
        headers: {
          ...buildHermesRequestHeaders('application/json'),
          'X-Hermes-Session-Id': runSessionId,
        },
        body: JSON.stringify(buildHermesRunRequest({
          sessionId: runSessionId,
          messageText: parsed.data.message_text,
          attachments: preparedAttachments,
          replayContextMessages: preparedReplayContextMessages,
        })),
        signal: controller.signal,
      })

      if (runCreateRes.ok) {
        const runPayload = await runCreateRes.json().catch(() => ({})) as Record<string, unknown>
        const runId = typeof runPayload.run_id === 'string'
          ? runPayload.run_id
          : typeof runPayload.id === 'string'
            ? runPayload.id
            : null

        if (runId) {
          debugStage = 'hermes:runs_events_fetch'
          const runEventsRes = await fetch(new URL(`/v1/runs/${encodeURIComponent(runId)}/events`, hermesBaseUrl.origin), {
            headers: {
              ...buildHermesRequestHeaders('text/event-stream'),
              'X-Hermes-Session-Id': runSessionId,
            },
            signal: controller.signal,
          })

          if (runEventsRes.ok && runEventsRes.body) {
            const stream = new ReadableStream<Uint8Array>({
              async start(streamController) {
                debugStage = 'runs:stream_start'
                const stopHeartbeat = startStreamHeartbeat(streamController, heartbeatMs)
                const decoder = new TextDecoder()
                let localBuffer = ''
                let streamedText = ''
                let doneSent = false
                let nextRunEventsRes: Response | null = runEventsRes

                const sendDone = () => {
                  if (doneSent) return
                  doneSent = true
                  streamController.enqueue(emitSse('done', { request_id: requestId }))
                }

                const enqueueRunParserResult = (parsedRunEvent: ReturnType<typeof parseHermesRunEventBlock>) => {
                  streamedText = parsedRunEvent.streamedText

                  parsedRunEvent.events.forEach((event) => {
                    if (event.event === 'done') doneSent = true
                    streamController.enqueue(emitSse(event.event, event.data))
                  })

                  return parsedRunEvent.completed || parsedRunEvent.failed
                }

                const buildRunParserContext = () => ({
                  requestId,
                  runId,
                  sessionId: runSessionId,
                  streamedText,
                })

                const enqueueParsedEvents = (eventBlock: string) => {
                  const parsedRunEvent = parseHermesRunEventBlock(eventBlock, buildRunParserContext())
                  return enqueueRunParserResult(parsedRunEvent)
                }

                const fetchRunEvents = async () => {
                  if (nextRunEventsRes) {
                    const current = nextRunEventsRes
                    nextRunEventsRes = null
                    return current
                  }

                  debugStage = 'hermes:runs_events_refetch'
                  return await fetch(new URL(`/v1/runs/${encodeURIComponent(runId)}/events`, hermesBaseUrl.origin), {
                    headers: {
                      ...buildHermesRequestHeaders('text/event-stream'),
                      'X-Hermes-Session-Id': runSessionId,
                    },
                    signal: controller.signal,
                  })
                }

                const pollRunStatus = async () => {
                  debugStage = 'hermes:runs_status_poll'
                  const statusRes = await fetch(new URL(`/v1/runs/${encodeURIComponent(runId)}`, hermesBaseUrl.origin), {
                    headers: {
                      ...buildHermesRequestHeaders('application/json'),
                      'X-Hermes-Session-Id': runSessionId,
                    },
                    signal: controller.signal,
                  })

                  if (!statusRes.ok) return false

                  const statusPayload = await statusRes.json().catch(() => ({})) as Record<string, unknown>
                  const parsedStatus = parseHermesRunStatusPayload(statusPayload, buildRunParserContext())
                  if (!parsedStatus.terminal || !parsedStatus.parsed) return false

                  return enqueueRunParserResult(parsedStatus.parsed)
                }

                const consumeRunEventsResponse = async (eventsRes: Response) => {
                  if (!eventsRes.ok || !eventsRes.body) return false

                  const reader = eventsRes.body.getReader()
                  try {
                    while (true) {
                      const { done, value } = await reader.read()
                      if (done) break
                      if (!value) continue

                      localBuffer += decoder.decode(value, { stream: true })
                      const parts = localBuffer.split('\n\n')
                      localBuffer = parts.pop() ?? ''
                      for (const part of parts) {
                        const shouldStop = enqueueParsedEvents(part)
                        if (shouldStop) return true
                      }
                    }

                    if (localBuffer.trim()) {
                      const shouldStop = enqueueParsedEvents(localBuffer)
                      localBuffer = ''
                      if (shouldStop) return true
                    }

                    return false
                  } finally {
                    try {
                      reader.releaseLock()
                    } catch {
                      // ignore release errors after each event-stream attempt
                    }
                  }
                }

                try {
                  let shouldStop = false
                  while (!shouldStop) {
                    const eventsRes = await fetchRunEvents()
                    shouldStop = await consumeRunEventsResponse(eventsRes)
                    if (shouldStop) break

                    shouldStop = await pollRunStatus()
                    if (shouldStop) break

                    streamController.enqueue(emitSse('status', {
                      text: 'Hermes segue executando a tarefa...',
                      tone: 'info',
                    }))

                    await wait(HERMES_RUN_STATUS_POLL_MS)
                  }

                  if (!doneSent) {
                    sendDone()
                  }
                  debugStage = 'runs:stream_close'
                  streamController.close()
                } catch (err) {
                  debugStage = `runs:stream_error:${debugStage}`
                  streamController.error(err)
                } finally {
                  stopHeartbeat()
                  clearStreamTimeout()
                }
              },
              cancel() {
                clearStreamTimeout()
                controller.abort()
              },
            })

            return new Response(stream, { status: 200, headers: buildSseHeaders(cors, requestId) })
          }

          clearStreamTimeout()
          return json(
            {
              error: 'bad_gateway',
              request_id: requestId,
              upstream_status: runEventsRes.status,
              message: 'O Hermes iniciou a execução, mas não liberou o stream de eventos.',
            },
            { status: 502, headers: cors },
          )
        }

        clearStreamTimeout()
        return json(
          {
            error: 'bad_gateway',
            request_id: requestId,
            message: 'O Hermes criou uma execução sem identificador de run.',
          },
          { status: 502, headers: cors },
        )
      }
    }

    debugStage = 'hermes:initial_fetch'
    let upstreamRes = await fetchUpstream({
      input: nativeRequestPayload.input,
      conversationId: routingState.conversationId,
      previousResponseId: routingState.previousResponseId,
      hermesSessionId: routingState.hermesSessionId,
    })

    if ((!upstreamRes.ok || !upstreamRes.body) && pdfFallbackFiles.length > 0) {
      debugStage = 'hermes:pdf_fallback_fetch'
      const fallbackInput = buildHermesPdfFallbackInput({
        messageText: parsed.data.message_text,
        pdfFiles: pdfFallbackFiles,
      })
      upstreamRes = await fetchUpstream({
        input: fallbackInput,
        conversationId: routingState.conversationId,
        previousResponseId: routingState.previousResponseId,
        hermesSessionId: routingState.hermesSessionId,
      })
    }

    if (!upstreamRes.ok) {
      clearStreamTimeout()
      const text = await upstreamRes.text().catch(() => '')
      return json(
        {
          error: 'bad_gateway',
          request_id: requestId,
          upstream_status: upstreamRes.status,
          message: text.trim()
            ? 'O Hermes recusou a requisicao do chat. Verifique a configuracao do servidor.'
            : 'Nao foi possivel obter uma resposta valida do Hermes.',
        },
        { status: 502, headers: cors },
      )
    }

    if (!upstreamRes.body) {
      clearStreamTimeout()
      return json({ error: 'invalid_response', request_id: requestId }, { status: 502, headers: cors })
    }

    const stream = new ReadableStream<Uint8Array>({
      async start(streamController) {
        debugStage = 'stream:start'
        const reader = upstreamRes.body!.getReader()
        let activeReader = reader
        const stopHeartbeat = startStreamHeartbeat(streamController, heartbeatMs)
        const decoder = new TextDecoder()
        let doneSent = false
        let streamedText = ''
        let attemptedImageRemoteFallback = false
        let attemptedPdfFallback = false
        let contextRecoveryAttempts = 0
        let holdingEvents = activePreparedAttachments.length > 0
        const allowContextRecovery = activePreparedAttachments.length === 0
        const pendingEvents: Array<{ event: string; data: unknown }> = []
        let currentAttemptResponseId: string | null = null
        let currentAttemptRecoveredFromFailure = false
        let currentAttemptDidFail = false
        let currentAttemptErrorCode: string | null = null

        const sendDone = () => {
          if (doneSent) return
          doneSent = true
          streamController.enqueue(emitSse('done', { request_id: requestId }))
        }

        const flushPendingEvents = () => {
          pendingEvents.forEach((event) => {
            streamController.enqueue(emitSse(event.event, event.data))
          })
          pendingEvents.length = 0
        }

        const resetBufferedAttemptState = () => {
          holdingEvents = activePreparedAttachments.length > 0
          pendingEvents.length = 0
          streamedText = ''
          currentAttemptResponseId = null
          currentAttemptRecoveredFromFailure = false
          currentAttemptDidFail = false
          currentAttemptErrorCode = null
        }

        const persistAttemptState = async () => {
          if (currentAttemptRecoveredFromFailure && currentAttemptResponseId) {
            hermesState = await markHermesResponseRecovered({
              repository: hermesStateRepository,
              state: hermesState,
              responseId: currentAttemptResponseId,
              errorCode: currentAttemptErrorCode ?? 'hermes_recovered_failure',
            })
            routingState = buildHermesResponseRoutingState({ state: hermesState })
            return
          }

          if (currentAttemptResponseId) {
            hermesState = await markHermesResponseCompleted({
              repository: hermesStateRepository,
              state: hermesState,
              responseId: currentAttemptResponseId,
            })
            routingState = buildHermesResponseRoutingState({ state: hermesState })
            return
          }

          if (currentAttemptDidFail) {
            hermesState = await markHermesChainDegraded({
              repository: hermesStateRepository,
              state: hermesState,
              errorCode: currentAttemptErrorCode ?? 'hermes_failed_without_response_id',
            })
            routingState = buildHermesResponseRoutingState({ state: hermesState })
          }
        }

        const streamUpstreamResponse = async (reader: ReadableStreamDefaultReader<Uint8Array>) => {
          debugStage = 'stream:consume_upstream'
          activeReader = reader
          let localBuffer = ''

          const handleHermesEvent = (eventBlock: string) => {
            const rawEventName = getSseEventName(eventBlock)
            if (holdingEvents && (rawEventName === 'response.failed' || rawEventName === 'error')) {
              const failedParse = parseHermesEventBlock(eventBlock, {
                conversation: routingState.conversationId,
                requestId,
                streamedText,
              })
              const failedMeta = failedParse.events.find((event) => event.event === 'meta')
              if (failedMeta?.event === 'meta') {
                streamController.enqueue(emitSse('meta', {
                  ...failedMeta.data,
                  debug_request_stage: 'holding_events_failure',
                  current_turn_attachment_count: currentTurnAttachmentCount,
                  replay_attachment_count: replayAttachmentCount,
                  allow_context_recovery: allowContextRecovery,
                  attempted_image_remote_fallback: attemptedImageRemoteFallback,
                  attempted_pdf_fallback: attemptedPdfFallback,
                }))
              }
              if (streamedText.trim().length > 0 && !looksLikeHermesInternalErrorText(streamedText)) {
                flushPendingEvents()
                sendDone()
                return 'completed' as const
              }

              if (!attemptedImageRemoteFallback && hasImageAttachments) {
                return 'retry_image_remote' as const
              }

              if (!attemptedPdfFallback && pdfFallbackFiles.length > 0) {
                return 'retry_pdf_fallback' as const
              }

              return 'attachment_failed' as const
            }

            const parsed = parseHermesEventBlock(eventBlock, {
              conversation: routingState.conversationId,
              requestId,
              streamedText,
            })

            streamedText = parsed.streamedText
            if (parsed.responseId) currentAttemptResponseId = parsed.responseId
            if (parsed.recoveredFromFailure) currentAttemptRecoveredFromFailure = true
            if (parsed.didFail) {
              currentAttemptDidFail = true
              currentAttemptErrorCode = parsed.errorCode
              if (allowContextRecovery && contextRecoveryAttempts < 2 && streamedText.trim().length === 0) {
                return 'retry_context' as const
              }
            }

            parsed.events.forEach((event) => {
              if (event.event === 'done') {
                if (holdingEvents) flushPendingEvents()
                sendDone()
                return
              }

              if (holdingEvents) {
                pendingEvents.push(event)
                return
              }

              streamController.enqueue(emitSse(event.event, event.data))
            })

            return null
          }

          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            if (!value) continue

            localBuffer += decoder.decode(value, { stream: true })
            const parts = localBuffer.split('\n\n')
            localBuffer = parts.pop() ?? ''
            for (const part of parts) {
              const result = handleHermesEvent(part)
              if (
                result === 'retry_context' ||
                result === 'retry_image_remote' ||
                result === 'retry_pdf_fallback' ||
                result === 'attachment_failed'
              ) {
                return result
              }
            }
          }

          if (localBuffer.trim()) {
            const result = handleHermesEvent(localBuffer)
            if (
              result === 'retry_context' ||
              result === 'retry_image_remote' ||
              result === 'retry_pdf_fallback' ||
              result === 'attachment_failed'
            ) {
              return result
            }
          }

          if (allowContextRecovery && !currentAttemptResponseId && !streamedText.trim() && contextRecoveryAttempts < 2) {
            currentAttemptDidFail = true
            currentAttemptErrorCode = currentAttemptErrorCode ?? 'upstream_empty_response'
            return 'retry_context' as const
          }

          return 'completed' as const
        }

        try {
          let attemptResult = await streamUpstreamResponse(reader)

          while (attemptResult === 'retry_context') {
            debugStage = 'recovery:build_plan'
            const recoveryPlan = buildHermesRecoveryPlan({
              state: hermesState,
              attemptCount: contextRecoveryAttempts,
              errorMessage: currentAttemptErrorCode ?? 'response.failed',
            })

            if (recoveryPlan.strategy === 'give_up') {
              debugStage = 'recovery:give_up'
              await persistAttemptState()
              streamController.enqueue(emitSse('error', 'Nao foi possivel recuperar o contexto desta conversa com seguranca.'))
              sendDone()
              break
            }

            contextRecoveryAttempts += 1
            try {
              activeReader.releaseLock()
            } catch {
              // ignore release errors after switching attempts
            }

            if (recoveryPlan.strategy === 'rotate_conversation') {
              debugStage = 'recovery:rotate_conversation'
              hermesState = await markHermesChainRecovering({
                repository: hermesStateRepository,
                state: hermesState,
                nextConversationId: recoveryPlan.nextConversationId,
                errorCode: recoveryPlan.reason,
              })
            } else {
              debugStage = 'recovery:create_new_session'
              hermesState = await markHermesChainRecovering({
                repository: hermesStateRepository,
                state: hermesState,
                nextConversationId: recoveryPlan.nextConversationId,
                errorCode: recoveryPlan.reason,
              })
              const previousHermesSessionId = hermesState.hermes_session_id
              const nextHermesSession = await createHermesSession({
                hermesBaseUrl,
                hermesApiKey,
                title: `Nexus ${parsed.data.session_id} recovery`,
              })
              hermesState = await bindHermesSessionToState({
                repository: hermesStateRepository,
                state: hermesState,
                hermesSessionId: nextHermesSession.id,
              })
              if (previousHermesSessionId && previousHermesSessionId !== nextHermesSession.id) {
                try {
                  await deleteHermesSession({
                    hermesBaseUrl,
                    hermesApiKey,
                    hermesSessionId: previousHermesSessionId,
                  })
                } catch {
                  // best effort cleanup da sessao Hermes anterior
                }
              }
            }

            routingState = buildHermesResponseRoutingState({
              state: hermesState,
              previousResponseId: recoveryPlan.previousResponseId,
            })
            streamController.enqueue(
              emitSse('status', {
                text: 'Hermes esta recuperando o contexto da conversa...',
                tone: 'warning',
              }),
            )
            resetBufferedAttemptState()

            debugStage = 'recovery:retry_fetch'
            const recoveryRes = await fetchUpstream({
              input: buildHermesInput({
                messageText: parsed.data.message_text,
                attachments: materializeHermesAttachments(preparedAttachments, 'inline'),
                replayContextMessages: materializeReplayContextMessages('inline'),
              }),
              conversationId: routingState.conversationId,
              previousResponseId: routingState.previousResponseId,
              hermesSessionId: routingState.hermesSessionId,
            })

            if (!recoveryRes.ok || !recoveryRes.body) {
              currentAttemptDidFail = true
              currentAttemptErrorCode = `recovery_http_${recoveryRes.status}`
              attemptResult = 'retry_context'
              continue
            }

            attemptResult = await streamUpstreamResponse(recoveryRes.body.getReader())
          }

          if (attemptResult === 'retry_image_remote' && hasImageAttachments) {
            debugStage = 'attachments:image_remote_retry'
            attemptedImageRemoteFallback = true
            resetBufferedAttemptState()
            try {
              activeReader.releaseLock()
            } catch {
              // ignore release errors after switching attempts
            }

            const remoteImageInput = buildHermesInput({
              messageText: parsed.data.message_text,
              attachments: materializeHermesAttachments(preparedAttachments, 'remote'),
              replayContextMessages: materializeReplayContextMessages('remote'),
            })
            const remoteImageRes = await fetchUpstream({
              input: remoteImageInput,
              conversationId: routingState.conversationId,
              previousResponseId: routingState.previousResponseId,
              hermesSessionId: routingState.hermesSessionId,
            })
            if (!remoteImageRes.ok || !remoteImageRes.body) {
              attemptResult = pdfFallbackFiles.length > 0 ? 'retry_pdf_fallback' : 'attachment_failed'
            } else {
              attemptResult = await streamUpstreamResponse(remoteImageRes.body.getReader())
            }
          }

          if (attemptResult === 'retry_pdf_fallback' && pdfFallbackFiles.length > 0) {
            debugStage = 'attachments:pdf_retry'
            attemptedPdfFallback = true
            resetBufferedAttemptState()
            try {
              activeReader.releaseLock()
            } catch {
              // ignore release errors after switching attempts
            }

            const fallbackInput = buildHermesPdfFallbackInput({
              messageText: parsed.data.message_text,
              pdfFiles: pdfFallbackFiles,
            })
            const fallbackRes = await fetchUpstream({
              input: fallbackInput,
              conversationId: routingState.conversationId,
              previousResponseId: routingState.previousResponseId,
              hermesSessionId: routingState.hermesSessionId,
            })
            if (!fallbackRes.ok || !fallbackRes.body) {
              streamController.enqueue(emitSse('error', 'Nao foi possivel processar o PDF com seguranca.'))
              sendDone()
            } else {
              attemptResult = await streamUpstreamResponse(fallbackRes.body.getReader())
              if (attemptResult === 'retry_pdf_fallback') {
                streamController.enqueue(emitSse('error', 'Nao foi possivel processar o PDF com seguranca.'))
                sendDone()
              }
            }
          }

          if (attemptResult === 'attachment_failed') {
            debugStage = 'attachments:failed'
            await persistAttemptState()
            streamController.enqueue(emitSse('error', 'Nao foi possivel processar o anexo com seguranca.'))
            sendDone()
          }

          if (attemptResult === 'completed') {
            debugStage = 'stream:persist_attempt_state'
            await persistAttemptState()
          }

          if (!doneSent) {
            debugStage = 'stream:send_done'
            if (holdingEvents) flushPendingEvents()
            sendDone()
          }
          debugStage = 'stream:close'
          streamController.close()
        } catch (err) {
          debugStage = `stream:error:${debugStage}`
          streamController.error(err)
        } finally {
          stopHeartbeat()
          clearStreamTimeout()
          try {
            activeReader.releaseLock()
          } catch {
            // ignore release errors after stream finalization
          }
        }
      },
      cancel() {
        clearStreamTimeout()
        controller.abort()
      },
    })

    return new Response(stream, { status: 200, headers: buildSseHeaders(cors, requestId) })
  } catch (e) {
    if (e instanceof Error && (e.message.startsWith('missing_env:') || e.message.startsWith('invalid_env:'))) {
      return json(
        { error: e.message, request_id: requestId, debug_stage: debugStage, message: 'Configuração do servidor incompleta para o chatbot.' },
        { status: 500, headers: cors },
      )
    }

    if (e instanceof DOMException && e.name === 'AbortError') {
      return new Response(
        JSON.stringify({ error: 'upstream_timeout', request_id: requestId, message: 'Tempo limite ao chamar o chatbot.' }),
        { status: 504, headers: { 'Content-Type': 'application/json', ...cors, 'X-Request-Id': requestId } },
      )
    }

    console.error(JSON.stringify({
      request_id: requestId,
      debug_stage: debugStage,
      msg: 'proxy-chatbot.internal_error',
      error: e instanceof Error ? { name: e.name, message: e.message, stack: e.stack } : String(e),
    }))
    return json(
      {
        error: 'internal_error',
        request_id: requestId,
        debug_stage: debugStage,
        ...(e instanceof Error ? { debug_cause: e.message.slice(0, 240) } : {}),
        message: 'Erro interno no proxy do chatbot.',
      },
      { status: 500, headers: cors },
    )
  }
})
