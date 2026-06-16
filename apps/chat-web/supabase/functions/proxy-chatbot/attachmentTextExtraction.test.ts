import { describe, expect, it } from "vitest";
import { strToU8, zipSync } from "fflate";

import { extractAttachmentText } from "./attachmentTextExtraction";

describe("extractAttachmentText", () => {
  it("extrai texto simples de txt e csv", () => {
    const textResult = extractAttachmentText(
      {
        name: "notas.txt",
        mime_type: "text/plain",
      },
      strToU8("linha 1\nlinha 2"),
    );

    const csvResult = extractAttachmentText(
      {
        name: "dados.csv",
        mime_type: "text/csv",
      },
      strToU8("nome,valor\nleads,42"),
    );

    expect(textResult).toContain("linha 1");
    expect(csvResult).toContain("nome,valor");
  });

  it("remove marcacao basica de rtf", () => {
    const result = extractAttachmentText(
      {
        name: "arquivo.rtf",
        mime_type: "application/rtf",
      },
      strToU8("{\\rtf1\\ansi Isso \\b funciona\\b0.}"),
    );

    expect(result).toContain("Isso funciona.");
    expect(result).not.toContain("\\rtf1");
  });

  it("extrai texto principal de docx", () => {
    const docxBytes = zipSync({
      "word/document.xml": strToU8(
        [
          '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
          '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">',
          "<w:body>",
          "<w:p><w:r><w:t>Primeira linha</w:t></w:r></w:p>",
          "<w:p><w:r><w:t>Segunda linha</w:t></w:r></w:p>",
          "</w:body>",
          "</w:document>",
        ].join(""),
      ),
    });

    const result = extractAttachmentText(
      {
        name: "arquivo.docx",
        mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      },
      docxBytes,
    );

    expect(result).toContain("Primeira linha");
    expect(result).toContain("Segunda linha");
  });

  it("extrai tabela simples de xlsx", () => {
    const xlsxBytes = zipSync({
      "xl/sharedStrings.xml": strToU8(
        [
          '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
          '<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
          "<si><t>Nome</t></si>",
          "<si><t>Valor</t></si>",
          "<si><t>Leads</t></si>",
          "</sst>",
        ].join(""),
      ),
      "xl/workbook.xml": strToU8(
        [
          '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
          '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">',
          "<sheets><sheet name=\"Planilha1\" sheetId=\"1\" r:id=\"rId1\"/></sheets>",
          "</workbook>",
        ].join(""),
      ),
      "xl/_rels/workbook.xml.rels": strToU8(
        [
          '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
          '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
          '<Relationship Id="rId1" Target="worksheets/sheet1.xml" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet"/>',
          "</Relationships>",
        ].join(""),
      ),
      "xl/worksheets/sheet1.xml": strToU8(
        [
          '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
          '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
          "<sheetData>",
          '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row>',
          '<row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2"><v>42</v></c></row>',
          "</sheetData>",
          "</worksheet>",
        ].join(""),
      ),
    });

    const result = extractAttachmentText(
      {
        name: "planilha.xlsx",
        mime_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
      xlsxBytes,
    );

    expect(result).toContain("[Planilha: Planilha1]");
    expect(result).toContain("Nome\tValor");
    expect(result).toContain("Leads\t42");
  });
});
