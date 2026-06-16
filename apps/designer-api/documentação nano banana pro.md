Geração de imagens com o Nano Banana




Londresbananarestorerevistaartigocafécachorroisométrico
Londres
Gerado pelo Nano Banana Pro
Comando: "Apresente uma cena de desenho animado em 3D em miniatura isométrica de cima para baixo de 45° clara de Londres, com os marcos e elementos arquitetônicos mais icônicos. Use texturas suaves e refinadas com materiais PBR realistas e iluminação e sombras suaves e realistas. Integre as condições climáticas atuais diretamente ao ambiente da cidade para criar uma atmosfera imersiva. Use uma composição limpa e minimalista com um fundo macio e de cor sólida. Na parte superior central, coloque o título "Londres" em texto grande e em negrito, um ícone de clima em destaque abaixo dele e, em seguida, a data (texto pequeno) e a temperatura (texto médio). Todo o texto precisa estar centralizado com espaçamento consistente e pode se sobrepor sutilmente aos topos dos edifícios".
Saiba mais sobre o embasamento de pesquisa e teste no AI Studio
banana
Gerado pelo Nano Banana Pro
Comando: "Coloque este logotipo em um anúncio sofisticado de um perfume com aroma de banana. O logotipo está perfeitamente integrado à garrafa".
Teste a preservação de detalhes de alta fidelidade do Nano Banana no AI Studio
restore
Gerado pelo Nano Banana Pro
Comando: "Restaure esta imagem com alta fidelidade à qualidade de uma fotografia moderna, em cores, faça o upscaling para 4K"
Gere imagens em até resolução 4K. Teste o Nano Banana no AI Studio
revista
Gerado pelo Nano Banana Pro
Comando: "Uma foto da capa de uma revista brilhante com as palavras grandes e em negrito "Nano Banana Pro". O texto está em uma fonte serifada e preenche a visualização. Nenhum outro texto. Na frente do texto, há um retrato de uma pessoa com uma roupa bonita. Coloque o número da edição e a data de hoje no canto, junto com um código de barras e um preço. A revista está em uma prateleira contra uma parede de tijolos, dentro de uma loja de design. Um manequim está usando a mesma roupa."
Criar fotos de produtos profissionais no AI Studio
artigo
Gerado pelo Nano Banana Pro
Comando: "Use a pesquisa para saber como foi a recepção do lançamento do Gemini 3 Flash. Use essas informações para escrever um pequeno artigo sobre o assunto (com títulos). Retorne uma foto do artigo como ele apareceu em uma revista brilhante focada em design. É uma foto de uma única página dobrada, mostrando o artigo sobre o Gemini 3 Flash. Uma foto principal. Título em serifada."
Gerar texto preciso com base na pesquisa. Teste o Nano Banana no AI Studio
café
Gerado pelo Nano Banana Pro
Comando: "Uma foto de uma cena cotidiana em um café movimentado que serve café da manhã. Em primeiro plano, um homem de anime com cabelo azul, uma das pessoas é um esboço a lápis, outra é uma pessoa de animação com massa de modelar"
Teste diferentes estilos artísticos com o Nano Banana no AI Studio
cachorro
Gerado pelo Nano Banana Pro
Comando: "Um ícone representando um cachorro fofo. O fundo é branco. Faça os ícones em um estilo 3D colorido e tátil. Sem texto."
Crie ícones, adesivos e recursos com o Nano Banana no AI Studio
isométrico
Gerado pelo Nano Banana Pro
Comando: "Crie uma foto perfeitamente isométrica. Não é uma miniatura, é uma foto capturada que acabou sendo perfeitamente isométrica. É uma foto de um lindo interior de escritório moderno".
Teste a geração de imagens fotorrealistas no AI Studio


Slide atual: 1

Slide atual: 2

Slide atual: 3

Slide atual: 4

Slide atual: 5

Slide atual: 6

Slide atual: 7

Slide atual: 8

Slide atual: 9
Nano Banana é o nome dos recursos nativos de geração de imagens do Gemini. O Gemini pode gerar e processar imagens de forma conversacional com texto, imagens ou uma combinação dos dois. Isso permite criar, editar e iterar recursos visuais com um controle sem precedentes.

O Nano Banana se refere a dois modelos distintos disponíveis na API Gemini:

Nano Banana: o modelo Gemini 2.5 Flash Image (gemini-2.5-flash-image). Ele foi projetado para velocidade e eficiência, otimizado para tarefas de alto volume e baixa latência.
Nano Banana Pro: o modelo Prévia de imagem do Gemini 3 Pro (gemini-3-pro-image-preview). Ele foi projetado para produção de recursos profissionais, usando raciocínio avançado ("Pensamento") para seguir instruções complexas e renderizar texto de alta fidelidade.
Todas as imagens geradas incluem uma marca-d'água do SynthID.

Geração de imagens (conversão de texto em imagem)
Python
JavaScript
Go
Java
REST

from google import genai
from google.genai import types
from PIL import Image

client = genai.Client()

prompt = ("Create a picture of a nano banana dish in a fancy restaurant with a Gemini theme")
response = client.models.generate_content(
    model="gemini-2.5-flash-image",
    contents=[prompt],
)

for part in response.parts:
    if part.text is not None:
        print(part.text)
    elif part.inline_data is not None:
        image = part.as_image()
        image.save("generated_image.png")
Edição de imagens (texto e imagem para imagem)
Lembrete: confira se você tem os direitos necessários sobre as imagens que enviar. Não gere conteúdo que viole os direitos de terceiros, incluindo vídeos ou imagens que enganem, assediem ou prejudiquem pessoas. O uso deste serviço de IA generativa está sujeito à nossa Política de uso proibido.

Forneça uma imagem e use comandos de texto para adicionar, remover ou modificar elementos, mudar o estilo ou ajustar a gradação de cores.

O exemplo a seguir demonstra o upload de imagens codificadas em base64. Para várias imagens, payloads maiores e tipos MIME compatíveis, consulte a página Entendimento de imagens.

Python
JavaScript
Go
Java
REST

from google import genai
from google.genai import types
from PIL import Image

client = genai.Client()

prompt = (
    "Create a picture of my cat eating a nano-banana in a "
    "fancy restaurant under the Gemini constellation",
)

image = Image.open("/path/to/cat_image.png")

response = client.models.generate_content(
    model="gemini-2.5-flash-image",
    contents=[prompt, image],
)

for part in response.parts:
    if part.text is not None:
        print(part.text)
    elif part.inline_data is not None:
        image = part.as_image()
        image.save("generated_image.png")
Edição de imagens em várias etapas
Continue gerando e editando imagens por conversa. O chat ou a conversa em vários turnos é a maneira recomendada de iterar imagens. O exemplo a seguir mostra um comando para gerar um infográfico sobre a fotossíntese.

Python
JavaScript
Go
Java
REST

from google import genai
from google.genai import types

client = genai.Client()

chat = client.chats.create(
    model="gemini-3-pro-image-preview",
    config=types.GenerateContentConfig(
        response_modalities=['TEXT', 'IMAGE'],
        tools=[{"google_search": {}}]
    )
)

message = "Create a vibrant infographic that explains photosynthesis as if it were a recipe for a plant's favorite food. Show the \"ingredients\" (sunlight, water, CO2) and the \"finished dish\" (sugar/energy). The style should be like a page from a colorful kids' cookbook, suitable for a 4th grader."

response = chat.send_message(message)

for part in response.parts:
    if part.text is not None:
        print(part.text)
    elif image:= part.as_image():
        image.save("photosynthesis.png")
Infográfico gerado com IA sobre a fotossíntese
Infográfico gerado com IA sobre a fotossíntese
Em seguida, use o mesmo chat para mudar o idioma do gráfico para espanhol.

Python
JavaScript
Go
Java
REST

message = "Update this infographic to be in Spanish. Do not change any other elements of the image."
aspect_ratio = "16:9" # "1:1","2:3","3:2","3:4","4:3","4:5","5:4","9:16","16:9","21:9"
resolution = "2K" # "1K", "2K", "4K"

response = chat.send_message(message,
    config=types.GenerateContentConfig(
        image_config=types.ImageConfig(
            aspect_ratio=aspect_ratio,
            image_size=resolution
        ),
    ))

for part in response.parts:
    if part.text is not None:
        print(part.text)
    elif image:= part.as_image():
        image.save("photosynthesis_spanish.png")
Infográfico gerado com IA sobre a fotossíntese em espanhol
Infográfico gerado com IA sobre a fotossíntese em espanhol
Novidade do Gemini 3 Pro Image
O Gemini 3 Pro Image (gemini-3-pro-image-preview) é um modelo de edição e geração de imagens de última geração otimizado para produção de recursos profissionais. Projetado para lidar com os fluxos de trabalho mais desafiadores usando raciocínio avançado, ele é excelente em tarefas complexas de criação e modificação em várias etapas.

Saída de alta resolução: recursos de geração integrados para visuais de 1K, 2K e 4K.
Renderização de texto avançada: capaz de gerar texto legível e estilizado para infográficos, menus, diagramas e recursos de marketing.
Embasamento com a Pesquisa Google: o modelo pode usar a Pesquisa Google como uma ferramenta para verificar fatos e gerar imagens com base em dados em tempo real (por exemplo, mapas meteorológicos atuais, gráficos de ações, eventos recentes).
Modo de raciocínio: o modelo usa um processo de "raciocínio" para analisar comandos complexos. Ele gera "imagens de pensamento" provisórias (visíveis no back-end, mas não cobradas) para refinar a composição antes de produzir a saída final de alta qualidade.
Até 14 imagens de referência: agora você pode misturar até 14 imagens de referência para produzir a imagem final.
Usar até 14 imagens de referência
Com o pré-lançamento do Gemini 3 Pro, você pode combinar até 14 imagens de referência. Essas 14 imagens podem incluir o seguinte:

Até seis imagens de objetos com alta fidelidade para incluir na imagem final
Até cinco imagens de humanos para manter a consistência do personagem

Python
JavaScript
Go
Java
REST

from google import genai
from google.genai import types
from PIL import Image

prompt = "An office group photo of these people, they are making funny faces."
aspect_ratio = "5:4" # "1:1","2:3","3:2","3:4","4:3","4:5","5:4","9:16","16:9","21:9"
resolution = "2K" # "1K", "2K", "4K"

client = genai.Client()

response = client.models.generate_content(
    model="gemini-3-pro-image-preview",
    contents=[
        prompt,
        Image.open('person1.png'),
        Image.open('person2.png'),
        Image.open('person3.png'),
        Image.open('person4.png'),
        Image.open('person5.png'),
    ],
    config=types.GenerateContentConfig(
        response_modalities=['TEXT', 'IMAGE'],
        image_config=types.ImageConfig(
            aspect_ratio=aspect_ratio,
            image_size=resolution
        ),
    )
)

for part in response.parts:
    if part.text is not None:
        print(part.text)
    elif image:= part.as_image():
        image.save("office.png")
Foto de grupo do escritório gerada com IA
Foto de grupo do escritório gerada com IA
Embasamento com a Pesquisa Google
Use a ferramenta da Pesquisa Google para gerar imagens com base em informações em tempo real, como previsões do tempo, gráficos de ações ou eventos recentes.

Ao usar o Embasamento com a Pesquisa Google para gerar imagens, os resultados da pesquisa baseados em imagens não são transmitidos ao modelo de geração e são excluídos da resposta.

Python
JavaScript
Java
REST

from google import genai
prompt = "Visualize the current weather forecast for the next 5 days in San Francisco as a clean, modern weather chart. Add a visual on what I should wear each day"
aspect_ratio = "16:9" # "1:1","2:3","3:2","3:4","4:3","4:5","5:4","9:16","16:9","21:9"

client = genai.Client()

response = client.models.generate_content(
    model="gemini-3-pro-image-preview",
    contents=prompt,
    config=types.GenerateContentConfig(
        response_modalities=['Text', 'Image'],
        image_config=types.ImageConfig(
            aspect_ratio=aspect_ratio,
        ),
        tools=[{"google_search": {}}]
    )
)

for part in response.parts:
    if part.text is not None:
        print(part.text)
    elif image:= part.as_image():
        image.save("weather.png")
Gráfico de previsão do tempo de cinco dias gerado com IA para São Francisco
Gráfico de previsão do tempo de cinco dias gerado por IA para São Francisco
A resposta inclui groundingMetadata, que contém os seguintes campos obrigatórios:

searchEntryPoint: contém o HTML e o CSS para renderizar as sugestões de pesquisa necessárias.
groundingChunks: retorna as três principais fontes da Web usadas para embasar a imagem gerada.
Gerar imagens com resolução de até 4K
O Gemini 3 Pro Image gera imagens em 1K por padrão, mas também pode gerar imagens em 2K e 4K. Para gerar recursos de resolução mais alta, especifique image_size em generation_config.

Use um "K" maiúsculo (por exemplo, 1K, 2K, 4K). Parâmetros em letras minúsculas (por exemplo, 1k) será rejeitado.

Python
JavaScript
Go
Java
REST

from google import genai
from google.genai import types

prompt = "Da Vinci style anatomical sketch of a dissected Monarch butterfly. Detailed drawings of the head, wings, and legs on textured parchment with notes in English." 
aspect_ratio = "1:1" # "1:1","2:3","3:2","3:4","4:3","4:5","5:4","9:16","16:9","21:9"
resolution = "1K" # "1K", "2K", "4K"

client = genai.Client()

response = client.models.generate_content(
    model="gemini-3-pro-image-preview",
    contents=prompt,
    config=types.GenerateContentConfig(
        response_modalities=['TEXT', 'IMAGE'],
        image_config=types.ImageConfig(
            aspect_ratio=aspect_ratio,
            image_size=resolution
        ),
    )
)

for part in response.parts:
    if part.text is not None:
        print(part.text)
    elif image:= part.as_image():
        image.save("butterfly.png")
Confira um exemplo de imagem gerada com esse comando:

Esboço anatômico de uma borboleta monarca dissecada no estilo Da Vinci gerado por IA.
Esboço anatômico de uma borboleta monarca dissecada no estilo de Da Vinci gerado por IA.
Linha de raciocínio
O modelo Gemini 3 Pro Image Preview é um modelo de raciocínio e usa um processo de raciocínio ("Raciocínio") para comandos complexos. Esse recurso é ativado por padrão e não pode ser desativado na API. Para saber mais sobre o processo de pensamento, consulte o guia Pensamento do Gemini.

O modelo gera até duas imagens provisórias para testar a composição e a lógica. A última imagem em "Pensando" também é a imagem renderizada final.

Você pode conferir as ideias que levaram à produção da imagem final.

Python
JavaScript

for part in response.parts:
    if part.thought:
        if part.text:
            print(part.text)
        elif image:= part.as_image():
            image.show()
Thought Signatures
As assinaturas de pensamento são representações criptografadas do processo de raciocínio interno do modelo e são usadas para preservar o contexto de raciocínio em interações de várias rodadas. Todas as respostas incluem um campo thought_signature. Como regra geral, se você receber uma assinatura de pensamento em uma resposta do modelo, transmita-a exatamente como foi recebida ao enviar o histórico da conversa na próxima vez. Se não fizer isso, a resposta pode falhar. Consulte a documentação sobre assinatura de pensamento para mais explicações sobre assinaturas em geral.

Observação: se você usa os SDKs oficiais de IA generativa do Google e o recurso de chat (ou anexa o objeto de resposta do modelo completo diretamente ao histórico), as assinaturas de pensamento são processadas automaticamente. Não é necessário extrair ou gerenciar manualmente nem mudar o código.
Confira como elas funcionam:

Todas as partes inline_data com a imagem mimetype que fazem parte da resposta precisam ter assinatura.
Se houver partes de texto no início (antes de qualquer imagem) logo após os pensamentos, a primeira parte de texto também deverá ter uma assinatura.
Se inline_data partes com a imagem mimetype fizerem parte de pensamentos, elas não terão assinaturas.
O código a seguir mostra um exemplo de onde as assinaturas de pensamento são incluídas:


[
  {
    "inline_data": {
      "data": "<base64_image_data_0>",
      "mime_type": "image/png"
    },
    "thought": true // Thoughts don't have signatures
  },
  {
    "inline_data": {
      "data": "<base64_image_data_1>",
      "mime_type": "image/png"
    },
    "thought": true // Thoughts don't have signatures
  },
  {
    "inline_data": {
      "data": "<base64_image_data_2>",
      "mime_type": "image/png"
    },
    "thought": true // Thoughts don't have signatures
  },
  {
    "text": "Here is a step-by-step guide to baking macarons, presented in three separate images.\n\n### Step 1: Piping the Batter\n\nThe first step after making your macaron batter is to pipe it onto a baking sheet. This requires a steady hand to create uniform circles.\n\n",
    "thought_signature": "<Signature_A>" // The first non-thought part always has a signature
  },
  {
    "inline_data": {
      "data": "<base64_image_data_3>",
      "mime_type": "image/png"
    },
    "thought_signature": "<Signature_B>" // All image parts have a signatures
  },
  {
    "text": "\n\n### Step 2: Baking and Developing Feet\n\nOnce piped, the macarons are baked in the oven. A key sign of a successful bake is the development of \"feet\"—the ruffled edge at the base of each macaron shell.\n\n"
    // Follow-up text parts don't have signatures
  },
  {
    "inline_data": {
      "data": "<base64_image_data_4>",
      "mime_type": "image/png"
    },
    "thought_signature": "<Signature_C>" // All image parts have a signatures
  },
  {
    "text": "\n\n### Step 3: Assembling the Macaron\n\nThe final step is to pair the cooled macaron shells by size and sandwich them together with your desired filling, creating the classic macaron dessert.\n\n"
  },
  {
    "inline_data": {
      "data": "<base64_image_data_5>",
      "mime_type": "image/png"
    },
    "thought_signature": "<Signature_D>" // All image parts have a signatures
  }
]
Outros modos de geração de imagens
O Gemini oferece suporte a outros modos de interação com imagens com base na estrutura e no contexto do comando, incluindo:

Texto para imagens e texto (intercalado): gera imagens com texto relacionado.
Exemplo de comando: "Gere uma receita ilustrada de paella".
Imagens e texto para imagens e texto (intercalados): usa imagens e texto de entrada para criar novas imagens e texto relacionados.
Comando de exemplo: (com uma imagem de um quarto mobiliado) "Quais outros sofás de cores ficariam bons no meu espaço? Você pode atualizar a imagem?"
Gerar imagens em lote
Se você precisar gerar muitas imagens, use a API Batch. Você recebe limites de taxa mais altos em troca de um tempo de resposta de até 24 horas.

Confira a documentação da API Batch para geração de imagens e o cookbook para exemplos e código de imagens da API Batch.

Guia e estratégias para a criação de comandos
Para dominar a geração de imagens, é preciso entender um princípio fundamental:

Descreva a cena, não apenas liste palavras-chave. O principal ponto forte do modelo é a compreensão profunda da linguagem. Um parágrafo narrativo e descritivo quase sempre produz uma imagem melhor e mais coerente do que uma lista de palavras desconectadas.

Comandos para gerar imagens
As estratégias a seguir vão ajudar você a criar comandos eficazes para gerar exatamente as imagens que procura.

1. Cenas fotorrealistas
Para imagens realistas, use termos de fotografia. Mencione ângulos de câmera, tipos de lente, iluminação e detalhes para guiar o modelo a um resultado fotorrealista.

Modelo
Comando
Python
Java
JavaScript
Go
REST

from google import genai
from google.genai import types    

client = genai.Client()

response = client.models.generate_content(
    model="gemini-2.5-flash-image",
    contents="A photorealistic close-up portrait of an elderly Japanese ceramicist with deep, sun-etched wrinkles and a warm, knowing smile. He is carefully inspecting a freshly glazed tea bowl. The setting is his rustic, sun-drenched workshop with pottery wheels and shelves of clay pots in the background. The scene is illuminated by soft, golden hour light streaming through a window, highlighting the fine texture of the clay and the fabric of his apron. Captured with an 85mm portrait lens, resulting in a soft, blurred background (bokeh). The overall mood is serene and masterful.",
)

for part in response.parts:
    if part.text is not None:
        print(part.text)
    elif part.inline_data is not None:
        image = part.as_image()
        image.save("photorealistic_example.png")
Um retrato fotorrealista em close de um ceramista japonês idoso...
Um retrato fotorrealista em close-up de um ceramista japonês idoso...
2. Ilustrações e adesivos estilizados
Para criar adesivos, ícones ou recursos, seja explícito sobre o estilo e peça um plano de fundo transparente.

Modelo
Comando
Python
Java
JavaScript
Go
REST

from google import genai
from google.genai import types

client = genai.Client()

response = client.models.generate_content(
    model="gemini-2.5-flash-image",
    contents="A kawaii-style sticker of a happy red panda wearing a tiny bamboo hat. It's munching on a green bamboo leaf. The design features bold, clean outlines, simple cel-shading, and a vibrant color palette. The background must be white.",
)

for part in response.parts:
    if part.text is not None:
        print(part.text)
    elif part.inline_data is not None:
        image = part.as_image()
        image.save("red_panda_sticker.png")
Um adesivo kawaii de um tomate vermelho feliz...
Um adesivo de estilo kawaii de um panda-vermelho feliz...
3. Texto preciso em imagens
O Gemini é excelente em renderização de texto. Seja claro sobre o texto, o estilo da fonte (de forma descritiva) e o design geral. Use a prévia de imagens do Gemini 3 Pro para produção de recursos profissionais.

Modelo
Comando
Python
Java
JavaScript
Go
REST

from google import genai
from google.genai import types    

client = genai.Client()

response = client.models.generate_content(
    model="gemini-3-pro-image-preview",
    contents="Create a modern, minimalist logo for a coffee shop called 'The Daily Grind'. The text should be in a clean, bold, sans-serif font. The color scheme is black and white. Put the logo in a circle. Use a coffee bean in a clever way.",
    config=types.GenerateContentConfig(
        image_config=types.ImageConfig(
            aspect_ratio="1:1",
        )
    )
)

for part in response.parts:
    if part.text is not None:
        print(part.text)
    elif part.inline_data is not None:
        image = part.as_image()
        image.save("logo_example.jpg")
Crie um logotipo moderno e minimalista para uma cafeteria chamada &quot;The Daily Grind&quot;...
Crie um logotipo moderno e minimalista para uma cafeteria chamada "The Daily Grind"...
4. Simulações de produtos e fotografia comercial
Perfeito para criar fotos de produtos limpas e profissionais para e-commerce, publicidade ou branding.

Modelo
Comando
Python
Java
JavaScript
Go
REST

from google import genai
from google.genai import types

client = genai.Client()

response = client.models.generate_content(
    model="gemini-2.5-flash-image",
    contents="A high-resolution, studio-lit product photograph of a minimalist ceramic coffee mug in matte black, presented on a polished concrete surface. The lighting is a three-point softbox setup designed to create soft, diffused highlights and eliminate harsh shadows. The camera angle is a slightly elevated 45-degree shot to showcase its clean lines. Ultra-realistic, with sharp focus on the steam rising from the coffee. Square image.",
)

for part in response.parts:
    if part.text is not None:
        print(part.text)
    elif part.inline_data is not None:
        image = part.as_image()
        image.save("product_mockup.png")
Uma foto de produto em alta resolução e iluminada em estúdio de uma xícara de café de cerâmica minimalista...
Uma foto de produto em alta resolução, iluminada em estúdio, de uma xícara de café de cerâmica minimalista...
5. Design minimalista e com espaço negativo
Excelente para criar planos de fundo para sites, apresentações ou materiais de marketing em que o texto será sobreposto.

Modelo
Comando
Python
Java
JavaScript
Go
REST

from google import genai
from google.genai import types    

client = genai.Client()

response = client.models.generate_content(
    model="gemini-2.5-flash-image",
    contents="A minimalist composition featuring a single, delicate red maple leaf positioned in the bottom-right of the frame. The background is a vast, empty off-white canvas, creating significant negative space for text. Soft, diffused lighting from the top left. Square image.",
)

for part in response.parts:
    if part.text is not None:
        print(part.text)
    elif part.inline_data is not None:
        image = part.as_image()
        image.save("minimalist_design.png")
Uma composição minimalista com uma única folha delicada de bordo vermelho...
Uma composição minimalista com uma única folha de bordo vermelha delicada...
6. Arte sequencial (painel de quadrinhos / storyboard)
Cria painéis para contar histórias visuais com base na consistência dos personagens e na descrição das cenas. Para precisão com texto e capacidade de contar histórias, esses comandos funcionam melhor com o Gemini 3 Pro Image Preview.

Modelo
Comando
Python
Java
JavaScript
Go
REST

from google import genai
from google.genai import types
from PIL import Image

client = genai.Client()

image_input = Image.open('/path/to/your/man_in_white_glasses.jpg')
text_input = "Make a 3 panel comic in a gritty, noir art style with high-contrast black and white inks. Put the character in a humurous scene."

response = client.models.generate_content(
    model="gemini-3-pro-image-preview",
    contents=[text_input, image_input],
)

for part in response.parts:
    if part.text is not None:
        print(part.text)
    elif part.inline_data is not None:
        image = part.as_image()
        image.save("comic_panel.jpg")
Entrada

Saída

Homem de óculos brancos
Imagem de entrada
Faça uma história em quadrinhos de três painéis em um estilo de arte noir e sombrio...
Crie uma história em quadrinhos de três painéis em um estilo de arte noir e sombrio...
7. Embasamento com a Pesquisa Google
Use a Pesquisa Google para gerar imagens com base em informações recentes ou em tempo real. Isso é útil para notícias, clima e outros assuntos urgentes.

Comando
Python
Java
JavaScript
Go
REST

from google import genai
from google.genai import types
prompt = "Make a simple but stylish graphic of last night's Arsenal game in the Champion's League"
aspect_ratio = "16:9" # "1:1","2:3","3:2","3:4","4:3","4:5","5:4","9:16","16:9","21:9"

client = genai.Client()

response = client.models.generate_content(
    model="gemini-3-pro-image-preview",
    contents=prompt,
    config=types.GenerateContentConfig(
        response_modalities=['Text', 'Image'],
        image_config=types.ImageConfig(
            aspect_ratio=aspect_ratio,
        ),
        tools=[{"google_search": {}}]
    )
)

for part in response.parts:
    if part.text is not None:
        print(part.text)
    elif image:= part.as_image():
        image.save("football-score.jpg")
Gráfico gerado por IA de um placar de futebol do Arsenal
Gráfico gerado por IA de um placar de futebol do Arsenal
Comandos para editar imagens
Estes exemplos mostram como fornecer imagens junto com seus comandos de texto para edição, composição e transferência de estilo.

1. Adicionar e remover elementos
Forneça uma imagem e descreva a mudança. O modelo vai corresponder ao estilo, à iluminação e à perspectiva da imagem original.

Modelo
Comando
Python
Java
JavaScript
Go
REST

from google import genai
from google.genai import types
from PIL import Image

client = genai.Client()

# Base image prompt: "A photorealistic picture of a fluffy ginger cat sitting on a wooden floor, looking directly at the camera. Soft, natural light from a window."
image_input = Image.open('/path/to/your/cat_photo.png')
text_input = """Using the provided image of my cat, please add a small, knitted wizard hat on its head. Make it look like it's sitting comfortably and not falling off."""

# Generate an image from a text prompt
response = client.models.generate_content(
    model="gemini-2.5-flash-image",
    contents=[text_input, image_input],
)

for part in response.parts:
    if part.text is not None:
        print(part.text)
    elif part.inline_data is not None:
        image = part.as_image()
        image.save("cat_with_hat.png")
Entrada

Saída

Uma imagem fotorrealista de um gato ruivo fofo.
Uma imagem fotorealista de um gato ruivo fofo...
Usando a imagem fornecida do meu gato, adicione um pequeno chapéu de mago de tricô...
Usando a imagem fornecida do meu gato, adicione um chapéu de mago pequeno e de tricô...
2. Retoque (mascaramento semântico)
Defina uma "máscara" por conversa para editar uma parte específica de uma imagem sem alterar o restante.

Modelo
Comando
Python
Java
JavaScript
Go
REST

from google import genai
from google.genai import types
from PIL import Image

client = genai.Client()

# Base image prompt: "A wide shot of a modern, well-lit living room with a prominent blue sofa in the center. A coffee table is in front of it and a large window is in the background."
living_room_image = Image.open('/path/to/your/living_room.png')
text_input = """Using the provided image of a living room, change only the blue sofa to be a vintage, brown leather chesterfield sofa. Keep the rest of the room, including the pillows on the sofa and the lighting, unchanged."""

# Generate an image from a text prompt
response = client.models.generate_content(
    model="gemini-2.5-flash-image",
    contents=[living_room_image, text_input],
)

for part in response.parts:
    if part.text is not None:
        print(part.text)
    elif part.inline_data is not None:
        image = part.as_image()
        image.save("living_room_edited.png")
Entrada

Saída

Uma tomada ampla de uma sala de estar moderna e bem iluminada...
Uma foto ampla de uma sala de estar moderna e bem iluminada...
Usando a imagem fornecida de uma sala de estar, mude apenas o sofá azul para um sofá vintage de couro marrom estilo Chesterfield...
Usando a imagem fornecida de uma sala de estar, mude apenas o sofá azul para um sofá Chesterfield vintage de couro marrom...
3. Transferência de estilo
Forneça uma imagem e peça para o modelo recriar o conteúdo dela em um estilo artístico diferente.

Modelo
Comando
Python
Java
JavaScript
Go
REST

from google import genai
from google.genai import types
from PIL import Image

client = genai.Client()

# Base image prompt: "A photorealistic, high-resolution photograph of a busy city street in New York at night, with bright neon signs, yellow taxis, and tall skyscrapers."
city_image = Image.open('/path/to/your/city.png')
text_input = """Transform the provided photograph of a modern city street at night into the artistic style of Vincent van Gogh's 'Starry Night'. Preserve the original composition of buildings and cars, but render all elements with swirling, impasto brushstrokes and a dramatic palette of deep blues and bright yellows."""

# Generate an image from a text prompt
response = client.models.generate_content(
    model="gemini-2.5-flash-image",
    contents=[city_image, text_input],
)

for part in response.parts:
    if part.text is not None:
        print(part.text)
    elif part.inline_data is not None:
        image = part.as_image()
        image.save("city_style_transfer.png")
Entrada

Saída

Uma fotografia fotorrealista de alta resolução de uma rua movimentada...
Uma fotografia fotorrealista de alta resolução de uma rua movimentada...
Transforme a fotografia fornecida de uma rua moderna da cidade à noite...
Transforme a fotografia fornecida de uma rua moderna da cidade à noite...
4. Composição avançada: combinar várias imagens
Forneça várias imagens como contexto para criar uma cena nova e composta. Isso é perfeito para simulações de produtos ou colagens criativas.

Modelo
Comando
Python
Java
JavaScript
Go
REST

from google import genai
from google.genai import types
from PIL import Image

client = genai.Client()

# Base image prompts:
# 1. Dress: "A professionally shot photo of a blue floral summer dress on a plain white background, ghost mannequin style."
# 2. Model: "Full-body shot of a woman with her hair in a bun, smiling, standing against a neutral grey studio background."
dress_image = Image.open('/path/to/your/dress.png')
model_image = Image.open('/path/to/your/model.png')

text_input = """Create a professional e-commerce fashion photo. Take the blue floral dress from the first image and let the woman from the second image wear it. Generate a realistic, full-body shot of the woman wearing the dress, with the lighting and shadows adjusted to match the outdoor environment."""

# Generate an image from a text prompt
response = client.models.generate_content(
    model="gemini-2.5-flash-image",
    contents=[dress_image, model_image, text_input],
)

for part in response.parts:
    if part.text is not None:
        print(part.text)
    elif part.inline_data is not None:
        image = part.as_image()
        image.save("fashion_ecommerce_shot.png")
Entrada 1

Entrada 2

Saída

Uma foto profissional de um vestido de verão azul com estampa floral...
Uma foto profissional de um vestido de verão azul com estampa floral...
Foto de corpo inteiro de uma mulher com o cabelo preso em um coque...
Foto de corpo inteiro de uma mulher com o cabelo preso em um coque...
Crie uma foto profissional de moda para e-commerce...
Crie uma foto profissional de moda para e-commerce...
5. Preservação de detalhes de alta fidelidade
Para garantir que detalhes importantes (como um rosto ou um logotipo) sejam preservados durante uma edição, descreva-os com muitos detalhes junto com sua solicitação de edição.

Modelo
Comando
Python
Java
JavaScript
Go
REST

from google import genai
from google.genai import types
from PIL import Image

client = genai.Client()

# Base image prompts:
# 1. Woman: "A professional headshot of a woman with brown hair and blue eyes, wearing a plain black t-shirt, against a neutral studio background."
# 2. Logo: "A simple, modern logo with the letters 'G' and 'A' in a white circle."
woman_image = Image.open('/path/to/your/woman.png')
logo_image = Image.open('/path/to/your/logo.png')
text_input = """Take the first image of the woman with brown hair, blue eyes, and a neutral expression. Add the logo from the second image onto her black t-shirt. Ensure the woman's face and features remain completely unchanged. The logo should look like it's naturally printed on the fabric, following the folds of the shirt."""

# Generate an image from a text prompt
response = client.models.generate_content(
    model="gemini-2.5-flash-image",
    contents=[woman_image, logo_image, text_input],
)

for part in response.parts:
    if part.text is not None:
        print(part.text)
    elif part.inline_data is not None:
        image = part.as_image()
        image.save("woman_with_logo.png")
Entrada 1

Entrada 2

Saída

Uma foto profissional de uma mulher com cabelo castanho e olhos azuis...
Um retrato profissional de uma mulher com cabelo castanho e olhos azuis...
Um logotipo simples e moderno com as letras &quot;G&quot; e &quot;A&quot;...
Um logotipo simples e moderno com as letras "G" e "A"...
Pegue a primeira imagem da mulher com cabelo castanho, olhos azuis e uma expressão neutra...
Pegue a primeira imagem da mulher com cabelo castanho, olhos azuis e uma expressão neutra...
6. Dar vida a algo
Faça upload de um esboço ou desenho e peça ao modelo para refinar e criar uma imagem finalizada.

Modelo
Comando
Python
Java
JavaScript
Go
REST

from google import genai
from PIL import Image

client = genai.Client()

# Base image prompt: "A rough pencil sketch of a flat sports car on white paper."
sketch_image = Image.open('/path/to/your/car_sketch.png')
text_input = """Turn this rough pencil sketch of a futuristic car into a polished photo of the finished concept car in a showroom. Keep the sleek lines and low profile from the sketch but add metallic blue paint and neon rim lighting."""

response = client.models.generate_content(
    model="gemini-3-pro-image-preview",
    contents=[sketch_image, text_input],
)

for part in response.parts:
    if part.text is not None:
        print(part.text)
    elif part.inline_data is not None:
        image = part.as_image()
        image.save("car_photo.png")
Entrada

Saída

Esboço de um carro
Esboço de um carro
Saída mostrando o carro conceito final
Foto refinada de um carro
7. Consistência de personagens: visualização completa
Você pode gerar visualizações de 360 graus de um personagem pedindo ângulos diferentes de forma iterativa. Para ter os melhores resultados, inclua imagens geradas anteriormente em comandos subsequentes para manter a consistência. Para poses complexas, inclua uma imagem de referência da pose desejada.

Modelo
Comando
Python
Java
JavaScript
Go
REST

from google import genai
from google.genai import types
from PIL import Image

client = genai.Client()

image_input = Image.open('/path/to/your/man_in_white_glasses.jpg')
text_input = """A studio portrait of this man against white, in profile looking right"""

response = client.models.generate_content(
    model="gemini-3-pro-image-preview",
    contents=[text_input, image_input],
)

for part in response.parts:
    if part.text is not None:
        print(part.text)
    elif part.inline_data is not None:
        image = part.as_image()
        image.save("man_right_profile.png")
Entrada

Saída 1

Saída 2

Entrada original de um homem com óculos brancos
Imagem original
Saída de um homem de óculos brancos olhando para a direita
Homem de óculos brancos olhando para a direita
Saída de um homem com óculos brancos olhando para frente
Homem de óculos brancos olhando para frente
Práticas recomendadas
Para melhorar ainda mais seus resultados, incorpore estas estratégias profissionais ao seu fluxo de trabalho.

Seja muito específico:quanto mais detalhes você fornecer, mais controle terá. Em vez de "armadura de fantasia", descreva: "armadura de placas élfica ornamentada, gravada com padrões de folhas de prata, com uma gola alta e ombreiras em forma de asas de falcão".
Forneça contexto e intenção:explique o propósito da imagem. A compreensão do contexto pelo modelo influencia a saída final. Por exemplo, "Crie um logotipo para uma marca de skincare minimalista e sofisticada" vai gerar resultados melhores do que apenas "Crie um logotipo".
Itere e refine:não espere uma imagem perfeita na primeira tentativa. Use a natureza conversacional do modelo para fazer pequenas mudanças. Faça perguntas como: "Ótimo, mas você pode deixar a iluminação um pouco mais quente?" ou "Mantenha tudo igual, mas mude a expressão do personagem para algo mais sério".
Use instruções detalhadas:para cenas complexas com muitos elementos, divida o comando em etapas. "Primeiro, crie um plano de fundo de uma floresta serena e enevoada ao amanhecer. Em seguida, em primeiro plano, adicione um altar de pedra antigo coberto de musgo. Por fim, coloque uma única espada brilhante em cima do altar."
Use comandos negativos semânticos: em vez de dizer "sem carros", descreva a cena desejada de forma positiva: "uma rua vazia e deserta sem sinais de trânsito".
Controle a câmera:use linguagem fotográfica e cinematográfica para controlar a composição. Termos como wide-angle shot, macro shot e low-angle perspective.
Limitações
Para ter o melhor desempenho, use os seguintes idiomas: EN, ar-EG, de-DE, es-MX, fr-FR, hi-IN, id-ID, it-IT, ja-JP, ko-KR, pt-BR, ru-RU, ua-UA, vi-VN, zh-CN.
A geração de imagens não aceita entradas de áudio ou vídeo.
O modelo nem sempre segue o número exato de imagens que o usuário pede explicitamente.
O gemini-2.5-flash-image funciona melhor com até três imagens como entrada, enquanto o gemini-3-pro-image-preview aceita cinco imagens com alta fidelidade e até 14 imagens no total.
Ao gerar texto para uma imagem, o Gemini funciona melhor se você primeiro gerar o texto e depois pedir uma imagem com ele.
Todas as imagens geradas incluem uma marca-d'água do SynthID.
Configurações opcionais
Você pode configurar as modalidades de resposta e a proporção da saída do modelo no campo config das chamadas generate_content.

Tipos de saída
Por padrão, o modelo retorna respostas de texto e imagem (ou seja, response_modalities=['Text', 'Image']). Você pode configurar a resposta para retornar apenas imagens sem texto usando response_modalities=['Image'].

Python
JavaScript
Go
Java
REST

response = client.models.generate_content(
    model="gemini-2.5-flash-image",
    contents=[prompt],
    config=types.GenerateContentConfig(
        response_modalities=['Image']
    )
)
Proporções e tamanho da imagem
Por padrão, o modelo corresponde o tamanho da imagem de saída ao da imagem de entrada ou gera quadrados 1:1. É possível controlar a proporção da imagem de saída usando o campo aspect_ratio em image_config na solicitação de resposta, mostrada aqui:

Python
JavaScript
Go
Java
REST

# For gemini-2.5-flash-image
response = client.models.generate_content(
    model="gemini-2.5-flash-image",
    contents=[prompt],
    config=types.GenerateContentConfig(
        image_config=types.ImageConfig(
            aspect_ratio="16:9",
        )
    )
)

# For gemini-3-pro-image-preview
response = client.models.generate_content(
    model="gemini-3-pro-image-preview",
    contents=[prompt],
    config=types.GenerateContentConfig(
        image_config=types.ImageConfig(
            aspect_ratio="16:9",
            image_size="2K",
        )
    )
)
As diferentes proporções disponíveis e o tamanho da imagem gerada estão listados nas tabelas a seguir:

Criação de Imagens do Gemini 2.5 Flash

Proporção	Resolução	Tokens
1:1	1024x1024	1290
2:3	832x1248	1290
3:2	1248x832	1290
3:4	864x1184	1290
4:3	1184x864	1290
4:5	896x1152	1290
5:4	1152x896	1290
9:16	768x1344	1290
16:9	1344x768	1290
21:9	1536x672	1290
Pré-lançamento do Gemini 3 Pro Image

Proporção	Resolução 1K	1.000 tokens	Resolução 2K	2 mil tokens	Resolução 4K	4 mil tokens
1:1	1024x1024	1120	2.048 x 2.048	1120	4096x4096	2000
2:3	848x1264	1120	1696x2528	1120	3392x5056	2000
3:2	1264x848	1120	2.528 x 1.696	1120	5056x3392	2000
3:4	896 x 1.200	1120	1792x2400	1120	3584x4800	2000
4:3	1200x896	1120	2400x1792	1120	4800x3584	2000
4:5	928x1152	1120	1856x2304	1120	3712x4608	2000
5:4	1152x928	1120	2304x1856	1120	4.608 x 3.712	2000
9:16	768x1376	1120	1536x2752	1120	3072x5504	2000
16:9	1376x768	1120	2752x1536	1120	5504x3072	2000
21:9	1584x672	1120	3168x1344	1120	6336x2688	2000
Seleção de modelos
Escolha o modelo mais adequado ao seu caso de uso específico.

O pré-lançamento do Gemini 3 Pro Image (pré-lançamento do Nano Banana Pro) foi criado para produção de recursos profissionais e instruções complexas. Esse modelo tem embasamento no mundo real usando a Pesquisa Google, um processo padrão de "Pensamento" que refina a composição antes da geração e pode gerar imagens com resoluções de até 4K. Confira mais detalhes na página de preços e recursos do modelo.

O Gemini 2.5 Flash Image (Nano Banana) foi projetado para ser rápido e eficiente. Ele é otimizado para tarefas de alto volume e baixa latência e gera imagens com resolução de 1024 px. Confira mais detalhes na página Preços e recursos do modelo.