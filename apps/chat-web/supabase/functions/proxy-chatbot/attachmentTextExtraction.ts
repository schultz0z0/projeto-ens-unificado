import { unzipSync } from "npm:fflate";

type AttachmentTextSource = {
  name: string;
  mime_type: string;
};

const MAX_EXTRACTED_TEXT_CHARS = 12_000;

const getFileExtension = (fileName: string) => {
  const parts = fileName.toLowerCase().split(".");
  return parts.length > 1 ? parts[parts.length - 1] : "";
};

const truncateText = (value: string) => value.replace(/\r\n/g, "\n").split("\0").join("").trim().slice(0, MAX_EXTRACTED_TEXT_CHARS);

const decodeUtf8 = (bytes: Uint8Array) => new TextDecoder("utf-8", { fatal: false }).decode(bytes);
const decodeLatin1 = (bytes: Uint8Array) => new TextDecoder("latin1").decode(bytes);

const decodeXmlEntities = (value: string) =>
  value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#10;/g, "\n")
    .replace(/&#9;/g, "\t");

const stripXml = (xml: string) => decodeXmlEntities(xml.replace(/<[^>]+>/g, " "));

const extractPdfText = (bytes: Uint8Array) => {
  const decoded = decodeLatin1(bytes);
  const literalMatches = [...decoded.matchAll(/\(([^()]*)\)\s*Tj/g)].map((match) => match[1]);
  const joinedLiteral = literalMatches.join(" ");

  const fallbackText = (joinedLiteral || decoded)
    .replace(/[^\x20-\x7E\n\r\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return truncateText(fallbackText);
};

const extractPlainText = (bytes: Uint8Array) => truncateText(decodeUtf8(bytes));

const extractRtfText = (bytes: Uint8Array) => {
  const decoded = decodeLatin1(bytes);
  const normalized = decoded
    .replace(/\\par[d]?/g, "\n")
    .replace(/\\tab/g, "\t")
    .replace(/\\'[0-9a-fA-F]{2}/g, " ")
    .replace(/\\[a-z]+-?\d* ?/g, "")
    .replace(/[{}]/g, "")
    .replace(/\s+\n/g, "\n")
    .replace(/\n{2,}/g, "\n");

  return truncateText(normalized);
};

const extractDocxText = (bytes: Uint8Array) => {
  const archive = unzipSync(bytes);
  const xmlEntries = Object.entries(archive)
    .filter(([path]) => path === "word/document.xml" || /^word\/(header|footer)\d+\.xml$/i.test(path))
    .map(([, content]) => decodeUtf8(content));

  const text = xmlEntries
    .map((xml) =>
      xml
        .replace(/<w:tab\/>/g, "\t")
        .replace(/<w:br\/>/g, "\n")
        .replace(/<\/w:p>/g, "\n")
        .replace(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g, (_, value: string) => decodeXmlEntities(value))
        .replace(/<[^>]+>/g, ""),
    )
    .join("\n")
    .replace(/\n{2,}/g, "\n");

  return truncateText(text);
};

const extractSharedStrings = (xml: string) => {
  return [...xml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((match) => {
    const fragments = [...match[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((item) => decodeXmlEntities(item[1]));
    return fragments.join("");
  });
};

const getColumnIndex = (cellRef: string) => {
  const letters = cellRef.replace(/\d+/g, "").toUpperCase();
  let index = 0;
  for (const char of letters) {
    index = index * 26 + (char.charCodeAt(0) - 64);
  }
  return Math.max(0, index - 1);
};

const extractXlsxText = (bytes: Uint8Array) => {
  const archive = unzipSync(bytes);
  const workbookXml = archive["xl/workbook.xml"] ? decodeUtf8(archive["xl/workbook.xml"]) : "";
  const workbookRelsXml = archive["xl/_rels/workbook.xml.rels"] ? decodeUtf8(archive["xl/_rels/workbook.xml.rels"]) : "";
  const sharedStrings = archive["xl/sharedStrings.xml"] ? extractSharedStrings(decodeUtf8(archive["xl/sharedStrings.xml"])) : [];

  const relMap = new Map(
    [...workbookRelsXml.matchAll(/<Relationship[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g)].map((match) => [
      match[1],
      match[2].replace(/^\/+/, ""),
    ]),
  );

  const sheets = [...workbookXml.matchAll(/<sheet[^>]*name="([^"]+)"[^>]*r:id="([^"]+)"/g)].map((match) => ({
    name: decodeXmlEntities(match[1]),
    target: relMap.get(match[2]),
  }));

  const sheetOutputs = sheets
    .map((sheet) => {
      if (!sheet.target) return "";
      const sheetPath = sheet.target.startsWith("xl/") ? sheet.target : `xl/${sheet.target}`;
      const sheetXmlBytes = archive[sheetPath];
      if (!sheetXmlBytes) return "";
      const sheetXml = decodeUtf8(sheetXmlBytes);

      const rows = [...sheetXml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)].map((rowMatch) => {
        const cells = [...rowMatch[1].matchAll(/<c[^>]*r="([^"]+)"([^>]*)>([\s\S]*?)<\/c>/g)];
        const values = new Map<number, string>();

        cells.forEach((cellMatch) => {
          const cellRef = cellMatch[1];
          const attributes = cellMatch[2];
          const body = cellMatch[3];
          const columnIndex = getColumnIndex(cellRef);
          const shared = /t="s"/.test(attributes);
          const inline = /t="inlineStr"/.test(attributes);
          const value =
            inline
              ? decodeXmlEntities((body.match(/<t[^>]*>([\s\S]*?)<\/t>/)?.[1] ?? ""))
              : body.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? "";

          values.set(columnIndex, shared ? sharedStrings[Number(value)] ?? "" : decodeXmlEntities(value));
        });

        const width = Math.max(...Array.from(values.keys()), -1) + 1;
        return Array.from({ length: width }, (_, index) => values.get(index) ?? "").join("\t").trimEnd();
      });

      const table = rows.filter(Boolean).join("\n");
      return table ? [`[Planilha: ${sheet.name}]`, table].join("\n") : "";
    })
    .filter(Boolean);

  return truncateText(sheetOutputs.join("\n\n"));
};

const extractBinaryText = (bytes: Uint8Array) => {
  const decoded = decodeLatin1(bytes);
  const matches = decoded.match(/[A-Za-z0-9][\x20-\x7E]{3,}/g) ?? [];
  return truncateText(matches.join("\n"));
};

export const extractAttachmentText = (attachment: AttachmentTextSource, bytes: Uint8Array) => {
  const mimeType = attachment.mime_type.trim().toLowerCase();
  const extension = getFileExtension(attachment.name);

  if (mimeType.startsWith("image/")) {
    return "";
  }

  if (mimeType === "application/pdf" || extension === "pdf") {
    return extractPdfText(bytes);
  }

  if (
    mimeType === "text/plain" ||
    mimeType === "text/markdown" ||
    mimeType === "text/csv" ||
    extension === "txt" ||
    extension === "md" ||
    extension === "csv"
  ) {
    return extractPlainText(bytes);
  }

  if (mimeType === "application/rtf" || mimeType === "text/rtf" || extension === "rtf") {
    return extractRtfText(bytes);
  }

  if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    extension === "docx"
  ) {
    return extractDocxText(bytes);
  }

  if (
    mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    extension === "xlsx"
  ) {
    return extractXlsxText(bytes);
  }

  if (mimeType === "application/msword" || extension === "doc" || extension === "xls") {
    return extractBinaryText(bytes);
  }

  return "";
};
