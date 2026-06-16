// Mock Service para simular a integração com n8n
// Futuramente, isso será substituído por chamadas reais ao Webhook

interface EmailGenerationRequest {
  userId: string;
  message: string;
  history: Array<{ role: "user" | "assistant"; content: string }>;
}

interface EmailGenerationResponse {
  html: string;
  suggestedSubject: string;
}

const ENS_TEMPLATE = (content: string) => `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Escola de Negócios e Seguros</title>
  <style>
    body { margin: 0; padding: 0; font-family: 'Arial', sans-serif; background-color: #f4f6f8; color: #333; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
    .header { background-color: #0047BA; padding: 30px 20px; text-align: center; }
    .header img { max-width: 150px; height: auto; }
    .content { padding: 40px 30px; line-height: 1.6; }
    .cta-button { display: inline-block; background-color: #F5A623; color: #ffffff; text-decoration: none; padding: 12px 30px; border-radius: 5px; font-weight: bold; margin-top: 20px; text-transform: uppercase; }
    .footer { background-color: #333333; color: #aaaaaa; padding: 20px; text-align: center; font-size: 12px; }
    h1 { color: #0047BA; font-size: 24px; margin-bottom: 20px; }
    p { margin-bottom: 15px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <!-- Placeholder Logo - Na versão real usar logo oficial hospedado -->
      <h2 style="color: white; margin: 0;">ENS</h2>
    </div>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} Escola de Negócios e Seguros. Todos os direitos reservados.</p>
      <p>Este e-mail foi gerado automaticamente por IA.</p>
    </div>
  </div>
</body>
</html>
`;

export const generateEmailMarketing = async (
  request: EmailGenerationRequest
): Promise<EmailGenerationResponse> => {
  // Simular delay de rede (2-4 segundos)
  await new Promise((resolve) => setTimeout(resolve, 2000 + Math.random() * 2000));

  console.log("Mock N8n Request:", request);

  // Lógica de Mock simples baseada na mensagem
  let htmlContent = "";
  let subject = "";

  if (request.message.toLowerCase().includes("venda") || request.message.toLowerCase().includes("oferta")) {
    subject = "Oportunidade Exclusiva: Potencialize sua Carreira em Seguros";
    htmlContent = `
      <h1>Transforme seu Futuro Profissional</h1>
      <p>Olá,</p>
      <p>O mercado de seguros está em constante evolução, e você precisa estar preparado para os novos desafios.</p>
      <p>Na <strong>Escola de Negócios e Seguros (ENS)</strong>, oferecemos a formação de excelência que você procura para alavancar sua carreira.</p>
      <p>Aproveite nossas condições especiais para matrículas realizadas nesta semana.</p>
      <div style="text-align: center;">
        <a href="#" class="cta-button">Garanta sua Vaga Agora</a>
      </div>
    `;
  } else if (request.message.toLowerCase().includes("boas vindas") || request.message.toLowerCase().includes("bem vindo")) {
    subject = "Bem-vindo à Comunidade ENS!";
    htmlContent = `
      <h1>Seja Bem-vindo à ENS</h1>
      <p>Estamos muito felizes em ter você conosco.</p>
      <p>Agora você faz parte de uma comunidade de profissionais dedicados à excelência no setor de seguros.</p>
      <p>Acesse nosso portal do aluno para começar sua jornada de aprendizado.</p>
      <div style="text-align: center;">
        <a href="#" class="cta-button">Acessar Portal</a>
      </div>
    `;
  } else {
    // Conteúdo Genérico
    subject = "Novidades da Escola de Negócios e Seguros";
    htmlContent = `
      <h1>Conhecimento que Gera Valor</h1>
      <p>Você sabia que a qualificação contínua é o principal diferencial dos líderes de mercado?</p>
      <p>A ENS traz para você os melhores cursos e conteúdos atualizados sobre o setor.</p>
      <p>Confira nossa grade curricular e escolha o próximo passo da sua carreira.</p>
      <div style="text-align: center;">
        <a href="#" class="cta-button">Saiba Mais</a>
      </div>
    `;
  }

  return {
    html: ENS_TEMPLATE(htmlContent),
    suggestedSubject: subject,
  };
};
