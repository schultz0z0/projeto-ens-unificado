
import json
import io
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from PIL import Image
from fastapi.testclient import TestClient
import api.job_service as job_service_module
from main import BannerRequest, NexusImageOrchestrator, generate_banner
from fastapi import HTTPException
from api.app import app, GenerationMode, _resolve_target_channels, _resolve_persona_value, _templates_catalog
from api.job_service import JobStatus, JobItemStatus, _jobs, _run_adjustment_sync, _run_pipeline_sync, create_job, get_enxoval_metrics_summary
from manual_test import resolve_manual_target_channels

# Mock do Google GenAI Client
@pytest.fixture
def mock_genai_client():
    with patch("main.genai.Client") as mock:
        client_instance = mock.return_value
        inline_data = MagicMock()
        inline_data.data = b"fake-image-bytes"
        part = MagicMock()
        part.inline_data = inline_data
        content = MagicMock()
        content.parts = [part]
        candidate = MagicMock()
        candidate.content = content

        mock_response = MagicMock()
        mock_response.candidates = [candidate]
        mock_response.text = "Prompt gerado"
        client_instance.models.generate_content.return_value = mock_response
        yield client_instance

@pytest.fixture
def mock_image_open():
    with patch("main.Image.open") as mock:
        image_mock = MagicMock()
        
        # Side effect para save: cria um arquivo vazio no path especificado
        def save_side_effect(fp, *args, **kwargs):
            # fp pode ser string ou Path
            path = Path(fp)
            path.parent.mkdir(parents=True, exist_ok=True)
            path.touch()
            
        image_mock.save.side_effect = save_side_effect
        mock.return_value = image_mock
        yield mock

def test_orchestrator_flow(mock_genai_client, mock_image_open, tmp_path):
    # Setup
    # Criar estrutura de template fake
    template_dir = tmp_path / "templates_library" / "01_feed_instagram" / "pos"
    template_dir.mkdir(parents=True)
    template_file = template_dir / "base_pos_01feed_padrao.jpg"
    template_file.touch()
    
    # Criar context json
    context_file = template_dir / "template_context.json"
    context_data = {
        "etiqueta": {"texto_atual": "MBA", "descricao_visual": "Texto no topo"},
        "titulo": {"texto_atual": "Titulo Original", "descricao_visual": "Centro"},
    }
    with open(context_file, "w") as f:
        json.dump(context_data, f)
        
    # Payload de teste
    payload = {
        "request_meta": {
            "canal": "01_feed_instagram",
            "kv": "pos"
        },
        "content_keys": {
            "etiqueta": "Novo MBA",
            "titulo": "Novo Titulo",
            "frase": "Nova Frase",
            "box1": "Box 1",
            "box2": "Box 2",
            "persona": "Homem sorrindo"
        }
    }
    
    # Mock do select_template para retornar nosso caminho fake
    with patch("main.select_template", return_value=template_file):
        # Executar
        req = BannerRequest(**payload)
        
        with patch.dict("os.environ", {"GEMINI_API_KEY": "fake-api-key"}):
            orchestrator = NexusImageOrchestrator()
            
            # Mockar _edit_image_step para não tentar salvar de verdade imagens que não existem
            # Mas queremos testar a lógica do loop, então vamos mockar a chamada interna de API
            # O mock_genai_client já deve cuidar da API.
            # O mock_image_open cuida do PIL.
            
            # Vamos rodar
            final_path = orchestrator.process_job(req)
            
            # Asserções
            assert final_path is not None
            assert "outputs" in str(final_path)
            
            # Verificar se chamou a API para os campos que mudaram
            # etiqueta mudou (MBA -> Novo MBA)
            # titulo mudou (Titulo Original -> Novo Titulo)
            # frase não está no context, então deve ser pulada (log "sem contexto")
            
            assert mock_genai_client.models.generate_content.called
            assert mock_genai_client.models.generate_content.call_count >= 2

def test_text_prompt_enforces_box_consistency_rules():
    with patch.dict("os.environ", {"GEMINI_API_KEY": "fake-api-key"}):
        orchestrator = NexusImageOrchestrator()
        request = BannerRequest(
            request_meta={"canal": "01_feed_instagram", "kv": "pos"},
            content_keys={
                "etiqueta": "PÓS-GRADUAÇÃO",
                "titulo": "Gestão Estratégica",
                "frase": "Frase nova",
                "box1": "Início imediato",
                "box2": "Turma confirmada",
                "persona": "homem em escritório"
            }
        )
        context = {
            "etiqueta": {"texto_atual": "MBA"},
            "titulo": {"texto_atual": "Finanças e Seguros"},
            "frase": {"texto_atual": "Texto antigo"},
            "box1": {"texto_atual": "INÍCIO: 07/04"},
            "box2": {"texto_atual": "ON-LINE | AO VIVO"}
        }
        with patch.object(orchestrator, "_refine_box_icon_prompt", return_value="atualize o ícone para um ícone minimalista de calendário"):
            prompt = orchestrator._generate_text_change_prompt(request, context)

        assert "camada 1 — regras gerais" in prompt.lower()
        assert "camada 2 — refinamentos do canal" in prompt.lower()
        assert "camada 3 — contexto do template (kv)" in prompt.lower()
        assert "cada box deve conter exatamente 1 ícone" in prompt.lower()
        assert "à esquerda do texto" in prompt.lower()
        assert "proibido criar ícone solto" in prompt.lower()
        assert "ícone externo à box" in prompt.lower()
        assert "se o ícone não couber dentro da box" in prompt.lower()
        assert "redimensionar a box" in prompt.lower()
        assert "duas boxes" in prompt.lower()
        assert "nunca remover" in prompt.lower()
        assert "largura independente" in prompt.lower()
        assert "nunca igualar larguras automaticamente" in prompt.lower()
        assert "posição global do bloco de boxes" in prompt.lower()
        assert "prioridade máxima é preservar ambas as boxes e sua legibilidade" in prompt.lower()
        assert "largura final de cada box deve ser a menor possível" in prompt.lower()
        assert "proibido esticar a box inteira" in prompt.lower()
        assert "altura fixa" in prompt.lower()
        assert "largura fixa" not in prompt.lower()
        assert "direção de arte textual" in prompt.lower()
        assert "título pode quebrar em até 2 linhas" in prompt.lower()
        assert "ajuste leve de escala" in prompt.lower()
        assert "frase pode ocupar 1 ou 2 linhas" in prompt.lower()


def test_text_prompt_enforces_global_white_color_lock_rules():
    orchestrator = NexusImageOrchestrator()
    request = BannerRequest(
        request_meta={"canal": "01_feed_instagram", "kv": "pos"},
        content_keys={
            "etiqueta": "EXTENSÃO",
            "titulo": "Gestão de Seguros",
            "frase": "Frase de apoio",
            "box1": "TURMA CONFIRMADA",
            "box2": "INÍCIO: 28/04",
            "persona": "executivo em escritório",
        },
    )
    context = {
        "etiqueta": {"texto_atual": "FACULDADE ENS"},
        "titulo": {"texto_atual": "Gestão antiga"},
        "frase": {"texto_atual": "Frase antiga"},
        "box1": {"texto_atual": "Box antiga 1"},
        "box2": {"texto_atual": "Box antiga 2"},
        "meta": {"template_id": "01_feed_instagram/pos"},
    }

    with patch.object(orchestrator, "_refine_box_icon_prompt", return_value="atualize o ícone para calendário"):
        prompt = orchestrator._generate_text_change_prompt(request, context)

    assert "etiqueta: fundo branco puro" in prompt.lower()
    assert "box1: fundo branco puro" in prompt.lower()
    assert "box2: texto branco puro" in prompt.lower()
    assert "título e frase: sempre branco puro" in prompt.lower()
    assert "off-white" in prompt.lower()
    assert "marfim" in prompt.lower()
    assert "não aplicar filtro quente" in prompt.lower()
    assert "texto e ícone seguem a cor principal do kv" in prompt.lower()

def test_channel_refinement_uses_adaptive_box_orientation_for_banner_interno_desktop():
    with patch.dict("os.environ", {"GEMINI_API_KEY": "fake-api-key"}):
        orchestrator = NexusImageOrchestrator()
        refinements = orchestrator._build_channel_layer("03_banner_interno_desktop")
        merged = "\n".join(refinements).lower()
        assert "disposição das boxes deve ser adaptativa" in merged
        assert "largura útil da frase" in merged
        assert "se box1 + box2 + gap ultrapassar essa largura, empilhe verticalmente" in merged
        assert "nunca empilhar as boxes verticalmente neste canal" not in merged

def test_human_persona_detection_handles_positive_and_negative_signals():
    with patch.dict("os.environ", {"GEMINI_API_KEY": "fake-api-key"}):
        orchestrator = NexusImageOrchestrator()
        assert orchestrator._is_human_persona_request("homem e mulher negociando em reunião") is True
        assert orchestrator._is_human_persona_request("sala vazia, sem pessoas") is False
        assert orchestrator._extract_requested_human_count("2 pessoas em uma negociação") == 2
        assert orchestrator._extract_requested_human_count("homem e mulher negociando") == 2

def test_persona_prompt_enforces_photorealism():
    with patch.dict("os.environ", {"GEMINI_API_KEY": "fake-api-key"}):
        orchestrator = NexusImageOrchestrator()
        request = BannerRequest(
            request_meta={"canal": "01_feed_instagram", "kv": "pos"},
            content_keys={
                "etiqueta": "PÓS-GRADUAÇÃO",
                "titulo": "Título",
                "frase": "Frase",
                "box1": "Box 1",
                "box2": "Box 2",
                "persona": "homem em escritório"
            }
        )
        context = {"meta": {"kv_guidelines": ["Preservar KV"]}}
        with patch.object(orchestrator, "_refine_persona_prompt", return_value="homem em escritório"):
            prompt = orchestrator._generate_persona_change_prompt(request, context)

        assert "fotorrealista" in prompt.lower()
        assert "evitar aparência de pele plástica" in prompt.lower()
        assert "prompt negativo obrigatório" in prompt.lower()
        assert "waxy skin" in prompt.lower()
        assert "não herdar acessórios ou objetos do template base" in prompt.lower()
        assert "tablet" in prompt.lower()


def test_persona_prompt_enforces_global_white_color_lock_rules():
    orchestrator = NexusImageOrchestrator()
    request = BannerRequest(
        request_meta={"canal": "05_whatsapp", "kv": "pos"},
        content_keys={
            "etiqueta": "FACULDADE ENS",
            "titulo": "Gestão de Seguros",
            "frase": "Frase de apoio",
            "box1": "20% DE DESCONTO",
            "box2": "ON-LINE | AO VIVO",
            "persona": "mulher advogada em escritório",
        },
    )
    context = {
        "etiqueta": {"texto_atual": "FACULDADE ENS"},
        "titulo": {"texto_atual": "Gestão de Seguros"},
        "frase": {"texto_atual": "Frase de apoio"},
        "box1": {"texto_atual": "20% DE DESCONTO"},
        "box2": {"texto_atual": "ON-LINE | AO VIVO"},
        "meta": {"template_id": "05_whatsapp/pos"},
    }

    with patch.object(orchestrator, "_refine_persona_prompt", return_value="mulher advogada em escritório"):
        prompt = orchestrator._generate_persona_change_prompt(request, context)

    assert "etiqueta: fundo branco puro" in prompt.lower()
    assert "box1: fundo branco puro" in prompt.lower()
    assert "box2: texto branco puro" in prompt.lower()
    assert "título e frase: sempre branco puro" in prompt.lower()

def test_persona_prompt_blocks_inherited_tablet_when_not_requested():
    with patch.dict("os.environ", {"GEMINI_API_KEY": "fake-api-key"}):
        orchestrator = NexusImageOrchestrator()
        request = BannerRequest(
            request_meta={"canal": "03_banner_interno_desktop", "kv": "pos"},
            content_keys={
                "etiqueta": "EXTENSÃO",
                "titulo": "Gestão de Resseguro",
                "frase": "Frase",
                "box1": "VISÃO ESTRATÉGICA",
                "box2": "INÍCIO: 23/04",
                "persona": "executivo maduro em escritório premium"
            }
        )
        context = {"meta": {"kv_guidelines": ["Preservar KV"]}}
        with patch.object(orchestrator, "_refine_persona_prompt", return_value="executivo maduro em escritório premium"):
            prompt = orchestrator._generate_persona_change_prompt(request, context)

        assert "não herdar acessórios ou objetos do template base" in prompt.lower()
        assert "se o pedido não citar tablet" in prompt.lower()
        assert "não inserir tablet" in prompt.lower()
        assert "não inserir notebook" in prompt.lower()

def test_persona_prompt_enforces_requested_human_count():
    with patch.dict("os.environ", {"GEMINI_API_KEY": "fake-api-key"}):
        orchestrator = NexusImageOrchestrator()
        request = BannerRequest(
            request_meta={"canal": "08_topo_email", "kv": "institucional"},
            content_keys={
                "etiqueta": "FACULDADE ENS",
                "titulo": "Gestão de Seguros",
                "frase": "Frase",
                "box1": "Box 1",
                "box2": "Box 2",
                "persona": "homem e mulher negociando em escritório"
            }
        )
        context = {"meta": {"kv_guidelines": ["Preservar KV"]}}
        with patch.object(orchestrator, "_refine_persona_prompt", return_value="homem e mulher negociando em escritório"):
            prompt = orchestrator._generate_persona_change_prompt(request, context)

        assert "obrigatório renderizar 2 pessoa(s)" in prompt.lower()
        assert "sem substituir por ambiente vazio" in prompt.lower()

def test_persona_prompt_locks_kv_texts_and_layout():
    with patch.dict("os.environ", {"GEMINI_API_KEY": "fake-api-key"}):
        orchestrator = NexusImageOrchestrator()
        request = BannerRequest(
            request_meta={"canal": "05_whatsapp", "kv": "pos"},
            content_keys={
                "etiqueta": "EXTENSÃO",
                "titulo": "Gestão de Resseguro",
                "frase": "Onde o resseguro deixa de ser conceito e vira decisão.",
                "box1": "INÍCIO: 23/04",
                "box2": "ON-LINE | AO VIVO",
                "persona": "homem executivo em escritório moderno"
            }
        )
        context = {
            "etiqueta": {"texto_atual": "EXTENSÃO"},
            "titulo": {"texto_atual": "Gestão de Resseguro"},
            "frase": {"texto_atual": "Onde o resseguro deixa de ser conceito e vira decisão."},
            "box1": {"texto_atual": "INÍCIO: 23/04"},
            "box2": {"texto_atual": "ON-LINE | AO VIVO"},
            "meta": {"kv_guidelines": ["Preservar KV"]},
        }
        with patch.object(orchestrator, "_refine_persona_prompt", return_value="homem executivo em escritório moderno"):
            prompt = orchestrator._generate_persona_change_prompt(request, context)

        assert "NÃO REGERAR o banner completo" in prompt
        assert "modo de edição localizada" in prompt
        assert "bloco de textos e boxes deve permanecer pixel-equivalente" in prompt
        assert "manter exatamente estes textos sem qualquer alteração" in prompt.lower()
        assert 'etiqueta: "EXTENSÃO"' in prompt
        assert 'box2: "ON-LINE | AO VIVO"' in prompt

def test_persona_prompt_prioritizes_request_texts_over_old_context():
    with patch.dict("os.environ", {"GEMINI_API_KEY": "fake-api-key"}):
        orchestrator = NexusImageOrchestrator()
        request = BannerRequest(
            request_meta={"canal": "05_whatsapp", "kv": "graduacao"},
            content_keys={
                "etiqueta": "NOVA ETIQUETA",
                "titulo": "Novo Título",
                "frase": "Nova frase",
                "box1": "Novo box 1",
                "box2": "Novo box 2",
                "persona": "homem estudando no notebook"
            }
        )
        context = {
            "etiqueta": {"texto_atual": "ETIQUETA ANTIGA"},
            "titulo": {"texto_atual": "Título antigo"},
            "frase": {"texto_atual": "Frase antiga"},
            "box1": {"texto_atual": "Box antiga 1"},
            "box2": {"texto_atual": "Box antiga 2"},
            "meta": {"kv_guidelines": ["Preservar KV"]},
        }
        with patch.object(orchestrator, "_refine_persona_prompt", return_value="homem estudando no notebook"):
            prompt = orchestrator._generate_persona_change_prompt(request, context)

        assert 'etiqueta: "NOVA ETIQUETA"' in prompt
        assert 'titulo: "Novo Título"' in prompt
        assert 'frase: "Nova frase"' in prompt
        assert 'box1: "Novo box 1"' in prompt
        assert 'box2: "Novo box 2"' in prompt
        assert 'etiqueta: "ETIQUETA ANTIGA"' not in prompt

def test_persona_prompt_blocks_gradient_transparency():
    with patch.dict("os.environ", {"GEMINI_API_KEY": "fake-api-key"}):
        orchestrator = NexusImageOrchestrator()
        request = BannerRequest(
            request_meta={"canal": "01_feed_instagram", "kv": "graduacao"},
            content_keys={
                "etiqueta": "FACULDADE ENS",
                "titulo": "Gestão Financeira",
                "frase": "Frase",
                "box1": "30% DE DESCONTO",
                "box2": "ÚLTIMOS DIAS!",
                "persona": "homem em biblioteca"
            }
        )
        context = {"meta": {"kv_guidelines": ["Preservar KV"]}}
        with patch.object(orchestrator, "_refine_persona_prompt", return_value="homem em biblioteca"):
            prompt = orchestrator._generate_persona_change_prompt(request, context)

        assert "nunca reduzir a opacidade do degradê" in prompt.lower()
        assert "proibido gerar fundo transparente" in prompt.lower()
        assert "última camada de fundo" in prompt.lower()
        assert "é proibido colocar a nova persona acima de texto" in prompt.lower()

def test_refine_persona_prompt_uses_layout_image_context(tmp_path):
    with patch.dict("os.environ", {"GEMINI_API_KEY": "fake-api-key"}):
        response = MagicMock()
        response.text = "homem em plano médio em galpão logístico"

        orchestrator = NexusImageOrchestrator()
        layout_path = tmp_path / "step1_texts.png"
        Image.new("RGB", (1080, 1080), color=(30, 40, 50)).save(layout_path)

        with patch.object(orchestrator, "_call_genai_with_retry", return_value=response) as genai_call:
            refined = orchestrator._refine_persona_prompt("homem em galpão logístico", layout_path)

        assert refined == "homem em plano médio em galpão logístico"
        assert genai_call.call_args.kwargs["model"] == "gemini-3-flash-preview"
        contents = genai_call.call_args.kwargs["contents"]
        assert any(isinstance(item, Image.Image) for item in contents)

def test_refine_background_prompt_uses_layout_image_context(tmp_path):
    with patch.dict("os.environ", {"GEMINI_API_KEY": "fake-api-key"}):
        response = MagicMock()
        response.text = "estoque industrial amplo com profundidade de campo"

        orchestrator = NexusImageOrchestrator()
        layout_path = tmp_path / "step1_texts.png"
        Image.new("RGB", (1200, 628), color=(70, 60, 50)).save(layout_path)

        with patch.object(orchestrator, "_call_genai_with_retry", return_value=response) as genai_call:
            refined = orchestrator._refine_background_prompt("estoque industrial", layout_path)

        assert refined == "estoque industrial amplo com profundidade de campo"
        assert genai_call.call_args.kwargs["model"] == "gemini-3-flash-preview"
        contents = genai_call.call_args.kwargs["contents"]
        assert any(isinstance(item, Image.Image) for item in contents)

def test_generate_persona_change_prompt_forwards_layout_path_to_refiner(tmp_path):
    with patch.dict("os.environ", {"GEMINI_API_KEY": "fake-api-key"}):
        orchestrator = NexusImageOrchestrator()
        request = BannerRequest(
            request_meta={"canal": "01_feed_instagram", "kv": "pos"},
            content_keys={
                "etiqueta": "PÓS-GRADUAÇÃO",
                "titulo": "Título",
                "frase": "Frase",
                "box1": "Box 1",
                "box2": "Box 2",
                "persona": "homem em escritório"
            }
        )
        context = {"meta": {"kv_guidelines": ["Preservar KV"]}}
        layout_path = tmp_path / "step1_texts.png"
        Image.new("RGB", (1080, 1080), color=(20, 20, 20)).save(layout_path)

        with patch.object(orchestrator, "_refine_persona_prompt", return_value="homem em escritório") as refiner:
            orchestrator._generate_persona_change_prompt(request, context, layout_path)

        assert refiner.call_count == 1
        assert refiner.call_args.args[1] == layout_path

def test_run_planner_step_falls_back_to_legacy_prompt_on_error():
    with patch.dict("os.environ", {"GEMINI_API_KEY": "fake-api-key"}):
        orchestrator = NexusImageOrchestrator()
        meta = BannerRequest(
            request_meta={"canal": "05_AIDA_whatsapp", "kv": "pos"},
            content_keys={"etiqueta": "A", "titulo": "B", "frase": "C", "box1": "D", "box2": "E", "persona": "F"}
        ).request_meta
        with patch.object(orchestrator, "_call_genai_with_retry", side_effect=RuntimeError("falha")):
            result = orchestrator._run_planner_step(
                step_name="step1_text",
                user_request="pedido",
                context={},
                meta=meta,
                reference_images=[],
                fallback_prompt="prompt legado"
            )
        assert result["status"] == "OK"
        assert result["edit_prompt_final"] == "prompt legado"

def test_run_planner_step_falls_back_when_planner_blocks_response():
    with patch.dict("os.environ", {"GEMINI_API_KEY": "fake-api-key"}):
        orchestrator = NexusImageOrchestrator()
        response = MagicMock()
        response.text = json.dumps({
            "status": "BLOCK",
            "edit_prompt_final": "INVALID_REQUEST",
            "notes": "bloqueado"
        })
        meta = BannerRequest(
            request_meta={"canal": "05_AIDA_whatsapp", "kv": "pos"},
            content_keys={"etiqueta": "A", "titulo": "B", "frase": "C", "box1": "D", "box2": "E", "persona": "F"}
        ).request_meta
        with patch.object(orchestrator, "_call_genai_with_retry", return_value=response):
            result = orchestrator._run_planner_step(
                step_name="step2_persona",
                user_request="pedido",
                context={},
                meta=meta,
                reference_images=[],
                fallback_prompt="prompt legado persona"
            )
        assert result["status"] == "OK"
        assert result["edit_prompt_final"] == "prompt legado persona"

def test_refine_persona_prompt_falls_back_when_model_returns_refusal(tmp_path):
    with patch.dict("os.environ", {"GEMINI_API_KEY": "fake-api-key"}):
        response = MagicMock()
        response.text = "I'm sorry, I can't assist with that."
        orchestrator = NexusImageOrchestrator()
        layout_path = tmp_path / "step1_texts.png"
        Image.new("RGB", (1080, 1080), color=(10, 10, 10)).save(layout_path)
        with patch.object(orchestrator, "_call_genai_with_retry", return_value=response):
            refined = orchestrator._refine_persona_prompt("executivo em escritório", layout_path)
        assert refined == "executivo em escritório"

def test_model_defaults_centralize_on_gemini_flash_and_pro():
    with patch.dict("os.environ", {"GEMINI_API_KEY": "fake-api-key"}, clear=True):
        orchestrator = NexusImageOrchestrator()
        assert orchestrator.refiner_model == "gemini-3-flash-preview"
        assert orchestrator.orchestrator_model == "gemini-3-flash-preview"
        assert orchestrator.planner_model == "gemini-3-flash-preview"
        assert orchestrator.validator_model == "gemini-3.1-pro-preview"
        assert orchestrator.image_model == "gemini-3-pro-image-preview"

def test_planner_has_dedicated_system_prompt_per_step():
    with patch.dict("os.environ", {"GEMINI_API_KEY": "fake-api-key"}):
        orchestrator = NexusImageOrchestrator()
        step1 = orchestrator._build_step_planner_system_prompt("step1_text")
        step2 = orchestrator._build_step_planner_system_prompt("step2_persona")
        step3 = orchestrator._build_step_planner_system_prompt("step3_validation")
        assert "alteração APENAS de textos e boxes" in step1
        assert "alteração APENAS de persona/fundo" in step2
        assert "converter diagnóstico do validador" in step3

def test_run_planner_step_applies_template_payload_overrides(tmp_path):
    with patch.dict("os.environ", {"GEMINI_API_KEY": "fake-api-key"}):
        orchestrator = NexusImageOrchestrator()
        template_dir = tmp_path / "templates" / "05_AIDA_whatsapp" / "pos"
        template_dir.mkdir(parents=True, exist_ok=True)
        template_path = template_dir / "Template (final).png"
        Image.new("RGB", (1080, 1080), color=(0, 0, 0)).save(template_path)
        payload_dir = template_dir / "planner_payloads"
        payload_dir.mkdir(parents=True, exist_ok=True)
        payload_data = {
            "context_json_compacto": {"template_id": "05_AIDA_whatsapp/pos", "hard_locks": {"logos": ["ENS"]}},
            "planner_overrides": {"extra_system_rules": ["Regra teste payload"]},
            "hard_constraints": ["Nao alterar logo ENS"]
        }
        (payload_dir / "step1_planner_payload.json").write_text(json.dumps(payload_data, ensure_ascii=False), encoding="utf-8")
        response = MagicMock()
        response.text = json.dumps({"status": "OK", "edit_prompt_final": "prompt final"})
        meta = BannerRequest(
            request_meta={"canal": "05_AIDA_whatsapp", "kv": "pos"},
            content_keys={"etiqueta": "A", "titulo": "B", "frase": "C", "box1": "D", "box2": "E", "persona": "F"}
        ).request_meta
        with patch.object(orchestrator, "_call_genai_with_retry", return_value=response) as call_planner:
            result = orchestrator._run_planner_step(
                step_name="step1_text",
                user_request="pedido",
                context={},
                meta=meta,
                reference_images=[],
                fallback_prompt="fallback",
                template_path=template_path
            )
        assert result["edit_prompt_final"] == "prompt final"
        contents = call_planner.call_args.kwargs["contents"]
        assert "Regra teste payload" in contents[0]
        planner_input = json.loads(contents[1])
        assert "Nao alterar logo ENS" in planner_input["hard_constraints"]


def test_run_planner_step_step2_injects_persona_anchor_constraints():
    with patch.dict("os.environ", {"GEMINI_API_KEY": "fake-api-key"}):
        orchestrator = NexusImageOrchestrator()
        response = MagicMock()
        response.text = json.dumps({"status": "OK", "edit_prompt_final": "prompt step2"})
        meta = BannerRequest(
            request_meta={"canal": "01_feed_instagram", "kv": "pos"},
            content_keys={"etiqueta": "A", "titulo": "B", "frase": "C", "box1": "D", "box2": "E", "persona": "F"}
        ).request_meta

        with patch.object(orchestrator, "_call_genai_with_retry", return_value=response) as call_planner:
            result = orchestrator._run_planner_step(
                step_name="step2_persona",
                user_request="trocar persona",
                context={},
                meta=meta,
                reference_images=[],
                fallback_prompt="fallback persona",
                template_path=None
            )

        assert result["edit_prompt_final"] == "prompt step2"
        planner_input = json.loads(call_planner.call_args.kwargs["contents"][1])
        constraints = " ".join(planner_input["hard_constraints"]).lower()
        assert "manter a posição da persona" in constraints
        assert "não aplicar corte seco" in constraints
        assert "sem transparência, alpha, fade" in constraints


def test_run_planner_step_step2_injects_vertical_framing_guard():
    with patch.dict("os.environ", {"GEMINI_API_KEY": "fake-api-key"}):
        orchestrator = NexusImageOrchestrator()
        response = MagicMock()
        response.text = json.dumps({"status": "OK", "edit_prompt_final": "prompt step2 story"})
        meta = BannerRequest(
            request_meta={"canal": "02_story_instagram", "kv": "pos"},
            content_keys={"etiqueta": "A", "titulo": "B", "frase": "C", "box1": "D", "box2": "E", "persona": "F"}
        ).request_meta

        with patch.object(orchestrator, "_call_genai_with_retry", return_value=response) as call_planner:
            orchestrator._run_planner_step(
                step_name="step2_persona",
                user_request="trocar persona",
                context={},
                meta=meta,
                reference_images=[],
                fallback_prompt="fallback persona",
                template_path=None
            )

        planner_input = json.loads(call_planner.call_args.kwargs["contents"][1])
        constraints = " ".join(planner_input["hard_constraints"]).lower()
        assert "template vertical" in constraints
        assert "preservar cabeça, ombros e tronco" in constraints


def test_run_planner_step_step2_injects_vertical_framing_guard_for_whatsapp_channels():
    with patch.dict("os.environ", {"GEMINI_API_KEY": "fake-api-key"}):
        orchestrator = NexusImageOrchestrator()
        response = MagicMock()
        response.text = json.dumps({"status": "OK", "edit_prompt_final": "prompt step2 whatsapp"})
        channels = ["05_whatsapp", "05_AIDA_whatsapp"]
        for channel in channels:
            meta = BannerRequest(
                request_meta={"canal": channel, "kv": "pos"},
                content_keys={"etiqueta": "A", "titulo": "B", "frase": "C", "box1": "D", "box2": "E", "persona": "F"}
            ).request_meta

            with patch.object(orchestrator, "_call_genai_with_retry", return_value=response) as call_planner:
                orchestrator._run_planner_step(
                    step_name="step2_persona",
                    user_request="trocar persona",
                    context={},
                    meta=meta,
                    reference_images=[],
                    fallback_prompt="fallback persona",
                    template_path=None
                )

            planner_input = json.loads(call_planner.call_args.kwargs["contents"][1])
            constraints = " ".join(planner_input["hard_constraints"]).lower()
            assert "template vertical" in constraints
            assert "preservar cabeça, ombros e tronco" in constraints

def test_process_job_uses_step1_planner_when_enabled():
    with patch.dict("os.environ", {"GEMINI_API_KEY": "fake-api-key", "ENABLE_STEP1_PLANNER": "1"}):
        orchestrator = NexusImageOrchestrator()
        request = BannerRequest(
            request_meta={"canal": "01_feed_instagram", "kv": "pos"},
            content_keys={"etiqueta": "NOVA", "titulo": "TÍTULO", "frase": "FRASE", "box1": "B1", "box2": "B2", "persona": "mesma"}
        )
        context = {
            "etiqueta": {"texto_atual": "ANTIGA"},
            "titulo": {"texto_atual": "T ANTIGO"},
            "frase": {"texto_atual": "F ANTIGA"},
            "box1": {"texto_atual": "B1A"},
            "box2": {"texto_atual": "B2A"},
            "persona": {"descricao": "mesma"}
        }
        template_path = Path("fake/template/base.png")
        with (
            patch.object(orchestrator, "load_template_context", return_value=context),
            patch("main.select_template", return_value=template_path),
            patch.object(orchestrator, "_read_dimensions_from_file", return_value=(1080, 1080)),
            patch.object(orchestrator, "_postprocess_final_resolution", side_effect=lambda p, s, o: (o.parent.mkdir(parents=True, exist_ok=True), o.touch(), o)[2]),
            patch.object(orchestrator, "_generate_text_change_prompt", return_value='- mude a etiqueta de "ANTIGA" para "NOVA"'),
            patch.object(orchestrator, "_run_planner_step", return_value={"status": "OK", "edit_prompt_final": "prompt planner"}) as run_planner,
            patch.object(orchestrator, "_edit_image_step_with_reference", side_effect=lambda *args, **kwargs: (args[2].parent.mkdir(parents=True, exist_ok=True), args[2].touch(), args[2])[2]),
            patch.object(orchestrator, "_persist_editable_output"),
        ):
            orchestrator.process_job(request)
        assert run_planner.call_count >= 1
        assert run_planner.call_args_list[0].kwargs["step_name"] == "step1_text"

def test_process_job_runs_step1_when_planner_prompt_has_no_internal_marker():
    with patch.dict("os.environ", {"GEMINI_API_KEY": "fake-api-key", "ENABLE_STEP1_PLANNER": "1"}):
        orchestrator = NexusImageOrchestrator()
        request = BannerRequest(
            request_meta={"canal": "01_feed_instagram", "kv": "pos"},
            content_keys={"etiqueta": "NOVA", "titulo": "TÍTULO", "frase": "FRASE", "box1": "B1", "box2": "B2", "persona": "mesma"}
        )
        context = {
            "etiqueta": {"texto_atual": "ANTIGA"},
            "titulo": {"texto_atual": "T ANTIGO"},
            "frase": {"texto_atual": "F ANTIGA"},
            "box1": {"texto_atual": "B1A"},
            "box2": {"texto_atual": "B2A"},
            "persona": {"descricao": "mesma"}
        }
        template_path = Path("fake/template/base.png")
        with (
            patch.object(orchestrator, "load_template_context", return_value=context),
            patch("main.select_template", return_value=template_path),
            patch.object(orchestrator, "_read_dimensions_from_file", return_value=(1080, 1080)),
            patch.object(orchestrator, "_postprocess_final_resolution", side_effect=lambda p, s, o: (o.parent.mkdir(parents=True, exist_ok=True), o.touch(), o)[2]),
            patch.object(orchestrator, "_generate_text_change_prompt", return_value='- mude a etiqueta de "ANTIGA" para "NOVA"'),
            patch.object(orchestrator, "_run_planner_step", return_value={"status": "OK", "edit_prompt_final": "Mudar a etiqueta para NOVA"}) as run_planner,
            patch.object(orchestrator, "_edit_image_step_with_reference", side_effect=lambda *args, **kwargs: (args[2].parent.mkdir(parents=True, exist_ok=True), args[2].touch(), args[2])[2]) as reference_edit,
            patch.object(orchestrator, "_persist_editable_output"),
        ):
            orchestrator.process_job(request)
        assert run_planner.call_count >= 1
        assert reference_edit.call_count >= 1
        assert reference_edit.call_args_list[0].args[2].name == "step1_texts.png"


def test_process_job_never_passes_template_base_as_reference_outside_step1():
    with patch.dict(
        "os.environ",
        {
            "GEMINI_API_KEY": "fake-api-key",
            "ENABLE_STEP1_PLANNER": "1",
            "ENABLE_STEP2_PLANNER": "1",
            "ENABLE_STEP3_PLANNER": "1",
        },
    ):
        orchestrator = NexusImageOrchestrator()
        request = BannerRequest(
            request_meta={"canal": "08_topo_email", "kv": "graduacao"},
            content_keys={
                "etiqueta": "NOVA",
                "titulo": "TÍTULO NOVO",
                "frase": "FRASE NOVA",
                "box1": "BOX1 NOVA",
                "box2": "BOX2 NOVA",
                "persona": "pessoa em ambiente corporativo",
            },
        )
        context = {
            "etiqueta": {"texto_atual": "ANTIGA"},
            "titulo": {"texto_atual": "T ANTIGO"},
            "frase": {"texto_atual": "F ANTIGA"},
            "box1": {"texto_atual": "B1A"},
            "box2": {"texto_atual": "B2A"},
            "persona": {"descricao": "persona antiga"},
        }
        template_path = Path("fake/template/base.png")
        validations_step3 = [
            MagicMock(status="CORREÇÃO", prompt_correcao="Ajuste 1", motivo="teste"),
            MagicMock(status="APROVADO", prompt_correcao="", motivo="ok"),
        ]

        with (
            patch.object(orchestrator, "load_template_context", return_value=context),
            patch("main.select_template", return_value=template_path),
            patch.object(orchestrator, "_read_dimensions_from_file", return_value=(1200, 628)),
            patch.object(orchestrator, "_postprocess_final_resolution", side_effect=lambda p, s, o: p),
            patch.object(orchestrator, "_generate_text_change_prompt", return_value='- mude a etiqueta de "ANTIGA" para "NOVA"'),
            patch.object(orchestrator, "_generate_persona_change_prompt", return_value="alterar persona"),
            patch.object(
                orchestrator,
                "_run_planner_step",
                side_effect=[
                    {"status": "OK", "edit_prompt_final": "step1 ok"},
                    {"status": "OK", "edit_prompt_final": "step2 ok"},
                    {"status": "OK", "edit_prompt_final": "step3 ok"},
                ],
            ) as run_planner,
            patch.object(orchestrator, "_validate_step3_output", side_effect=validations_step3),
            patch.object(orchestrator, "_edit_image_step", side_effect=lambda p, prm, out: (out.parent.mkdir(parents=True, exist_ok=True), out.touch(), out)[2]),
            patch.object(orchestrator, "_edit_image_step_with_reference", side_effect=lambda *args, **kwargs: (args[2].parent.mkdir(parents=True, exist_ok=True), args[2].touch(), args[2])[2]),
        ):
            orchestrator.process_job(request)

        non_step1_calls = [c for c in run_planner.call_args_list if c.kwargs.get("step_name") in {"step2_persona", "step3_validation"}]
        assert non_step1_calls, "Esperava chamadas de planner nos steps 2/3."
        for call in non_step1_calls:
            refs = call.kwargs.get("reference_images") or []
            assert template_path not in refs


def test_validate_step3_output_keeps_validator_as_decision_source(tmp_path):
    with patch.dict("os.environ", {"GEMINI_API_KEY": "fake-api-key", "ENABLE_STEP3_PLANNER": "1"}):
        orchestrator = NexusImageOrchestrator()
        base = tmp_path / "base.png"
        generated = tmp_path / "generated.png"
        Image.new("RGB", (1080, 1080), color=(0, 0, 0)).save(base)
        Image.new("RGB", (1080, 1080), color=(10, 10, 10)).save(generated)
        meta = BannerRequest(
            request_meta={"canal": "05_AIDA_whatsapp", "kv": "pos"},
            content_keys={"etiqueta": "A", "titulo": "B", "frase": "C", "box1": "D", "box2": "E", "persona": "F"}
        ).request_meta
        with patch.object(
            orchestrator,
            "_run_step3_validation",
            return_value=MagicMock(status="CORREÇÃO", prompt_correcao="ajuste curto", motivo="corrigir")
        ) as run_validation:
            result = orchestrator._validate_step3_output(base, generated, {}, meta)
        assert run_validation.call_count == 1
        assert result.status == "CORREÇÃO"
        assert result.prompt_correcao == "ajuste curto"

def test_run_step3_correction_cycle_uses_step3_planner_after_validator(tmp_path):
    with patch.dict("os.environ", {"GEMINI_API_KEY": "fake-api-key", "ENABLE_STEP3_PLANNER": "1"}):
        orchestrator = NexusImageOrchestrator()
        base_path = tmp_path / "step2.png"
        Image.new("RGB", (1080, 1080), color=(20, 40, 60)).save(base_path)
        temp_dir = tmp_path / "temp"
        temp_dir.mkdir(parents=True, exist_ok=True)
        meta = BannerRequest(
            request_meta={"canal": "05_whatsapp", "kv": "pos"},
            content_keys={"etiqueta": "A", "titulo": "B", "frase": "C", "box1": "D", "box2": "E", "persona": "F"}
        ).request_meta
        with (
            patch.object(
                orchestrator,
                "_validate_step3_output",
                side_effect=[
                    MagicMock(status="CORREÇÃO", prompt_correcao="Ajustar degradê", motivo="teste"),
                    MagicMock(status="APROVADO", prompt_correcao="", motivo="ok"),
                ],
            ),
            patch.object(orchestrator, "_run_planner_step", return_value={"status": "OK", "edit_prompt_final": "prompt planner step3"}) as run_planner,
            patch.object(orchestrator, "_edit_image_step", side_effect=lambda p, prm, out: (Image.new("RGB", (1080, 1080), color=(100, 110, 120)).save(out), out)[1]) as edit_step,
            patch.object(orchestrator, "_is_global_overcorrection", return_value=False),
            patch.object(orchestrator, "_is_persona_region_degraded", return_value=False),
        ):
            result = orchestrator._run_step3_correction_cycle(
                current_image_path=base_path,
                temp_dir=temp_dir,
                kv_structure_reference_path=base_path,
                context={},
                meta=meta,
            )
        assert result.name == "step3_validation_unified.png"
        assert run_planner.call_count == 1
        assert run_planner.call_args.kwargs["step_name"] == "step3_validation"
        assert edit_step.call_count == 1

def test_edit_with_reference_uses_single_image_executor_mode(tmp_path):
    with patch.dict("os.environ", {"GEMINI_API_KEY": "fake-api-key", "EXECUTOR_SINGLE_IMAGE_MODE": "1"}):
        orchestrator = NexusImageOrchestrator()
        base = tmp_path / "base.png"
        ref = tmp_path / "ref.png"
        out = tmp_path / "out.png"
        Image.new("RGB", (800, 800), color=(10, 20, 30)).save(base)
        Image.new("RGB", (800, 800), color=(40, 50, 60)).save(ref)
        with patch.object(orchestrator, "_edit_image_step", side_effect=lambda p, prm, o: (Image.new("RGB", (800, 800), color=(90, 90, 90)).save(o), o)[1]) as edit_step:
            result = orchestrator._edit_image_step_with_reference(base, "prompt", out, ref, "hint")
        assert result == out
        assert edit_step.call_count == 1


def test_edit_with_reference_can_force_reference_even_in_single_image_mode(tmp_path):
    with patch.dict("os.environ", {"GEMINI_API_KEY": "fake-api-key", "EXECUTOR_SINGLE_IMAGE_MODE": "1"}):
        orchestrator = NexusImageOrchestrator()
        base = tmp_path / "base.png"
        ref = tmp_path / "ref.png"
        out = tmp_path / "out.png"
        Image.new("RGB", (800, 800), color=(10, 20, 30)).save(base)
        Image.new("RGB", (800, 800), color=(40, 50, 60)).save(ref)

        def _fake_call(image, prompt, mask=None, reference_images=None):
            assert reference_images is not None
            assert len(reference_images) == 1
            return Image.new("RGB", image.size, color=(77, 88, 99))

        with (
            patch.object(orchestrator, "_edit_image_step") as edit_step,
            patch.object(orchestrator, "_call_image_model", side_effect=_fake_call) as call_model,
        ):
            result = orchestrator._edit_image_step_with_reference(
                base,
                "prompt",
                out,
                ref,
                "hint",
                force_reference=True,
            )

        assert result == out
        assert edit_step.call_count == 0
        assert call_model.call_count == 1

def test_step3_validator_prompt_focuses_on_gradient_logo_and_boxes():
    with patch.dict("os.environ", {"GEMINI_API_KEY": "fake-api-key"}):
        orchestrator = NexusImageOrchestrator()
        request = BannerRequest(
            request_meta={"canal": "05_whatsapp", "kv": "pos"},
            content_keys={
                "etiqueta": "EXTENSÃO",
                "titulo": "Gestão de Resseguro",
                "frase": "Frase de apoio",
                "box1": "INÍCIO: 23/04",
                "box2": "ON-LINE | AO VIVO",
                "persona": "executivo em escritório"
            }
        )
        context = {
            "meta": {"kv_palette": {"primary": "#005E7A", "overlay": "#004F6A"}},
            "etiqueta": {"texto_atual": "EXTENSÃO"},
            "titulo": {"texto_atual": "Gestão de Resseguro"},
            "frase": {"texto_atual": "Frase de apoio"},
        }
        prompt = orchestrator._build_step3_validator_prompt(context, request.request_meta)

        assert "degradê do kv inviolável" in prompt.lower()
        assert "logotipo" in prompt.lower()
        assert "degradê do kv inviável" not in prompt.lower()
        assert "degradê do kv inviolável" in prompt.lower()
        assert "faltar ícone" in prompt.lower()
        assert "transparente" in prompt.lower()
        assert "largura da box deve ser apenas o suficiente" in prompt.lower()
        assert "à direita do texto" in prompt.lower()
        assert "fora da box" in prompt.lower()
        assert "espaçamento vertical entre etiqueta, título e frase" in prompt.lower()
        assert "sem colidir ou abrir buracos exagerados" in prompt.lower()
        assert "organização das boxes por largura útil" in prompt.lower()
        assert "largura visual da frase" in prompt.lower()
        assert "não reprovar apenas por diferença de orientação em relação ao template" in prompt.lower()
        assert "alinhamento interno do conteúdo da box" in prompt.lower()
        assert "estilo independente box1/box2" in prompt.lower()
        assert "box2 com contorno vazado" in prompt.lower()
        assert "sem preenchimento sólido" in prompt.lower()
        assert "comparar matiz/saturação/brilho" in prompt.lower()
        assert "desvio sutil de cor do kv" in prompt.lower()
        assert "uma única linha" in prompt.lower()
        assert "boxes residuais/fantasma" in prompt.lower()
        assert "protocolo obrigatório de decisão" in prompt.lower()
        assert "grafismos orgânicos dos cantos" in prompt.lower()
        assert "topo esquerdo e canto inferior direito" in prompt.lower()
        assert "é proibido pedir ajuste de critério já aprovado" in prompt.lower()
        assert "regra inviolável: persona/fundo estão congelados no step 3" in prompt.lower()
        assert "persona/fundo são fora de escopo no step 3" in prompt.lower()
        assert "se somente boxes falharem, não mencionar degradê ou logotipo" in prompt.lower()
        assert "se somente degradê/logotipo falharem, não mencionar boxes" in prompt.lower()
        assert "prompt_correcao deve ser autossuficiente" in prompt.lower()
        assert "aplicado usando somente a imagem_gerada_step2" in prompt.lower()
        assert "não copiar qualquer texto do template" in prompt.lower()
        assert "desvio de branco para creme" in prompt.lower()
        assert "restaurar branco puro (#ffffff)" in prompt.lower()
        assert "sombra em título/frase" in prompt.lower()
        assert "remover qualquer sombreamento do título e da frase" in prompt.lower()
        assert "harmonia macro do bloco textual" in prompt.lower()
        assert "título longo espremido em uma linha" in prompt.lower()
        assert "quebrar o título em até 2 linhas" in prompt.lower()
        assert "ajuste leve de escala" in prompt.lower()


def test_step3_validator_prompt_differentiates_box1_and_box2_styles():
    with patch.dict("os.environ", {"GEMINI_API_KEY": "fake-api-key"}):
        orchestrator = NexusImageOrchestrator()
        request = BannerRequest(
            request_meta={"canal": "05_whatsapp", "kv": "pos"},
            content_keys={
                "etiqueta": "EXTENSÃO",
                "titulo": "Gestão de Resseguro",
                "frase": "Frase de apoio",
                "box1": "INÍCIO: 23/04",
                "box2": "ON-LINE | AO VIVO",
                "persona": "executivo em escritório",
            },
        )
        context = {
            "meta": {"kv_palette": {"primary": "#005E7A", "overlay": "#004F6A"}},
            "etiqueta": {"texto_atual": "EXTENSÃO"},
            "titulo": {"texto_atual": "Gestão de Resseguro"},
            "frase": {"texto_atual": "Frase de apoio"},
        }

        prompt = orchestrator._build_step3_validator_prompt(context, request.request_meta).lower()

        assert "box1" in prompt
        assert "box branca" in prompt
        assert "box2" in prompt
        assert "não é branca" in prompt
        assert "contorno" in prompt
        assert "cor do kv" in prompt


def test_step3_validator_prompt_requires_dedicated_box1_compaction_instruction():
    with patch.dict("os.environ", {"GEMINI_API_KEY": "fake-api-key"}):
        orchestrator = NexusImageOrchestrator()
        meta = BannerRequest(
            request_meta={"canal": "05_whatsapp", "kv": "pos"},
            content_keys={
                "etiqueta": "A",
                "titulo": "B",
                "frase": "C",
                "box1": "INÍCIO: 23/04",
                "box2": "ON-LINE",
                "persona": "P",
            },
        ).request_meta
        context = {"meta": {"kv_palette": {"primary": "#005E7A"}}}

        prompt = orchestrator._build_step3_validator_prompt(context, meta).lower()

        assert "se for erro de largura de box1" in prompt
        assert "tight, short white rectangular pill-shaped box" in prompt
        assert "closely wrapping the text" in prompt


def test_step3_validator_prompt_requires_kv_styled_box2_instruction():
    with patch.dict("os.environ", {"GEMINI_API_KEY": "fake-api-key"}):
        orchestrator = NexusImageOrchestrator()
        meta = BannerRequest(
            request_meta={"canal": "05_whatsapp", "kv": "pos"},
            content_keys={
                "etiqueta": "A",
                "titulo": "B",
                "frase": "C",
                "box1": "INÍCIO",
                "box2": "ON-LINE | AO VIVO",
                "persona": "P",
            },
        ).request_meta
        context = {"meta": {"kv_palette": {"primary": "#005E7A"}}}

        prompt = orchestrator._build_step3_validator_prompt(context, meta).lower()

        assert "se for erro de largura de box2" in prompt
        assert "não transformar a box2 em box branca" in prompt
        assert "contorno" in prompt
        assert "cor do kv" in prompt

def test_step3_validator_prompt_uses_request_texts_as_expected_texts():
    with patch.dict("os.environ", {"GEMINI_API_KEY": "fake-api-key"}):
        orchestrator = NexusImageOrchestrator()
        request = BannerRequest(
            request_meta={"canal": "05_whatsapp", "kv": "pos"},
            content_keys={
                "etiqueta": "MBAs 2026",
                "titulo": "Condições especiais para o seu próximo MBA",
                "frase": "ENS e Sincor juntos para especialização da sua carreira com vantagens exclusivas",
                "box1": "40% de desconto | para associados ao Sincor",
                "box2": "20% de desconto* | para pessoas indicadas por corretores associados",
                "persona": "3 pessoas em reunião",
            },
        )
        context = {
            "meta": {"kv_palette": {"primary": "#005563"}},
            "etiqueta": {"texto_atual": "FACULDADE ENS"},
            "titulo": {"texto_atual": "Gestão de Seguros"},
            "frase": {"texto_atual": "Construa um futuro sólido no mercado de seguros"},
            "box1": {"texto_atual": "20% DE DESCONTO"},
            "box2": {"texto_atual": "ON-LINE | AO VIVO"},
        }

        prompt = orchestrator._build_step3_validator_prompt(context, request.request_meta, request.content_keys).lower()

        assert "expected_texts" in prompt
        assert "expected_texts é a fonte da verdade textual" in prompt
        assert "texto do contexto_json/template é referência visual" in prompt
        assert "40% de desconto | para associados ao sincor" in prompt
        assert "20% de desconto* | para pessoas indicadas por corretores associados" in prompt
        assert "20% de desconto\"}" not in prompt.split("expected_texts:", 1)[1].split("\n", 1)[0].lower()

def test_step3_correction_prompt_appends_text_lock_and_adaptive_box_guardrails(tmp_path):
    with patch.dict("os.environ", {"GEMINI_API_KEY": "fake-api-key"}):
        orchestrator = NexusImageOrchestrator()
        request = BannerRequest(
            request_meta={"canal": "05_whatsapp", "kv": "pos"},
            content_keys={
                "etiqueta": "MBAs 2026",
                "titulo": "Condições especiais para o seu próximo MBA",
                "frase": "ENS e Sincor juntos para especialização da sua carreira com vantagens exclusivas",
                "box1": "40% de desconto | para associados ao Sincor",
                "box2": "20% de desconto* | para pessoas indicadas por corretores associados",
                "persona": "3 pessoas em reunião",
            },
        )
        base_path = tmp_path / "step2.png"
        Image.new("RGB", (1080, 1080), color=(20, 40, 60)).save(base_path)
        temp_dir = tmp_path / "temp"
        temp_dir.mkdir(parents=True, exist_ok=True)

        with (
            patch.object(
                orchestrator,
                "_validate_step3_output",
                side_effect=[
                    MagicMock(status="CORREÇÃO", prompt_correcao="Compactar boxes longas.", motivo="boxes largas"),
                    MagicMock(status="APROVADO", prompt_correcao="", motivo="ok"),
                ],
            ),
            patch.object(
                orchestrator,
                "_edit_image_step_with_reference",
                side_effect=lambda p, prm, out, ref, hint: (Image.new("RGB", (1080, 1080), color=(30, 50, 70)).save(out), out)[1],
            ) as reference_edit,
            patch.object(orchestrator, "_validate_text_lock_output", return_value=MagicMock(status="APROVADO", prompt_correcao="", motivo="ok")),
            patch.object(orchestrator, "_is_global_overcorrection", return_value=False),
            patch.object(orchestrator, "_is_persona_region_degraded", return_value=False),
        ):
            orchestrator._run_step3_correction_cycle(
                current_image_path=base_path,
                temp_dir=temp_dir,
                kv_structure_reference_path=base_path,
                context={},
                meta=request.request_meta,
                keys=request.content_keys,
            )

        correction_prompt = reference_edit.call_args.args[1].lower()
        assert "compactar boxes longas" in correction_prompt
        assert "expected_texts" in correction_prompt
        assert "40% de desconto | para associados ao sincor" in correction_prompt
        assert "20% de desconto* | para pessoas indicadas por corretores associados" in correction_prompt
        assert "pode adaptar largura, empilhamento e espaçamento local das boxes" in correction_prompt
        assert "não alterar kv, degradê, logotipo, grafismos ou persona" in correction_prompt
        assert "não repintar persona/fundo" in correction_prompt
        assert "sem saturação" in correction_prompt
        assert "adaptação mínima permitida do bloco textual" in correction_prompt
        assert "quebrar título longo em até 2 linhas" in correction_prompt

def test_step3_correction_discards_round_when_text_lock_fails(tmp_path):
    with patch.dict("os.environ", {"GEMINI_API_KEY": "fake-api-key"}):
        orchestrator = NexusImageOrchestrator()
        request = BannerRequest(
            request_meta={"canal": "05_whatsapp", "kv": "pos"},
            content_keys={
                "etiqueta": "MBAs 2026",
                "titulo": "Condições especiais para o seu próximo MBA",
                "frase": "ENS e Sincor juntos",
                "box1": "40% de desconto | para associados ao Sincor",
                "box2": "20% de desconto* | para pessoas indicadas por corretores associados",
                "persona": "3 pessoas em reunião",
            },
        )
        base_path = tmp_path / "step2.png"
        Image.new("RGB", (1080, 1080), color=(20, 40, 60)).save(base_path)
        temp_dir = tmp_path / "temp"
        temp_dir.mkdir(parents=True, exist_ok=True)

        with (
            patch.object(
                orchestrator,
                "_validate_step3_output",
                return_value=MagicMock(status="CORREÇÃO", prompt_correcao="Compactar boxes longas.", motivo="boxes largas"),
            ) as validate_step3,
            patch.object(
                orchestrator,
                "_edit_image_step_with_reference",
                side_effect=lambda p, prm, out, ref, hint: (Image.new("RGB", (1080, 1080), color=(30, 50, 70)).save(out), out)[1],
            ),
            patch.object(orchestrator, "_validate_text_lock_output", return_value=MagicMock(status="CORREÇÃO", prompt_correcao="Restaurar textos", motivo="box revertida")),
            patch.object(orchestrator, "_is_global_overcorrection", return_value=False),
            patch.object(orchestrator, "_is_persona_region_degraded", return_value=False),
        ):
            result = orchestrator._run_step3_correction_cycle(
                current_image_path=base_path,
                temp_dir=temp_dir,
                kv_structure_reference_path=base_path,
                context={},
                meta=request.request_meta,
                keys=request.content_keys,
            )

        assert result == base_path
        assert validate_step3.call_count == 1

def test_persona_degradation_guard_detects_large_change_in_upper_region(tmp_path):
    with patch.dict("os.environ", {"GEMINI_API_KEY": "fake-api-key"}):
        orchestrator = NexusImageOrchestrator()
        before_path = tmp_path / "before.png"
        after_path = tmp_path / "after.png"

        before = Image.new("RGB", (1200, 1200), color=(40, 70, 90))
        after = Image.new("RGB", (1200, 1200), color=(40, 70, 90))
        for x in range(200, 1000):
            for y in range(120, 560):
                after.putpixel((x, y), (220, 220, 220))
        before.save(before_path)
        after.save(after_path)

        assert orchestrator._is_persona_region_degraded(before_path, after_path) is True

def test_step3_persona_lock_prompt_audits_quality_regression():
    with patch.dict("os.environ", {"GEMINI_API_KEY": "fake-api-key"}):
        orchestrator = NexusImageOrchestrator()
        meta = BannerRequest(
            request_meta={"canal": "05_whatsapp", "kv": "pos"},
            content_keys={
                "etiqueta": "A",
                "titulo": "B",
                "frase": "C",
                "box1": "D",
                "box2": "E",
                "persona": "3 pessoas em reunião",
            },
        ).request_meta

        prompt = orchestrator._build_step3_persona_lock_prompt(meta).lower()

        assert "persona/fundo" in prompt
        assert "compare imagem_antes_step3 e imagem_depois_step3" in prompt
        assert "saturação" in prompt
        assert "borrado" in prompt
        assert "borracha" in prompt
        assert "pele" in prompt
        assert "aprovado" in prompt
        assert "correção" in prompt

def test_step3_correction_discards_round_when_persona_lock_qa_fails(tmp_path):
    with patch.dict("os.environ", {"GEMINI_API_KEY": "fake-api-key"}):
        orchestrator = NexusImageOrchestrator()
        request = BannerRequest(
            request_meta={"canal": "05_whatsapp", "kv": "pos"},
            content_keys={
                "etiqueta": "FACULDADE ENS",
                "titulo": "Gestão de Seguros",
                "frase": "Frase",
                "box1": "Box1",
                "box2": "Box2",
                "persona": "Persona",
            },
        )
        base_path = tmp_path / "step2.png"
        Image.new("RGB", (1080, 1080), color=(20, 40, 60)).save(base_path)
        temp_dir = tmp_path / "temp"
        temp_dir.mkdir(parents=True, exist_ok=True)

        with (
            patch.object(
                orchestrator,
                "_validate_step3_output",
                return_value=MagicMock(status="CORREÇÃO", prompt_correcao="Ajustar boxes", motivo="teste"),
            ) as validate_step3,
            patch.object(
                orchestrator,
                "_edit_image_step_with_reference",
                side_effect=lambda p, prm, out, ref, hint: (Image.new("RGB", (1080, 1080), color=(30, 50, 70)).save(out), out)[1],
            ),
            patch.object(orchestrator, "_is_global_overcorrection", return_value=False),
            patch.object(orchestrator, "_is_persona_region_degraded", return_value=False),
            patch.object(orchestrator, "_validate_text_lock_output", return_value=MagicMock(status="APROVADO", prompt_correcao="", motivo="ok")),
            patch.object(orchestrator, "_validate_step3_persona_lock_output", return_value=MagicMock(status="CORREÇÃO", prompt_correcao="", motivo="persona saturada e borrada")) as persona_lock,
        ):
            result = orchestrator._run_step3_correction_cycle(
                current_image_path=base_path,
                temp_dir=temp_dir,
                kv_structure_reference_path=base_path,
                context={},
                meta=request.request_meta,
                keys=request.content_keys,
            )

        assert result == base_path
        assert validate_step3.call_count == 1
        assert persona_lock.call_count == 1

def test_step3_correction_discards_round_when_persona_region_is_degraded(tmp_path):
    with patch.dict("os.environ", {"GEMINI_API_KEY": "fake-api-key"}):
        orchestrator = NexusImageOrchestrator()
        request = BannerRequest(
            request_meta={"canal": "05_whatsapp", "kv": "pos"},
            content_keys={
                "etiqueta": "FACULDADE ENS",
                "titulo": "Gestão de Seguros",
                "frase": "Frase",
                "box1": "Box1",
                "box2": "Box2",
                "persona": "Persona"
            }
        )
        base_path = tmp_path / "step2.png"
        Image.new("RGB", (1080, 1080), color=(20, 40, 60)).save(base_path)
        temp_dir = tmp_path / "temp"
        temp_dir.mkdir(parents=True, exist_ok=True)

        with (
            patch.object(
                orchestrator,
                "_validate_step3_output",
                side_effect=[
                    MagicMock(status="CORREÇÃO", prompt_correcao="Ajustar degradê", motivo="teste"),
                    MagicMock(status="APROVADO", prompt_correcao="", motivo="ok"),
                ]
            ) as validate_step3,
            patch.object(
                orchestrator,
                "_edit_image_step_with_reference",
                side_effect=lambda p, prm, out, ref, hint: (Image.new("RGB", (1080, 1080), color=(100, 110, 120)).save(out), out)[1]
            ) as reference_edit,
            patch.object(orchestrator, "_is_global_overcorrection", return_value=False),
            patch.object(orchestrator, "_is_persona_region_degraded", return_value=True) as degraded_guard
        ):
            result = orchestrator._run_step3_correction_cycle(
                current_image_path=base_path,
                temp_dir=temp_dir,
                kv_structure_reference_path=base_path,
                context={},
                meta=request.request_meta
            )

        assert result == base_path
        assert validate_step3.call_count == 1
        assert reference_edit.call_count == 1
        assert degraded_guard.call_count == 1

def test_process_job_uses_unified_text_step():
    with patch.dict("os.environ", {"GEMINI_API_KEY": "fake-api-key"}):
        orchestrator = NexusImageOrchestrator()
        request = BannerRequest(
            request_meta={"canal": "01_feed_instagram", "kv": "pos"},
            content_keys={
                "etiqueta": "PÓS-GRADUAÇÃO",
                "titulo": "Gestão Estratégica",
                "frase": "Frase nova",
                "box1": "Início imediato",
                "box2": "Turma confirmada",
                "persona": "homem em escritório"
            }
        )
        context = {
            "etiqueta": {"texto_atual": "MBA"},
            "titulo": {"texto_atual": "Finanças e Seguros"},
            "frase": {"texto_atual": "Texto antigo"},
            "box1": {"texto_atual": "INÍCIO: 07/04"},
            "box2": {"texto_atual": "ON-LINE | AO VIVO"},
            "persona": {"descricao": "persona antiga"}
        }
        template_path = Path("fake/template/base.png")

        with (
            patch.object(orchestrator, "load_template_context", return_value=context),
            patch("main.select_template", return_value=template_path),
            patch.object(orchestrator, "_read_dimensions_from_file", return_value=(1080, 1350)),
            patch.object(orchestrator, "_postprocess_final_resolution", side_effect=lambda p, s, o: p),
            patch.object(orchestrator, "_generate_text_change_prompt", return_value="- mude a etiqueta de \"MBA\" para \"PÓS-GRADUAÇÃO\"") as unified_prompt,
            patch.object(orchestrator, "_generate_main_text_prompt", return_value="- mude a etiqueta de \"MBA\" para \"PÓS-GRADUAÇÃO\"") as main_prompt,
            patch.object(orchestrator, "_generate_boxes_prompt", return_value="- mude a box1 de \"A\" para \"B\"") as boxes_prompt,
            patch.object(orchestrator, "_validate_step3_output", return_value=MagicMock(status="APROVADO", prompt_correcao="", motivo="ok")),
            patch.object(orchestrator, "_edit_image_step_with_reference", side_effect=lambda *args, **kwargs: (args[2].parent.mkdir(parents=True, exist_ok=True), args[2].touch(), args[2])[2]),
            patch.object(
                orchestrator,
                "_edit_image_step",
                side_effect=lambda p, prm, out: (out.parent.mkdir(parents=True, exist_ok=True), out.touch(), out)[2]
            )
        ):
            orchestrator.process_job(request)

        assert unified_prompt.called
        assert not main_prompt.called
        assert not boxes_prompt.called

def test_process_job_updates_persona_directly_on_template():
    with patch.dict("os.environ", {"GEMINI_API_KEY": "fake-api-key"}):
        orchestrator = NexusImageOrchestrator()
        request = BannerRequest(
            request_meta={"canal": "01_feed_instagram", "kv": "pos"},
            content_keys={
                "etiqueta": "PÓS-GRADUAÇÃO",
                "titulo": "Gestão Estratégica",
                "frase": "Frase nova",
                "box1": "Início imediato",
                "box2": "Turma confirmada",
                "persona": "homem em escritório"
            }
        )
        context = {
            "etiqueta": {"texto_atual": "MBA"},
            "titulo": {"texto_atual": "Finanças e Seguros"},
            "frase": {"texto_atual": "Texto antigo"},
            "box1": {"texto_atual": "INÍCIO: 07/04"},
            "box2": {"texto_atual": "ON-LINE | AO VIVO"},
            "persona": {"descricao": "persona antiga"}
        }
        template_path = Path("fake/template/base.png")

        with (
            patch.object(orchestrator, "load_template_context", return_value=context),
            patch("main.select_template", return_value=template_path),
            patch.object(orchestrator, "_read_dimensions_from_file", return_value=(1080, 1080)),
            patch.object(orchestrator, "_postprocess_final_resolution", side_effect=lambda p, s, o: p),
            patch.object(orchestrator, "_generate_text_change_prompt", return_value="- mude a etiqueta de \"MBA\" para \"PÓS-GRADUAÇÃO\""),
            patch.object(orchestrator, "_generate_persona_change_prompt", return_value="alterar persona"),
            patch.object(orchestrator, "_edit_image_step", side_effect=lambda p, prm, out: (out.parent.mkdir(parents=True, exist_ok=True), out.touch(), out)[2]) as edit_step,
            patch.object(orchestrator, "_validate_step3_output", return_value=MagicMock(status="APROVADO", prompt_correcao="", motivo="ok")),
            patch.object(orchestrator, "_edit_image_step_with_reference", side_effect=lambda *args, **kwargs: (args[2].parent.mkdir(parents=True, exist_ok=True), args[2].touch(), args[2])[2]) as reference_edit,
        ):
            orchestrator.process_job(request)

        assert edit_step.call_count == 0
        assert reference_edit.call_count == 2
        assert reference_edit.call_args_list[1].args[2].name == "step2_persona.png"

def test_process_job_skips_optional_step3_validator_even_when_enabled():
    with patch.dict("os.environ", {"GEMINI_API_KEY": "fake-api-key", "ENABLE_STEP3_VALIDATION": "1"}):
        orchestrator = NexusImageOrchestrator()
        request = BannerRequest(
            request_meta={"canal": "08_topo_email", "kv": "graduacao"},
            content_keys={
                "etiqueta": "PÓS-GRADUAÇÃO",
                "titulo": "Gestão Estratégica",
                "frase": "Frase nova",
                "box1": "Início imediato",
                "box2": "Turma confirmada",
                "persona": "mulher com notebook em ambiente corporativo"
            }
        )
        context = {
            "etiqueta": {"texto_atual": "MBA"},
            "titulo": {"texto_atual": "Finanças e Seguros"},
            "frase": {"texto_atual": "Texto antigo"},
            "box1": {"texto_atual": "INÍCIO: 07/04"},
            "box2": {"texto_atual": "ON-LINE | AO VIVO"},
            "persona": {"descricao": "persona antiga"},
            "meta": {"kv_palette": {"primary": "#FF5722"}}
        }
        template_path = Path("fake/template/base.png")

        with (
            patch.object(orchestrator, "load_template_context", return_value=context),
            patch("main.select_template", return_value=template_path),
            patch.object(orchestrator, "_read_dimensions_from_file", return_value=(1200, 628)),
            patch.object(orchestrator, "_postprocess_final_resolution", side_effect=lambda p, s, o: p) as postprocess_mock,
            patch.object(orchestrator, "_generate_text_change_prompt", return_value="- mude a etiqueta de \"MBA\" para \"PÓS-GRADUAÇÃO\""),
            patch.object(orchestrator, "_generate_persona_change_prompt", return_value="alterar persona"),
            patch.object(orchestrator, "_edit_image_step", side_effect=lambda p, prm, out: (out.parent.mkdir(parents=True, exist_ok=True), out.touch(), out)[2]) as edit_step,
            patch.object(orchestrator, "_run_step3_correction_cycle", return_value=Path("should/not/be/used.png")) as step3_cycle,
            patch.object(orchestrator, "_validate_step3_output") as validate_step3,
            patch.object(orchestrator, "_edit_image_step_with_reference", side_effect=lambda *args, **kwargs: (args[2].parent.mkdir(parents=True, exist_ok=True), args[2].touch(), args[2])[2]) as reference_edit,
        ):
            orchestrator.process_job(request)

        assert step3_cycle.call_count == 0
        assert validate_step3.call_count == 0
        assert edit_step.call_count == 0
        assert reference_edit.call_count == 2
        assert reference_edit.call_args_list[1].args[2].name == "step2_persona.png"
        assert postprocess_mock.call_count == 1

def test_process_adjustment_keeps_manual_prompt_and_runs_final_resize_without_stabilization(tmp_path):
    with patch.dict("os.environ", {"GEMINI_API_KEY": "fake-api-key"}):
        orchestrator = NexusImageOrchestrator()
        base_image_path = tmp_path / "base.png"
        base_image_path.touch()

        def create_output(_input_path, _prompt, out_path):
            out_path.parent.mkdir(parents=True, exist_ok=True)
            out_path.touch()
            return out_path

        with (
            patch.object(orchestrator, "_edit_image_step_raw", side_effect=create_output, create=True) as edit_step_raw,
            patch.object(orchestrator, "_postprocess_final_resolution", side_effect=lambda p, s, o: p) as postprocess_mock
        ):
            final_path = orchestrator.process_adjustment(
                image_path=base_image_path,
                prompt="Corrigir somente o texto da box2 para oferta válida até 30/11.",
                target_size=(1200, 628)
            )

        assert final_path.name.startswith("adj_")
        assert edit_step_raw.call_count == 1
        assert "Corrigir somente o texto da box2 para oferta válida até 30/11." in edit_step_raw.call_args.args[1]
        assert not hasattr(orchestrator, "_preserve_non_target_regions")
        assert postprocess_mock.call_count == 1
        assert postprocess_mock.call_args.args[1] == (1200, 628)

def test_process_adjustment_uses_delivery_size_from_editable_source_and_keeps_raw_prompt(tmp_path):
    with patch.dict("os.environ", {"GEMINI_API_KEY": "fake-api-key"}):
        orchestrator = NexusImageOrchestrator()
        delivery_path = tmp_path / "outputs" / "piece.png"
        editable_path = tmp_path / "outputs" / "piece.editable.png"
        delivery_path.parent.mkdir(parents=True, exist_ok=True)
        Image.new("RGB", (1299, 1300), color="white").save(delivery_path)
        Image.new("RGB", (4096, 4096), color="white").save(editable_path)

        def create_output(_input_path, _prompt, out_path):
            Image.new("RGB", (4096, 4096), color="white").save(out_path)
            return out_path

        with (
            patch.object(orchestrator, "_edit_image_step_raw", side_effect=create_output, create=True) as edit_step_raw,
            patch.object(orchestrator, "_postprocess_final_resolution", side_effect=lambda p, s, o: p) as postprocess_mock
        ):
            manual_prompt = "ajuste o texto 'texto antigo' para 'texto novo'"
            orchestrator.process_adjustment(
                image_path=editable_path,
                prompt=manual_prompt
            )

        assert edit_step_raw.call_count == 1
        assert edit_step_raw.call_args.args[1] == manual_prompt
        assert not hasattr(orchestrator, "_preserve_non_target_regions")
        assert postprocess_mock.call_args.args[1] == (1299, 1300)

def test_postprocess_final_resolution_keeps_template_dimensions_by_default(tmp_path):
    with patch.dict("os.environ", {"GEMINI_API_KEY": "fake-api-key"}):
        orchestrator = NexusImageOrchestrator()
        source_path = tmp_path / "source.png"
        output_path = tmp_path / "delivery.png"
        Image.new("RGB", (400, 400), color="white").save(source_path)

        orchestrator._postprocess_final_resolution(source_path, (100, 100), output_path)

        assert Image.open(output_path).size == (100, 100)

def test_process_adjustment_uses_raw_editable_prompt_and_4k(tmp_path):
    with patch.dict("os.environ", {"GEMINI_API_KEY": "fake-api-key"}):
        orchestrator = NexusImageOrchestrator()
        editable_path = tmp_path / "piece.editable.png"
        delivery_path = tmp_path / "piece.png"
        Image.new("RGB", (4096, 4096), color="white").save(editable_path)
        Image.new("RGB", (1080, 1080), color="white").save(delivery_path)

        calls = {}

        def fake_raw(image_path, prompt, out_path):
            calls["image_path"] = image_path
            calls["prompt"] = prompt
            Image.new("RGB", (4096, 4096), color="white").save(out_path)
            return out_path

        with (
            patch.object(orchestrator, "_edit_image_step_raw", side_effect=fake_raw, create=True),
            patch.object(orchestrator, "_postprocess_final_resolution", side_effect=lambda p, s, o: p),
        ):
            orchestrator.process_adjustment(editable_path, "adicione novos elementos visuais")

        assert calls["image_path"] == editable_path
        assert calls["prompt"] == "adicione novos elementos visuais"

def test_run_pipeline_sync_stores_editable_source_path_for_manual_adjustment(tmp_path):
    _jobs.clear()
    raw_request = {
        "request_meta": {"canal": "01_feed_instagram", "kv": "pos"},
        "content_keys": {
            "etiqueta": "EXTENSÃO",
            "titulo": "Contrato de Resseguro",
            "frase": "Frase",
            "box1": "TURMA CONFIRMADA",
            "box2": "INÍCIO: 28/04",
            "persona": "advogado lendo contrato"
        },
    }
    job = create_job(GenerationMode.PECA_UNICA, raw_request)
    final_output = tmp_path / "outputs" / "01_feed_instagram.png"
    editable_output = tmp_path / "outputs" / "01_feed_instagram.editable.png"
    final_output.parent.mkdir(parents=True, exist_ok=True)
    final_output.touch()
    editable_output.touch()

    with patch("api.job_service.generate_banner", return_value=final_output):
        _run_pipeline_sync(job.job_id, raw_request)

    updated = _jobs[job.job_id]
    assert getattr(updated.itens[0], "_local_output_path") == str(editable_output.absolute())

def test_run_adjustment_sync_promotes_new_editable_source_for_next_manual_round(tmp_path):
    _jobs.clear()
    raw_request = {
        "request_meta": {"canal": "01_feed_instagram", "kv": "pos"},
        "content_keys": {
            "etiqueta": "EXTENSÃO",
            "titulo": "Contrato de Resseguro",
            "frase": "Frase",
            "box1": "TURMA CONFIRMADA",
            "box2": "INÍCIO: 28/04",
            "persona": "advogado lendo contrato"
        },
    }
    job = create_job(GenerationMode.PECA_UNICA, raw_request)
    item = job.itens[0]
    editable_input = tmp_path / "outputs" / "seed.editable.png"
    final_delivery = tmp_path / "outputs" / "seed.png"
    editable_input.parent.mkdir(parents=True, exist_ok=True)
    Image.new("RGB", (4096, 4096), color="white").save(editable_input)
    Image.new("RGB", (1299, 1300), color="white").save(final_delivery)
    setattr(item, "_local_output_path", str(editable_input.absolute()))
    item.file_url = f"/files/{final_delivery.name}"
    item.status = JobItemStatus.DONE

    adjusted_final = tmp_path / "outputs" / "adj_seed.png"
    adjusted_editable = tmp_path / "outputs" / "adj_seed.editable.png"
    Image.new("RGB", (1299, 1300), color="white").save(adjusted_final)
    Image.new("RGB", (4096, 4096), color="white").save(adjusted_editable)

    orchestrator_mock = MagicMock()
    orchestrator_mock.process_adjustment.return_value = adjusted_final

    with (
        patch("main.NexusImageOrchestrator", return_value=orchestrator_mock),
        patch("api.job_service._respect_global_throttle", return_value=None),
        patch("api.job_service.is_supabase_outputs_enabled", return_value=False),
    ):
        _run_adjustment_sync(job.job_id, item.item_id, "ajuste o texto")

    updated = _jobs[job.job_id]
    assert getattr(updated.itens[0], "_local_output_path") == str(adjusted_editable.absolute())
    orchestrator_mock.process_adjustment.assert_called_once()


def test_run_adjustment_sync_prefers_editable_sibling_over_delivery_file_url_when_local_path_is_missing():
    _jobs.clear()
    raw_request = {
        "request_meta": {"canal": "01_feed_instagram", "kv": "pos"},
        "content_keys": {
            "etiqueta": "EXTENSÃO",
            "titulo": "Contrato de Resseguro",
            "frase": "Frase",
            "box1": "TURMA CONFIRMADA",
            "box2": "INÍCIO: 28/04",
            "persona": "advogado lendo contrato",
        },
    }
    job = create_job(GenerationMode.PECA_UNICA, raw_request)
    item = job.itens[0]
    item.status = JobItemStatus.DONE

    unique_name = f"test_adjustment_{item.item_id.replace('-', '_')}"
    outputs_dir = Path("outputs")
    delivery_path = outputs_dir / f"{unique_name}.png"
    editable_path = outputs_dir / f"{unique_name}.editable.png"
    adjusted_final = outputs_dir / f"adj_{unique_name}.png"
    adjusted_editable = outputs_dir / f"adj_{unique_name}.editable.png"

    outputs_dir.mkdir(parents=True, exist_ok=True)
    Image.new("RGB", (1200, 628), color="white").save(delivery_path)
    Image.new("RGB", (4096, 4096), color="white").save(editable_path)
    Image.new("RGB", (1200, 628), color="white").save(adjusted_final)
    Image.new("RGB", (4096, 4096), color="white").save(adjusted_editable)

    item.file_url = f"/files/{delivery_path.name}"

    orchestrator_mock = MagicMock()
    orchestrator_mock.process_adjustment.return_value = adjusted_final

    try:
        with (
            patch("main.NexusImageOrchestrator", return_value=orchestrator_mock),
            patch("api.job_service._respect_global_throttle", return_value=None),
            patch("api.job_service.is_supabase_outputs_enabled", return_value=False),
        ):
            _run_adjustment_sync(job.job_id, item.item_id, "ajuste o texto")
    finally:
        for path in (delivery_path, editable_path, adjusted_final, adjusted_editable):
            if path.exists():
                path.unlink()

    orchestrator_mock.process_adjustment.assert_called_once()
    assert orchestrator_mock.process_adjustment.call_args.args[0] == editable_path

def test_image_call_caps_retries_for_quota_exhausted():
    with patch.dict(
        "os.environ",
        {
            "GEMINI_API_KEY": "fake-api-key",
            "GENAI_MAX_RETRIES": "6",
            "GENAI_MAX_RETRIES_RESOURCE_EXHAUSTED": "2"
        }
    ):
        orchestrator = NexusImageOrchestrator()
        image = Image.new("RGB", (1080, 1350), color="white")
        with patch.object(
            orchestrator.image_client.models,
            "generate_content",
            side_effect=Exception("429 RESOURCE_EXHAUSTED. {'error': {'code': 429, 'status': 'RESOURCE_EXHAUSTED'}}")
        ) as generate_content_mock:
            with pytest.raises(Exception):
                orchestrator._call_image_model(image, "teste")

            assert generate_content_mock.call_count == 2

def test_image_call_fallbacks_image_size_on_internal_error():
    with patch.dict(
        "os.environ",
        {
            "GEMINI_API_KEY": "fake-api-key",
            "IMAGE_SIZE": "4K",
            "GENAI_MAX_RETRIES": "1",
            "GENAI_MAX_RETRIES_RESOURCE_EXHAUSTED": "1"
        }
    ):
        orchestrator = NexusImageOrchestrator()
        image = Image.new("RGB", (1080, 1350), color="white")

        output_buffer = io.BytesIO()
        Image.new("RGB", (1080, 1350), color="white").save(output_buffer, format="PNG")
        output_bytes = output_buffer.getvalue()

        part = MagicMock()
        inline_data = MagicMock()
        inline_data.data = output_bytes
        part.inline_data = inline_data
        candidate_content = MagicMock()
        candidate_content.parts = [part]
        candidate = MagicMock()
        candidate.content = candidate_content
        success_response = MagicMock()
        success_response.candidates = [candidate]

        image_sizes_used = []

        def side_effect(*args, **kwargs):
            config = kwargs.get("config")
            image_config = getattr(config, "image_config", None)
            image_sizes_used.append(getattr(image_config, "image_size", None))
            if len(image_sizes_used) < 3:
                raise Exception("500 INTERNAL. {'error': {'code': 500, 'status': 'INTERNAL'}}")
            return success_response

        with patch.object(orchestrator.image_client.models, "generate_content", side_effect=side_effect):
            result = orchestrator._call_image_model(image, "teste")

        assert result is not None
        assert image_sizes_used == ["4K", "2K", None]

def test_image_call_composites_transparent_output_over_original():
    with patch.dict("os.environ", {"GEMINI_API_KEY": "fake-api-key"}):
        orchestrator = NexusImageOrchestrator()
        base = Image.new("RGBA", (2, 2), (255, 87, 34, 255))
        transparent_output = Image.new("RGBA", (2, 2), (0, 0, 0, 0))
        buffer = io.BytesIO()
        transparent_output.save(buffer, format="PNG")
        output_bytes = buffer.getvalue()

        part = MagicMock()
        inline_data = MagicMock()
        inline_data.data = output_bytes
        part.inline_data = inline_data
        candidate_content = MagicMock()
        candidate_content.parts = [part]
        candidate = MagicMock()
        candidate.content = candidate_content
        success_response = MagicMock()
        success_response.candidates = [candidate]

        with patch.object(orchestrator.image_client.models, "generate_content", return_value=success_response):
            result = orchestrator._call_image_model(base, "teste")

        assert result.getpixel((0, 0))[:3] == (255, 87, 34)

def test_resolve_target_channels_enxoval_returns_fixed_order():
    channels = _resolve_target_channels(GenerationMode.ENXOVAL, None)
    assert channels == [
        "01_feed_instagram",
        "03_banner_interno_desktop",
        "04_banner_interno_mobile",
        "05_whatsapp",
        "08_topo_email",
    ]

def test_resolve_target_channels_single_requires_channel():
    with pytest.raises(Exception):
        _resolve_target_channels(GenerationMode.PECA_UNICA, "")

def test_resolve_persona_value_prefers_persona_field():
    value = _resolve_persona_value("persona principal", "persona legado")
    assert value == "persona principal"

def test_resolve_persona_value_uses_legacy_field_when_needed():
    value = _resolve_persona_value("", "persona legado")
    assert value == "persona legado"

def test_resolve_persona_value_requires_any_value():
    with pytest.raises(HTTPException) as exc:
        _resolve_persona_value("   ", "   ")
    assert exc.value.status_code == 422

def test_templates_catalog_builds_channels_and_kvs():
    fake_templates = {
        "01_feed_instagram": {"pos": ["a.png"], "graduacao": ["b.png"]},
        "05_whatsapp": {"pos": ["c.png"]},
    }
    with patch("api.app.list_templates", return_value=fake_templates):
        templates, canais, kvs = _templates_catalog()
    assert templates == fake_templates
    assert canais == ["01_feed_instagram", "05_whatsapp"]
    assert kvs == ["graduacao", "pos"]

def test_run_pipeline_sync_enxoval_marks_partial_done():
    _jobs.clear()
    raw_request = {
        "request_meta": {"canal": "01_feed_instagram", "kv": "pos"},
        "content_keys": {
            "etiqueta": "EXTENSÃO",
            "titulo": "Contrato de Resseguro",
            "frase": "Frase",
            "box1": "TURMA CONFIRMADA",
            "box2": "INÍCIO: 28/04",
            "persona": "advogado lendo contrato"
        },
    }
    job = create_job(GenerationMode.ENXOVAL, raw_request)
    called_channels = []

    def fake_generate_banner(request):
        called_channels.append(request.request_meta.canal)
        if request.request_meta.canal == "04_banner_interno_mobile":
            raise RuntimeError("falha canal mobile")
        return Path(f"outputs/{request.request_meta.canal}.png")

    with patch("api.job_service.generate_banner", side_effect=fake_generate_banner):
        _run_pipeline_sync(job.job_id, raw_request)

    updated = _jobs[job.job_id]
    assert updated.status == JobStatus.PARTIAL_DONE
    assert called_channels == [
        "01_feed_instagram",
        "03_banner_interno_desktop",
        "04_banner_interno_mobile",
        "05_whatsapp",
        "08_topo_email",
    ]
    assert len(updated.itens) == 5
    assert updated.itens[2].status == "failed"
    assert updated.itens[4].status == "done"

def test_run_pipeline_sync_updates_metrics_and_summary():
    _jobs.clear()
    job_service_module._enxoval_seconds_history.clear()
    job_service_module._channel_seconds_history.clear()
    raw_request = {
        "request_meta": {"canal": "01_feed_instagram", "kv": "pos"},
        "content_keys": {
            "etiqueta": "EXTENSÃO",
            "titulo": "Contrato de Resseguro",
            "frase": "Frase",
            "box1": "TURMA CONFIRMADA",
            "box2": "INÍCIO: 28/04",
            "persona": "advogado lendo contrato"
        },
    }
    job = create_job(GenerationMode.ENXOVAL, raw_request)

    with (
        patch("api.job_service.generate_banner", side_effect=lambda request: Path(f"outputs/{request.request_meta.canal}.png")),
        patch("api.job_service._respect_global_throttle", return_value=None),
    ):
        _run_pipeline_sync(job.job_id, raw_request)

    updated = _jobs[job.job_id]
    assert updated.status == JobStatus.DONE
    assert updated.metrics.elapsed_seconds_total >= 0
    assert len(updated.metrics.elapsed_seconds_by_channel) == 5
    assert updated.metrics.estimated_seconds_remaining == 0
    summary = get_enxoval_metrics_summary()
    assert summary["sample_size"] >= 1
    assert summary["avg_seconds_per_enxoval"] >= 0
    assert summary["avg_seconds_per_channel"] >= 0


def test_run_pipeline_sync_uploads_outputs_to_supabase_when_enabled():
    _jobs.clear()
    raw_request = {
        "request_meta": {
            "canal": "01_feed_instagram",
            "kv": "pos",
            "requested_by": "b8f74bbf-6b31-4bf6-9867-2138d2666630",
        },
        "content_keys": {
            "etiqueta": "EXTENSÃO",
            "titulo": "Contrato de Resseguro",
            "frase": "Frase",
            "box1": "TURMA CONFIRMADA",
            "box2": "INÍCIO: 28/04",
            "persona": "advogado lendo contrato"
        },
    }
    job = create_job(GenerationMode.ENXOVAL, raw_request)

    with (
        patch("api.job_service.generate_banner", side_effect=lambda request: Path(f"outputs/{request.request_meta.canal}.png")),
        patch("api.job_service._respect_global_throttle", return_value=None),
        patch("api.job_service.is_supabase_outputs_enabled", return_value=True),
        patch(
            "api.job_service.upload_output_to_supabase",
            side_effect=lambda **kwargs: {
                "storage_path": f"{kwargs['job_id']}/{kwargs['item_id']}.png",
                "signed_url": f"https://cdn.example.com/{kwargs['job_id']}/{kwargs['item_id']}.png",
                "signed_url_expires_at": "2026-03-18T12:00:00Z",
            },
        ),
    ):
        _run_pipeline_sync(job.job_id, raw_request)

    updated = _jobs[job.job_id]
    assert updated.status == JobStatus.DONE
    assert updated.itens[0].file_url.startswith("https://cdn.example.com/")
    assert updated.itens[0].storage_path.endswith(".png")
    assert updated.itens[0].signed_url_expires_at == "2026-03-18T12:00:00Z"


def test_download_banner_redirects_to_signed_url():
    client = TestClient(app)
    job_id = "11111111-1111-1111-1111-111111111111"
    fake_job = MagicMock(
        status=JobStatus.DONE,
        file_url="https://cdn.example.com/image.png",
        model_dump=lambda: {},
    )
    with patch("api.app.get_job", return_value=fake_job):
        response = client.get(f"/banners/{job_id}/download", follow_redirects=False)
    assert response.status_code in (302, 307)
    assert response.headers["location"] == "https://cdn.example.com/image.png"


def test_adjust_banner_item_requires_done_item():
    _jobs.clear()
    raw_request = {
        "request_meta": {"canal": "01_feed_instagram", "kv": "pos"},
        "content_keys": {
            "etiqueta": "EXTENSÃO",
            "titulo": "Contrato de Resseguro",
            "frase": "Frase",
            "box1": "TURMA CONFIRMADA",
            "box2": "INÍCIO: 28/04",
            "persona": "advogado lendo contrato",
        },
    }
    job = create_job(GenerationMode.ENXOVAL, raw_request)
    client = TestClient(app)

    response = client.post(
        f"/banners/{job.job_id}/items/{job.itens[0].item_id}/adjust",
        json={"prompt": "Ajustar contraste"},
    )

    assert response.status_code == 409
    assert response.json()["detail"] == "Ajuste só pode ser solicitado para item concluído."


def test_adjust_banner_item_accepts_done_item_during_running_job():
    _jobs.clear()
    raw_request = {
        "request_meta": {"canal": "01_feed_instagram", "kv": "pos"},
        "content_keys": {
            "etiqueta": "EXTENSÃO",
            "titulo": "Contrato de Resseguro",
            "frase": "Frase",
            "box1": "TURMA CONFIRMADA",
            "box2": "INÍCIO: 28/04",
            "persona": "advogado lendo contrato",
        },
    }
    job = create_job(GenerationMode.ENXOVAL, raw_request)
    job.status = JobStatus.RUNNING
    item = job.itens[0]
    item.status = JobItemStatus.DONE
    item.file_url = "/files/fake-item.png"
    client = TestClient(app)

    with patch("api.app.submit_adjustment") as submit_adjustment_mock:
        response = client.post(
            f"/banners/{job.job_id}/items/{item.item_id}/adjust",
            json={"prompt": "Ajustar contraste"},
        )

    assert response.status_code == 202
    assert response.json()["status"] == "accepted"
    submit_adjustment_mock.assert_called_once()

def test_adjust_banner_item_accepts_multipart_prompt_only():
    _jobs.clear()
    raw_request = {
        "request_meta": {"canal": "01_feed_instagram", "kv": "pos"},
        "content_keys": {
            "etiqueta": "EXTENSÃO",
            "titulo": "Contrato de Resseguro",
            "frase": "Frase",
            "box1": "TURMA CONFIRMADA",
            "box2": "INÍCIO: 28/04",
            "persona": "advogado lendo contrato",
        },
    }
    job = create_job(GenerationMode.ENXOVAL, raw_request)
    job.status = JobStatus.RUNNING
    item = job.itens[0]
    item.status = JobItemStatus.DONE
    item.file_url = "/files/fake-item.png"
    client = TestClient(app)

    with patch("api.app.submit_adjustment") as submit_adjustment_mock:
        response = client.post(
            f"/banners/{job.job_id}/items/{item.item_id}/adjust",
            data={"prompt": "Corrigir logotipo sem alterar layout"},
        )

    assert response.status_code == 202
    submit_adjustment_mock.assert_called_once()
    assert submit_adjustment_mock.call_args.args[2] == item.item_id
    assert submit_adjustment_mock.call_args.args[3] == "Corrigir logotipo sem alterar layout"


def test_adjustment_does_not_finalize_job_with_pending_items():
    _jobs.clear()
    raw_request = {
        "request_meta": {"canal": "01_feed_instagram", "kv": "pos"},
        "content_keys": {
            "etiqueta": "EXTENSÃO",
            "titulo": "Contrato de Resseguro",
            "frase": "Frase",
            "box1": "TURMA CONFIRMADA",
            "box2": "INÍCIO: 28/04",
            "persona": "advogado lendo contrato",
        },
    }
    job = create_job(GenerationMode.ENXOVAL, raw_request)
    job.status = JobStatus.RUNNING
    job.itens[0].status = JobItemStatus.DONE
    job.itens[0].file_url = "/files/feed.png"
    job.itens[1].status = JobItemStatus.RUNNING
    job.itens[2].status = JobItemStatus.PENDING
    job.itens[3].status = JobItemStatus.PENDING
    job.itens[4].status = JobItemStatus.PENDING

    job_service_module._update_job_status_after_items(job, 0.0, is_adjustment=True)

    assert job.status == JobStatus.RUNNING

def test_global_throttle_waits_between_starts():
    previous_min = job_service_module._min_seconds_between_pieces
    previous_last = job_service_module._last_piece_started_at_monotonic
    try:
        job_service_module._min_seconds_between_pieces = 3.0
        job_service_module._last_piece_started_at_monotonic = 11.0
        with (
            patch("api.job_service.time.monotonic", side_effect=[12.0, 15.0]),
            patch("api.job_service.time.sleep") as sleep_mock,
        ):
            job_service_module._respect_global_throttle()
        sleep_mock.assert_called_once_with(pytest.approx(2.0))
        assert job_service_module._last_piece_started_at_monotonic == pytest.approx(15.0)
    finally:
        job_service_module._min_seconds_between_pieces = previous_min
        job_service_module._last_piece_started_at_monotonic = previous_last


def test_manual_test_resolve_channels_enxoval_fixed_order():
    channels = resolve_manual_target_channels("enxoval", None)
    assert channels == [
        "01_feed_instagram",
        "03_banner_interno_desktop",
        "04_banner_interno_mobile",
        "05_whatsapp",
        "08_topo_email",
    ]


def test_manual_test_resolve_channels_single_requires_channel():
    with pytest.raises(ValueError):
        resolve_manual_target_channels("peca_unica", "")

if __name__ == "__main__":
    # Rodar teste manualmente se executado como script
    pytest.main([__file__])
