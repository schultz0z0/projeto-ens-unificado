
import os
import io
from dotenv import load_dotenv
from google import genai
from google.genai import types
from PIL import Image

load_dotenv()

api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
if not api_key:
    raise RuntimeError("GEMINI_API_KEY/GOOGLE_API_KEY não encontrado no .env")

client = genai.Client(api_key=api_key)

print("--- Teste de Geração de Imagem Isolado ---")
model_id = "gemini-3-pro-image-preview"


print(f"Tentando gerar imagem com modelo: {model_id}")

try:
    # Testando com Aspect Ratio dinâmico (simulado 1:1) e 4K
    print("Config: 1:1, 4K")
    
    response = client.models.generate_content(
        model=model_id,
        contents=["Create a picture of a nano banana dish in a fancy restaurant with a Gemini theme. High fidelity, sharp focus, professional photography, 4k resolution."],
        config=types.GenerateContentConfig(
            response_modalities=["IMAGE"],
            image_config=types.ImageConfig(
                aspect_ratio="1:1",
                image_size="4K",
            )
        ),
    )
    
    image_bytes = None
    if response.candidates:
        for part in response.candidates[0].content.parts:
            if part.inline_data:
                image_bytes = part.inline_data.data
                break
    
    if image_bytes:
        print("SUCESSO! Imagem gerada.")
        output_path = "debug_output_4k.png"
        with open(output_path, "wb") as f:
            f.write(image_bytes)
        print(f"Salva em {output_path}")
    else:
        # Tentar fallback generated_images
        if hasattr(response, 'generated_images') and response.generated_images:
             response.generated_images[0].image.save("debug_output_4k.png")
             print("SUCESSO! Imagem gerada (via generated_images).")
        else:
             print("Falha: Nenhuma imagem retornada.")

except Exception as e:
    print(f"\nERRO FATAL: {e}")
    # Tentar listar métodos suportados se possível (debug avançado)
