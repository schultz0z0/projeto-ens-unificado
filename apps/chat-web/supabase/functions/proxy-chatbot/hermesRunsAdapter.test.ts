import { describe, expect, it } from "vitest";

import { buildHermesRunRequest, buildHermesRunSessionId } from "./hermesRunsAdapter";

describe("buildHermesRunSessionId", () => {
  it("gera um session_id curto para nao estourar prompt_cache_key do provider", () => {
    const sessionId = buildHermesRunSessionId("a4447dba-b3be-4123-9e27-48d21384b3e9");

    expect(sessionId).toBe("nexus:a4447dba-b3be-4123-9e27-48d21384b3e9");
    expect(sessionId.length).toBeLessThanOrEqual(64);
  });

  it("encurta sessoes nao-uuid longas de forma deterministica", () => {
    const rawSessionId = "sessao-com-identificador-muito-longo-para-a-runs-api-do-hermes-e-provider";
    const first = buildHermesRunSessionId(rawSessionId);
    const second = buildHermesRunSessionId(rawSessionId);

    expect(first).toBe(second);
    expect(first).toMatch(/^nexus:[a-z0-9_-]+-[a-f0-9]{8}$/);
    expect(first.length).toBeLessThanOrEqual(64);
  });
});

describe("buildHermesRunRequest", () => {
  it("monta payload da Runs API com session_id estavel e input textual", () => {
    const request = buildHermesRunRequest({
      sessionId: "agent:main:nexus:chat:user-1:session-1",
      messageText: "crie uma copy curta",
      attachments: [],
    });

    expect(request).toEqual({
      session_id: "agent:main:nexus:chat:user-1:session-1",
      input: "crie uma copy curta",
    });
  });

  it("inclui arquivos extraidos e contexto anterior como texto para o agente", () => {
    const request = buildHermesRunRequest({
      sessionId: "session-2",
      messageText: "resuma o material",
      attachments: [
        {
          kind: "file",
          name: "briefing.pdf",
          mime_type: "application/pdf",
          storage_path: "user/session/briefing.pdf",
          signed_url: "https://signed.example/briefing.pdf",
          extracted_text: "Texto do briefing",
        },
      ],
      replayContextMessages: [
        {
          messageText: "veja este documento anterior",
          attachments: [
            {
              kind: "file",
              name: "contrato.txt",
              mime_type: "text/plain",
              storage_path: "user/session/contrato.txt",
              signed_url: "https://signed.example/contrato.txt",
              extracted_text: "Texto do contrato",
            },
          ],
        },
      ],
    });

    expect(request.session_id).toBe("session-2");
    expect(request.input).toContain("[Contexto anterior da conversa]");
    expect(request.input).toContain("Mensagem anterior do usuario: veja este documento anterior");
    expect(request.input).toContain("[Arquivo anterior: contrato.txt]");
    expect(request.input).toContain("Texto do contrato");
    expect(request.input).toContain("[Mensagem atual do usuario]");
    expect(request.input).toContain("resuma o material");
    expect(request.input).toContain("[Arquivo: briefing.pdf]");
    expect(request.input).toContain("Texto do briefing");
  });
});
