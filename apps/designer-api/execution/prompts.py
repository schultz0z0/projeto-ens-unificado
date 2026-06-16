from typing import Dict

# Dicionário de prompts centralizado para facilitar testes A/B e manutenção
PROMPTS: Dict[str, str] = {
    "adjustment_engineered": (
        "Você deve realizar EXATAMENTE a seguinte alteração solicitada: '{user_prompt}'.\n"
        "REGRA CRÍTICA: Mantenha a consistência visual de toda a imagem, não altere absolutamente nada "
        "(cores, tipografia, degradê, pessoa, logo, boxes) além do meu pedido acima."
    ),
    "adjustment_engineered_minimal": (
        "Aplique somente esta alteração: {user_prompt}.\n"
        "Não redesenhe a peça inteira. Mantenha rigorosamente o KV, a composição, a persona, a tipografia, as cores, os boxes, os logos, a nitidez e todos os elementos existentes fora da alteração. "
        "Entregue a mesma peça, apenas com a alteração pedida, sem borrões, distorções, deformações ou perda de consistência visual."
    ),
    "step1_text_change": (
        "Você é um especialista em edição de imagens. Sua tarefa é alterar os textos "
        "conforme solicitado, mantendo EXATAMENTE a mesma fonte, cor, tamanho, estilo e posição.\n\n"
        "Regras:\n"
        "1. Mantenha a consistência visual da imagem original.\n"
        "2. NÃO altere pessoas, degradês, cores de fundo ou elementos gráficos.\n"
        "3. Faça APENAS as alterações de texto descritas abaixo:\n\n"
        "{changes}"
    ),
    # Podemos mover outros prompts aqui no futuro
}

def get_prompt(key: str, **kwargs) -> str:
    """
    Retorna o prompt formatado com as variáveis fornecidas.
    """
    prompt_template = PROMPTS.get(key)
    if not prompt_template:
        raise KeyError(f"Prompt key '{key}' não encontrada no dicionário de prompts.")
    return prompt_template.format(**kwargs)
