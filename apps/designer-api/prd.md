PRD: ENS AI Banner Factory (v4.0 Final)
Conceito: Sistema de geração de banners via edição iterativa, baseado em Templates Padronizados e Input Estruturado, utilizando o modelo de ponta Imagen 3.
Definição das "Chaves Mestras" (The 6 Keys)
Todo template armazenado na biblioteca e todo pedido do usuário deve respeitar estritamente a existência destes 6 elementos. Se um template visual não tiver um "Box 2", o sistema deve ignorar o input desta chave.
O payload (pedido) do usuário será sempre composto por:
Etiqueta: (Ex: "Faculdade ENS", "MBA Executivo", "Curso Online")
Titulo: (Headline principal. Ex: "Gestão de Riscos")
Frase: (Subtítulo ou apoio. Ex: "Aprofunde seus conhecimentos hoje.")
Box1: (Selo/Destaque 1. Ex: "Início Imediato")
Box2: (Selo/Destaque 2. Ex: "Desconto de 10%")
Persona: (Descrição visual para geração do fundo).
Estrutura de Arquivos (Local RAG)
A IA seleciona o arquivo base navegando pela hierarquia Canal > KV.
Plaintext
/templates_library
/01_feed_instagram (1080x1350)
/graduacao
base_graduacao_feed_padrao.png <-- Deve conter visualmente os 6 elementos
/pos
base_pos_feed_padrao.png
/02_story_instagram (1080x1920)
/graduacao
/pos
/03_banner_interno (Wide)
...
3. Fluxo de Processo (Pipeline)
Estágio 1: Input Estruturado (JSON)
O Chatbot/Front-end entrega para o Python este objeto:
JSON
{
"request_meta": {
"canal": "01_feed_instagram",
"kv": "graduacao"
},

"content_keys": {
"etiqueta": "PÓS-GRADUAÇÃO",
"titulo": "Direito Securitário",
"frase": "Torne-se referência no mercado jurídico.",
"box1": "Aulas Ao Vivo",
"box2": "Matrículas Abertas",
"persona": "Advogada negra, 35 anos, roupa social moderna, fundo escritório de advocacia desfocado, iluminação suave."
}
}
Estágio 2: Seleção e Mapeamento (Orchestrator)
Seleção: Python busca o arquivo exato em /templates_library/{canal}/{kv}/.
Mapeamento Visual: O Gemini 1.5 Pro analisa a imagem e identifica semanticamente onde estão as 6 chaves para gerar o plano de edição.
Estágio 3: Loop de Edição (Iterative Inpainting)
O Python executa 3 chamadas sequenciais ao modelo Imagen 3 (imagen-3.0-generate-001):
Rodada 1 (Background): Troca o fundo pela persona. (Prompt reforçado para não alterar logos/cores).
Rodada 2 (Texto Macro): Substitui titulo, frase, etiqueta.
Rodada 3 (Texto Micro): Substitui box1, box2.
Integração Técnica da API (Implementação)
Esta seção define como conectar o Python ao modelo "Nano Banana Pro 4k" (Google Imagen 3 no Vertex AI).
4.1. Pré-requisitos Google Cloud
Criar projeto no Google Cloud Platform (GCP).
Habilitar a Vertex AI API.
Criar Service Account com permissão Vertex AI User e baixar o JSON de credenciais.
4.2. Especificação do Modelo
Model ID: imagen-3.0-generate-001 (ou imagen-3.0-capability-001 dependendo da disponibilidade da feature de editing na região us-central1).
Feature Necessária: edit_image (Inpainting/Editing mode).
4.3. Snippet de Implementação (Python)
Python
import vertexai
from vertexai.preview.vision_models import ImageGenerationModel
from vertexai.preview.vision_models import Image
Configuração Inicial
vertexai.init(project="seu-projeto-gcp-id", location="us-central1")
Carregamento do Modelo "Nano Banana Pro"
model = ImageGenerationModel.from_pretrained("imagen-3.0-generate-001")
def apply_nano_banana_edit(base_image_path, prompt_instruction, output_path):
"""
Função que chama a API para uma rodada de edição.
"""
# 1. Carregar imagem base
base_img = Image.load_from_file(base_image_path)
code
Code
# 2. Executar Edição
# O parametro 'mask_mode'='background' é util para a Rodada 1.
# Para textos (Rodada 2 e 3), usamos 'automatic' ou inpainting baseado no prompt.

images = model.edit_image(
    base_image=base_img,
    prompt=prompt_instruction,
    # Negative Prompt é crucial para proteger a marca
    negative_prompt="distorted logo, wrong colors, blurry text, watermark, low quality, deformed hands, blue color",
    number_of_images=1,
    language="pt" # ou "en" dependendo do prompt do orquestrador
)

# 3. Salvar Resultado
if images:
    images[0].save(output_path, include_generation_parameters=False)
    return output_path
else:
    raise Exception("Falha na geração da imagem pelo Imagen 3")
Exemplo de uso no Loop
apply_nano_banana_edit("temp/step1.png", "Change title to 'Direito'", "temp/step2.png")
Prompt do Orquestrador (System Instruction)
Este é o prompt que o seu Python enviará para a LLM de controle (Gemini 1.5 Pro) para gerar o JSON dos passos:
Plaintext
ROLE:
Você é um Editor de Arte Automatizado da ENS.
INPUT:
Imagem Base: [Arquivo Carregado]
Dados do Usuário: {persona}, {etiqueta}, {titulo}, {frase}, {box1}, {box2}
TAREFA:
Gere um plano de execução JSON para o modelo Imagen 3 editar a imagem em 3 passos.
DIRETRIZES DE EDIÇÃO (IMPORTANTE):
O modelo Imagen 3 é muito bom em seguir texto. Seja explicito.
Na troca de fundo, exija "Photorealistic, 4k, professional lighting".
Na troca de texto, especifique "Render text: '[Texto Novo]' in high quality typography".
OUTPUT FORMAT (JSON):
{
"steps": [
{
"step_id": 1,
"action": "background_replacement",
"prompt": "Keep the orange overlay, logos, and white text placeholders exactly as they are. REPLACE ONLY the background photo with: {persona}. Ensure photorealistic 8k quality."
},
{
"step_id": 2,
"action": "text_replacement_primary",
"prompt": "Update the main text elements. Replace the top badge text with '{etiqueta}'. Replace the large headline with '{titulo}'. Replace the subtitle with '{frase}'. Use the exact same font color (white) and style as the original."
},
{
"step_id": 3,
"action": "text_replacement_secondary",
"prompt": "Update the footer badges. Change the text in the left box to '{box1}' and the right box to '{box2}'. Keep the icons and shapes intact."
}
]
}
6. Checklist de Desenvolvimento
Padronização dos Templates (Ação Humana):
[ ] Revisar a pasta templates_library.
[ ] Garantir presença visual das 6 Chaves em cada PNG mestre.
Script Python (main.py):
[ ] Autenticação GCP configurada (gcloud auth ou JSON Key).
[ ] Implementar função apply_nano_banana_edit conectada ao endpoint imagen-3.0-generate-001.
[ ] Implementar lógica que ignora box2 se o JSON vier vazio.
Tratamento de Exceções:
[ ] Se box2 for nulo, alterar o prompt do passo 3 para: "Remove the second badge visual element completely, filling with background color."
[ ] Implementar retry automático (max 3x) caso a API retorne erro de "Safety Filter".