vamos criar um aplicativo simples que terá formulários para enviar para um webhook na minha automação no n8n que tem como objetivo gerar imagens com 'IA'

Quero que o aplicativo tenha uma na sua interface inicial opçoes para o usuario escolher qual KV quer usar inicialmente.

Opções de KV:

Graduação

MBA

Qualificações

Imersões

CHCS

Institucional

IMPORTANTE: Inicialmente só teremos funcionando a Graduação, os demais pode deixar um disclaimer de "em desenvolvimento"

Quando o usuario clica em um tipo de KV, vai para uma tela onde tem opções de "Tipos de comunicações".

Comunicações que teremos:

Whatsapp

Feed de Instagram

Banner Interno

Topo de e-mail

IMPORTANTE: Inicialmente só teremos funcionando o whatsapp, os demais pode deixar um disclaimer de "em desenvolvimento"

Agora, como funciona: Sempre que o usuario escolher um KV, tipo de comunicação, cada um terá um formulário especifico (que será vinculado a um http 'post' webhook unico daquele 'modelo')

Exemplo:

Graduação > Whatsapp > abrir formulário da requisição para gerar imagem

Agora falando sobre o formulário do Graduação/whatsapp especifico dele:

Webhook (HTTP method "POST): https://ens-automacao.app.n8n.cloud/webhook/graduação-whatsapp

O formulário do Graduação de whatsapp, deve conter os campos:

Título (texto) - json: titulo

Frase (texto) - json: frase

Box 1 (Texto) - json: text-box1

Box 2 (texto) - json: text-box2

Persona (texto com url da imagem) - json: persona_image

Ao preencher esse formulário, o webhook fazer a requisição desses dados em formato json, segue exemplo do json da graduação baseado nos campos que citamos acima:

{

"titulo": "Parabéns, João!",

"frase": "Você concluiu sua graduação.",

"text-box1": "Curso de Engenharia",

"text-box2": "2025",

"persona_image": " https://meusite.com/imagens/joao.png "

}

Lembrando de manter uma UI/UX avançada, seguindo ideias de design do design-system-ia.md e a paleta de cores deve seguir nossa cor institucional #009db7. outro ponto é a tipografia que usaremos no aplicativo tem que ser 100% a font outfit (e suas variações, negrito, etc)

Vamos usar recursos de design, bibliotecas que ajudem criarmos um visual bonito, inovador e com excelente UI/UX.

Nome do aplicativo: Design Nexus AI

