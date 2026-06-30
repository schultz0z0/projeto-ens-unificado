export function jsonToolResult(payload: Record<string, unknown>) {
  const text = JSON.stringify(payload, null, 2);

  return {
    content: [{ type: 'text' as const, text }],
    structuredContent: payload
  };
}

export function errorToolResult(message: string, details?: unknown) {
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify({ error: message, details }, null, 2)
      }
    ],
    isError: true as const
  };
}
