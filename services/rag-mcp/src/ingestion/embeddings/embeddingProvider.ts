export type EmbeddingProvider = {
  model?: string;
  embed(texts: string[]): Promise<Array<number[] | null>>;
};

export function createEmbeddingProviderFromEnv(): EmbeddingProvider {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return new DisabledEmbeddingProvider();
  }

  return new OpenAiCompatibleEmbeddingProvider({
    apiKey,
    model: process.env.OPENAI_EMBEDDING_MODEL ?? 'text-embedding-3-small',
    baseUrl: process.env.OPENAI_EMBEDDING_BASE_URL ?? 'https://api.openai.com/v1'
  });
}

class DisabledEmbeddingProvider implements EmbeddingProvider {
  async embed(texts: string[]): Promise<Array<number[] | null>> {
    return texts.map(() => null);
  }
}

class OpenAiCompatibleEmbeddingProvider implements EmbeddingProvider {
  readonly model: string;
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(options: { apiKey: string; model: string; baseUrl: string }) {
    this.apiKey = options.apiKey;
    this.model = options.model;
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
  }

  async embed(texts: string[]): Promise<Array<number[] | null>> {
    if (texts.length === 0) {
      return [];
    }

    const embeddings: Array<number[] | null> = [];
    const batchSize = 32;

    for (let start = 0; start < texts.length; start += batchSize) {
      const batch = texts.slice(start, start + batchSize);
      const response = await fetch(`${this.baseUrl}/embeddings`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.model,
          input: batch
        })
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Embedding request failed with HTTP ${response.status}: ${body.slice(0, 300)}`);
      }

      const payload = (await response.json()) as {
        data: Array<{ index: number; embedding: number[] }>;
      };
      const batchEmbeddings: Array<number[] | null> = batch.map(() => null);

      for (const item of payload.data ?? []) {
        batchEmbeddings[item.index] = item.embedding;
      }

      embeddings.push(...batchEmbeddings);
    }

    return embeddings;
  }
}
