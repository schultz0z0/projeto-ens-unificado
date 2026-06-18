import assert from "node:assert/strict";

import test from "node:test";



import {

  buildHermesRunInput,

  buildHermesSessionChatRequest,

  buildHermesResponsesRequest,

  buildHermesResponsesInput,

  selectHermesBridgeMode,

  shouldUseResponsesApi,

} from "../src/hermes-payloads.js";



test("buildHermesResponsesInput sends image attachments as multimodal image parts", () => {

  const input = buildHermesResponsesInput({

    messageText: "analise esta imagem",

    attachments: [{

      kind: "image",

      name: "layout.png",

      mime_type: "image/png",

      storage_path: "user-1/session-1/layout.png",

      signed_url: "https://project.supabase.co/storage/v1/object/sign/chat-attachments/user-1/session-1/layout.png?token=abc",

      inline_data_url: "data:image/png;base64,AAAA",

    }],

    imageTransport: "inline",

  });



  assert.deepEqual(input, [{

    role: "user",

    content: [

      { type: "input_text", text: "analise esta imagem" },

      { type: "input_image", image_url: "data:image/png;base64,AAAA", detail: "auto" },

    ],

  }]);

});



test("buildHermesRunInput includes extracted file text for long running text runs", () => {

  const input = buildHermesRunInput({

    messageText: "resuma",

    attachments: [{

      kind: "file",

      name: "brief.txt",

      mime_type: "text/plain",

      storage_path: "user-1/session-1/brief.txt",

      signed_url: "https://project.supabase.co/storage/v1/object/sign/chat-attachments/user-1/session-1/brief.txt?token=abc",

      extracted_text: "conteudo do brief",

    }],

  });



  assert.match(input, /resuma/);

  assert.match(input, /\[Arquivo: brief\.txt\]/);

  assert.match(input, /conteudo do brief/);

});



test("buildHermesRunInput includes replayed chat history before current text", () => {

  const input = buildHermesRunInput({

    messageText: "oque eu falei antes mesmo?",

    attachments: [],

    replayContextMessages: [

      { role: "user", messageText: "Eu falei que meu código secreto é abacaxi azul.", attachments: [] },

      { role: "assistant", messageText: "Entendido. Vou considerar que o código secreto é abacaxi azul.", attachments: [] },

    ],

  });



  assert.match(input, /Mensagem anterior do usuario: Eu falei que meu código secreto é abacaxi azul\./);

  assert.match(input, /Resposta anterior do assistente: Entendido/);

  assert.ok(input.includes("[Mensagem atual do usuario]"));
  assert.ok(input.includes("oque eu falei antes mesmo?"));
});



test("selectHermesBridgeMode routes every chatbot turn through persisted Hermes sessions", () => {

  assert.equal(selectHermesBridgeMode([]), "session");

  assert.equal(selectHermesBridgeMode([{ kind: "file", mime_type: "text/plain", extracted_text: "ok" }]), "session");

  assert.equal(selectHermesBridgeMode([{ kind: "image", mime_type: "image/png" }]), "session");

});



test("buildHermesSessionChatRequest leaves conversation continuity to Hermes SessionDB", () => {

  const request = buildHermesSessionChatRequest({

    messageText: "qual e minha cor escolhida?",

    attachments: [],

    replayContextMessages: [

      { role: "user", messageText: "Minha cor escolhida e vermelho.", attachments: [] },

      { role: "assistant", messageText: "Entendido.", attachments: [] },

    ],

  });



  assert.deepEqual(request, {

    message: "qual e minha cor escolhida?",

  });

});



test("buildHermesSessionChatRequest sends current images as Hermes session multimodal input", () => {

  const request = buildHermesSessionChatRequest({

    messageText: "analise esta imagem",

    attachments: [{

      kind: "image",

      name: "layout.png",

      mime_type: "image/png",

      storage_path: "user-1/session-1/layout.png",

      signed_url: "https://project.supabase.co/storage/v1/object/sign/chat-attachments/user-1/session-1/layout.png?token=abc",

      inline_data_url: "data:image/png;base64,AAAA",

    }],

  });



  assert.deepEqual(request, {

    message: [

      { type: "input_text", text: "analise esta imagem" },

      { type: "input_image", image_url: "data:image/png;base64,AAAA", detail: "auto" },

    ],

  });

});
test("buildHermesSessionChatRequest turns image mode into image_generate instructions", () => {

  const request = buildHermesSessionChatRequest({

    messageText: "crie um banner para campanha da ENS",

    attachments: [{

      kind: "image",

      name: "referencia.png",

      mime_type: "image/png",

      storage_path: "user-1/session-1/referencia.png",

      signed_url: "https://project.supabase.co/storage/v1/object/sign/chat-attachments/user-1/session-1/referencia.png?token=abc",

      inline_data_url: "data:image/png;base64,AAAA",

    }],

    intent: "image_generate",

    imageOptions: {

      quality: "high",

      size: "2560x1440",

      output_format: "webp",

    },

  });

  assert.equal(Array.isArray(request.message), true);

  assert.match(request.message[0].text, /Use obrigatoriamente a ferramenta image_generate/);

  assert.match(request.message[0].text, /quality: high/);

  assert.match(request.message[0].text, /size: 2560x1440/);

  assert.match(request.message[0].text, /output_format: webp/);

  assert.match(request.message[0].text, /aspect_ratio: landscape/);

  assert.match(request.message[0].text, /input_images/);

  assert.match(request.message[0].text, /mode: auto\|reference\|edit/);

  assert.match(request.message[0].text, /referencia\.png/);

  assert.match(request.message[0].text, /https:\/\/project\.supabase\.co\/storage\/v1\/object\/sign\/chat-attachments\/user-1\/session-1\/referencia\.png\?token=abc/);

  assert.match(request.message[0].text, /editar|trocar|remover|preservar o resto/);

  assert.deepEqual(request.message[1], {

    type: "input_image",

    image_url: "data:image/png;base64,AAAA",

    detail: "auto",

  });

});



test("shouldUseResponsesApi routes images and non-extracted files to multimodal responses", () => {

  assert.equal(shouldUseResponsesApi([]), false);

  assert.equal(shouldUseResponsesApi([{ kind: "image", mime_type: "image/png" }]), true);

  assert.equal(shouldUseResponsesApi([{ kind: "file", mime_type: "application/pdf", extracted_text: "" }]), true);

  assert.equal(shouldUseResponsesApi([{ kind: "file", mime_type: "text/plain", extracted_text: "ok" }]), false);

});



test("buildHermesResponsesRequest sends conversation only on first Responses turn", () => {

  const request = buildHermesResponsesRequest({

    modelName: "hermes-agent",

    userId: "user-1",

    sessionId: "session-1",

    messageText: "primeira pergunta",

    attachments: [],

    conversationId: "nexus:user-1:session-1",

  });



  assert.equal(request.conversation, "nexus:user-1:session-1");

  assert.equal("previous_response_id" in request, false);

});



test("buildHermesResponsesRequest does not combine conversation with previous_response_id", () => {

  const request = buildHermesResponsesRequest({

    modelName: "hermes-agent",

    userId: "user-1",

    sessionId: "session-1",

    messageText: "continua",

    attachments: [],

    conversationId: "nexus:user-1:session-1",

    previousResponseId: "resp_123",

  });



  assert.equal(request.previous_response_id, "resp_123");

  assert.equal("conversation" in request, false);

});

