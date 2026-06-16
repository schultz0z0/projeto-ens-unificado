
import os
from dotenv import load_dotenv
from google import genai

load_dotenv()

api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
if not api_key:
    print("ERRO: GEMINI_API_KEY/GOOGLE_API_KEY não encontrado no .env")
    exit(1)

client = genai.Client(api_key=api_key)

print("--- Listando Modelos Disponíveis ---")
try:
    # Listar modelos que suportam generateContent
    print("\n[Modelos de Texto/Multimodal]")
    for m in client.models.list(config={"page_size": 100}):
        # Filtrar para não poluir demais, mas mostrar os relevantes
        if "gemini" in m.name:
            print(f"- {m.name} ({m.display_name})")
            
    # Tentar descobrir modelos de imagem (a listagem padrão pode não separar claramente)
    # Mas vamos ver o que retorna.
except Exception as e:
    print(f"Erro ao listar modelos: {e}")
