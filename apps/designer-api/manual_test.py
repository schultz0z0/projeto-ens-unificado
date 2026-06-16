import json
import os
import shutil
import subprocess
import sys
import traceback
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv

from api.job_service import ENXOVAL_CHANNELS
from execution.select_template import list_templates, select_template
from main import BannerRequest, ContentKeys, NexusImageOrchestrator, RequestMeta

if sys.platform == "win32":
    try:
        sys.stdin.reconfigure(encoding="utf-8")
        sys.stdout.reconfigure(encoding="utf-8")
    except AttributeError:
        pass

load_dotenv()


def print_header() -> None:
    print("===========================================")
    print("   NEXUS DESIGNER - MODO TESTE MANUAL CLI")
    print("===========================================")
    print("Este modo simula o preenchimento do formulário e gera a imagem localmente.")
    print("")


def get_user_input(prompt: str, default: Optional[str] = None) -> str:
    if default:
        user_input = input(f"{prompt} [{default}]: ").strip()
        return user_input if user_input else default
    while True:
        user_input = input(f"{prompt}: ").strip()
        if user_input:
            return user_input
        print("Valor obrigatório.")


def select_option(options: list[str], prompt: str) -> str:
    print(f"\n{prompt}:")
    for i, opt in enumerate(options, 1):
        print(f"  {i}. {opt}")
    while True:
        try:
            choice = int(input(f"Escolha uma opção (1-{len(options)}): "))
            if 1 <= choice <= len(options):
                return options[choice - 1]
        except ValueError:
            pass
        print("Opção inválida.")


def resolve_manual_target_channels(modo_geracao: str, canal: Optional[str]) -> list[str]:
    if (modo_geracao or "").strip().lower() == "enxoval":
        return list(ENXOVAL_CHANNELS)
    canal_value = (canal or "").strip()
    if not canal_value:
        raise ValueError("Modo peca_unica requer canal válido.")
    return [canal_value]


def resolve_common_kvs(templates: dict, channels: list[str]) -> list[str]:
    common_kvs: Optional[set[str]] = None
    for channel in channels:
        channel_kvs = set(templates.get(channel, {}).keys())
        common_kvs = channel_kvs if common_kvs is None else common_kvs & channel_kvs
    return sorted(common_kvs or set())


def load_template_context(canal: str, kv: str) -> dict:
    try:
        template_path = select_template(canal, kv)
        context_path = template_path.parent / "template_context.json"
        if context_path.exists():
            with open(context_path, "r", encoding="utf-8") as file:
                return json.load(file)
    except Exception:
        return {}
    return {}


def context_text(context: dict, key: str, fallback: str) -> str:
    item = context.get(key)
    if isinstance(item, dict):
        value = item.get("texto_atual")
        if isinstance(value, str) and value.strip():
            return value
    return fallback


def context_persona(context: dict, fallback: str) -> str:
    item = context.get("persona")
    if isinstance(item, dict):
        value = item.get("descricao")
        if isinstance(value, str) and value.strip():
            return value
    return fallback


def normalize_persona_path(raw_value: str) -> Optional[str]:
    persona_image_path = raw_value.strip().strip('"').strip("'")
    if not persona_image_path:
        return None
    persona_path = Path(persona_image_path)
    if not persona_path.exists():
        print(f"Aviso: Arquivo '{persona_image_path}' não encontrado. Ignorando imagem.")
        return None
    return str(persona_path.absolute())


def open_file_if_possible(file_path: Path) -> None:
    if os.name == "nt":
        os.startfile(file_path)
    elif os.name == "posix":
        subprocess.run(["xdg-open", str(file_path)])


def main() -> None:
    print_header()
    templates = list_templates()
    if not templates:
        print("Nenhum template encontrado em 'templates_library/'.")
        return

    modo_geracao = select_option(["peca_unica", "enxoval"], "Selecione o Modo de Geração")
    canal: Optional[str] = None

    if modo_geracao == "peca_unica":
        canal = select_option(list(templates.keys()), "Selecione o Canal")
        kv_options = list(templates[canal].keys())
        kv = select_option(kv_options, f"Selecione o KV para '{canal}'")
        canais_alvo = resolve_manual_target_channels(modo_geracao, canal)
        print(f"\nSelecionado: {modo_geracao} | {canal} / {kv}")
    else:
        canais_alvo = resolve_manual_target_channels(modo_geracao, None)
        kv_options = resolve_common_kvs(templates, canais_alvo)
        if not kv_options:
            print("Nenhum KV comum encontrado para todos os canais do enxoval.")
            return
        kv = select_option(kv_options, "Selecione o KV para o enxoval")
        print(f"\nSelecionado: {modo_geracao} | KV {kv}")
        print("Canais do enxoval:")
        for target_channel in canais_alvo:
            print(f" - {target_channel}")

    contexto = load_template_context(canais_alvo[0], kv)
    print("\n--- Preencha os dados do Banner ---")
    etiqueta = get_user_input("Etiqueta (Badge Superior)", context_text(contexto, "etiqueta", "NOVIDADE"))
    titulo = get_user_input("Título Principal", context_text(contexto, "titulo", "Título de Exemplo"))
    frase = get_user_input("Frase de Apoio", context_text(contexto, "frase", "Sua frase impactante aqui."))
    box1 = get_user_input("Box 1 (Destaque)", context_text(contexto, "box1", "Confira"))
    box2 = get_user_input("Box 2 (Opcional)", context_text(contexto, "box2", ""))
    persona_desc = get_user_input("Descrição da Persona", context_persona(contexto, "Uma pessoa feliz usando o produto."))
    persona_image_input = input("Caminho da Imagem da Persona (opcional, Enter para pular): ")
    persona_image_path = normalize_persona_path(persona_image_input)

    print("\n--- Iniciando Geração (Isso pode levar alguns segundos) ---")
    temp_dir = Path("temp/manual_test_outputs")
    temp_dir.mkdir(parents=True, exist_ok=True)
    orchestrator = NexusImageOrchestrator()
    results: list[dict] = []

    for target_channel in canais_alvo:
        try:
            request = BannerRequest(
                request_meta=RequestMeta(canal=target_channel, kv=kv),
                content_keys=ContentKeys(
                    etiqueta=etiqueta,
                    titulo=titulo,
                    frase=frase,
                    box1=box1,
                    box2=box2,
                    persona=persona_desc,
                    persona_image_path=persona_image_path,
                ),
            )
            output_path = orchestrator.process_job(request)
            
            # Loop de validação e ajuste
            while True:
                print(f"\n[Canal: {target_channel}] Peça gerada com sucesso: {output_path}")
                valida = get_user_input("Peça validada? (s = Sim, finalizar / n = Não, preciso de ajuste)", "s").lower()
                if valida == 's':
                    break
                else:
                    ajuste_prompt = get_user_input("Descreva o ajuste necessário", "Corrigir a cor da logo")
                    print("\n--- Iniciando Ajuste (Isso pode levar alguns segundos) ---")
                    output_path = orchestrator.process_adjustment(output_path, ajuste_prompt)

            final_filename = f"teste_{target_channel}_{kv}_{os.getpid()}.png"
            final_path = temp_dir / final_filename
            shutil.copy(output_path, final_path)
            results.append({"canal": target_channel, "status": "done", "path": final_path})
            print(f"✓ {target_channel} gerado em: {final_path.absolute()}")
        except Exception as exc:
            results.append({"canal": target_channel, "status": "failed", "error": str(exc)})
            print(f"✗ Falha em {target_channel}: {exc}")
            traceback.print_exc()

    done_items = [item for item in results if item["status"] == "done"]
    failed_items = [item for item in results if item["status"] == "failed"]

    print("\n--- Resumo da Execução ---")
    print(f"Modo: {modo_geracao}")
    print(f"Concluídos: {len(done_items)}")
    print(f"Falhas: {len(failed_items)}")

    if failed_items:
        print("\nFalhas:")
        for item in failed_items:
            print(f" - {item['canal']}: {item['error']}")

    if done_items:
        print("\nArquivos gerados:")
        for item in done_items:
            print(f" - {item['canal']}: {item['path'].absolute()}")
        if len(done_items) == 1:
            open_file_if_possible(done_items[0]["path"])
    else:
        print("Nenhuma imagem foi gerada com sucesso.")

if __name__ == "__main__":
    main()
