export function cleanText(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value)
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

export function compactArray(values: unknown[]): string[] {
  return [...new Set(values.map(cleanText).filter(Boolean))];
}

export function section(title: string, value: unknown): string {
  const text = cleanText(value);
  return text ? `${title}\n${text}` : '';
}

export function joinSections(sections: string[]): string {
  return sections.map(cleanText).filter(Boolean).join('\n\n');
}

export function stableKey(...parts: unknown[]): string {
  return parts.map(part => cleanText(part).toLowerCase()).filter(Boolean).join(':');
}

export function splitTextForEmbedding(text: string, maxChars = 6000): string[] {
  const cleaned = cleanText(text);
  if (!cleaned) {
    return [];
  }

  if (cleaned.length <= maxChars) {
    return [cleaned];
  }

  const paragraphs = cleaned.split(/\n{2,}/).map(cleanText).filter(Boolean);
  const parts: string[] = [];
  let current = '';

  for (const paragraph of paragraphs) {
    if (paragraph.length > maxChars) {
      if (current) {
        parts.push(current);
        current = '';
      }
      parts.push(...splitLongParagraph(paragraph, maxChars));
      continue;
    }

    const candidate = current ? `${current}\n\n${paragraph}` : paragraph;
    if (candidate.length > maxChars) {
      if (current) {
        parts.push(current);
      }
      current = paragraph;
    } else {
      current = candidate;
    }
  }

  if (current) {
    parts.push(current);
  }

  return parts;
}

function splitLongParagraph(text: string, maxChars: number): string[] {
  const parts: string[] = [];
  for (let index = 0; index < text.length; index += maxChars) {
    parts.push(text.slice(index, index + maxChars));
  }
  return parts;
}
