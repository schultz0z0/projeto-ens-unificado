import type { RagSearchIntent, RagSearchResult } from './types.js';

export type RagRerankerMode = 'off' | 'local' | 'gpt';

export type RagRerankInput = {
  query: string;
  intent?: RagSearchIntent;
  requestedLimit: number;
  results: RagSearchResult[];
};

export type RagRerankOutput = {
  mode: RagRerankerMode;
  applied: boolean;
  warning?: string;
  results: RagSearchResult[];
};

export interface RagReranker {
  rerank(input: RagRerankInput): Promise<RagRerankOutput>;
}

export function createRagRerankerFromEnv(): RagReranker {
  const mode = (process.env.ENS_RAG_RERANKER_MODE ?? 'local').toLowerCase();
  if (mode === 'off') {
    return new NoopRagReranker();
  }

  if ((mode === 'gpt' || mode === 'auto') && process.env.OPENAI_API_KEY) {
    return new FallbackRagReranker(
      new GptRagReranker({
        apiKey: process.env.OPENAI_API_KEY,
        model: process.env.ENS_RAG_RERANKER_MODEL ?? 'gpt-4o-mini',
        baseUrl: nonEmpty(process.env.OPENAI_CHAT_BASE_URL) ?? 'https://api.openai.com/v1'
      }),
      new LocalRagReranker()
    );
  }

  return new LocalRagReranker();
}

class NoopRagReranker implements RagReranker {
  async rerank(input: RagRerankInput): Promise<RagRerankOutput> {
    return {
      mode: 'off',
      applied: false,
      results: input.results.slice(0, input.requestedLimit)
    };
  }
}

class FallbackRagReranker implements RagReranker {
  constructor(
    private readonly primary: RagReranker,
    private readonly fallback: RagReranker
  ) {}

  async rerank(input: RagRerankInput): Promise<RagRerankOutput> {
    try {
      return await this.primary.rerank(input);
    } catch (error) {
      const fallback = await this.fallback.rerank(input);
      return {
        ...fallback,
        warning: `GPT reranker unavailable; used local reranker. ${error instanceof Error ? error.message : ''}`.trim()
      };
    }
  }
}

export class LocalRagReranker implements RagReranker {
  async rerank(input: RagRerankInput): Promise<RagRerankOutput> {
    const queryTokens = tokenize(input.query);
    const offerQuery = hasOfferIntent(input.query);
    const scored = input.results.map(result => {
      const reasons: string[] = [];
      let score = result.score;
      const metadata = result.metadata ?? {};
      const chunkKind = stringValue(metadata.chunk_kind);

      const titleOverlap = tokenOverlap(queryTokens, tokenize(result.title));
      if (titleOverlap > 0) {
        const boost = Math.min(0.22, titleOverlap * 0.08);
        score += boost;
        reasons.push('title_match');
      }

      const courseName = stringValue(metadata.course_name);
      const courseOverlap = courseName ? tokenOverlap(queryTokens, tokenize(courseName)) : 0;
      if (courseOverlap > 0) {
        const boost = Math.min(0.18, courseOverlap * 0.06);
        score += boost;
        reasons.push('course_name_match');
      }

      if (result.collection === 'courses' && offerQuery && chunkKind === 'course_offer') {
        score += 0.45;
        reasons.push('offer_query_match');
      }

      if (chunkKind === 'course_offer' && isActiveOffer(metadata)) {
        score += 0.25;
        reasons.push('active_offer');
      }

      if (chunkKind === 'course_offer' && stringValue(metadata.offer_status) === 'blocked') {
        score -= 0.15;
        reasons.push('blocked_offer_penalty');
      }

      if (metadata.offer_hidden === true) {
        score -= 0.4;
        reasons.push('hidden_offer_penalty');
      }

      return {
        result: {
          ...result,
          metadata: {
            ...metadata,
            reranker_score: Number(score.toFixed(6)),
            reranker_reason: reasons.join(',')
          }
        },
        score
      };
    });

    scored.sort((a, b) => b.score - a.score);

    return {
      mode: 'local',
      applied: true,
      results: scored.slice(0, input.requestedLimit).map(item => item.result)
    };
  }
}

class GptRagReranker implements RagReranker {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;

  constructor(options: { apiKey: string; model: string; baseUrl: string }) {
    this.apiKey = options.apiKey;
    this.model = options.model;
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
  }

  async rerank(input: RagRerankInput): Promise<RagRerankOutput> {
    if (input.results.length === 0) {
      return { mode: 'gpt', applied: false, results: [] };
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.model,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'Rerank ENS RAG evidence. Return JSON {"ranked_chunk_ids":["..."]}. Only reorder provided chunk IDs. Prefer exact course facts, active course offers, title matches, and directly relevant evidence. Never add new facts.'
          },
          {
            role: 'user',
            content: JSON.stringify({
              query: input.query,
              intent: input.intent,
              requested_limit: input.requestedLimit,
              candidates: input.results.map(result => ({
                chunk_id: result.chunkId,
                title: result.title,
                collection: result.collection,
                score: result.score,
                metadata: result.metadata,
                content: result.content.slice(0, 900)
              }))
            })
          }
        ]
      })
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Reranker request failed with HTTP ${response.status}: ${body.slice(0, 240)}`);
    }

    const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const rawContent = payload.choices?.[0]?.message?.content;
    if (!rawContent) {
      throw new Error('Reranker response did not include content.');
    }

    const ranked = JSON.parse(rawContent) as { ranked_chunk_ids?: string[] };
    const byId = new Map(input.results.map(result => [result.chunkId, result]));
    const ordered: RagSearchResult[] = [];

    for (const chunkId of ranked.ranked_chunk_ids ?? []) {
      const result = byId.get(chunkId);
      if (result) {
        ordered.push({
          ...result,
          metadata: {
            ...result.metadata,
            reranker_reason: 'gpt_ranked'
          }
        });
        byId.delete(chunkId);
      }
    }

    ordered.push(...byId.values());

    return {
      mode: 'gpt',
      applied: true,
      results: ordered.slice(0, input.requestedLimit)
    };
  }
}

function hasOfferIntent(query: string): boolean {
  return /\b(oferta|ofertas|inscri|inscricao|inscrição|link|data|inicio|início|investimento|valor|preco|preço|modalidade|turma|aula|matricula|matrícula)\b/i.test(
    query
  );
}

function isActiveOffer(metadata: Record<string, unknown>): boolean {
  return stringValue(metadata.offer_status) === 'available' && metadata.offer_hidden !== true;
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function tokenize(value: string): string[] {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter(token => token.length >= 3);
}

function tokenOverlap(left: string[], right: string[]): number {
  const rightSet = new Set(right);
  return left.filter(token => rightSet.has(token)).length;
}

function nonEmpty(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}
