import json
import warnings
from pathlib import Path


TEMPLATES_LIBRARY_DIR = Path(__file__).resolve().parents[1] / "templates_library"
HOMOLOGATED_TEMPLATE_SPECS = {
    "01_feed_instagram/pos": {
        "logos": ["ENS"],
        "must_preserve": [
            "logo_ens_assinatura",
            "rodape",
            "degrade_principal",
            "overlays_organicos",
        ],
    },
    "05_whatsapp/pos": {
        "logos": ["ENS"],
        "must_preserve": [
            "logo_ens_assinatura",
            "rodape",
            "degrade_principal",
            "overlays_organicos",
        ],
    },
    "05_AIDA_whatsapp/pos": {
        "logos": ["ENS", "AIDA_BRASIL"],
        "must_preserve": [
            "logo_ens_assinatura",
            "logo_aida_brasil",
            "rodape",
            "degrade_principal",
            "overlays_organicos",
        ],
    },
    "08_topo_email/graduacao": {
        "logos": ["ENS"],
        "must_preserve": [
            "logo_ens_assinatura",
            "rodape",
            "degrade_principal",
            "overlays_organicos",
        ],
    },
}
ENS_ONLY_TEMPLATE_EXPECTATIONS = [
    "01_feed_instagram/pos",
    "02_story_instagram/pos",
    "03_banner_interno_desktop/pos",
    "04_banner_interno_mobile/pos",
    "05_whatsapp/pos",
    "08_topo_email/pos",
    "08_topo_email/graduacao",
]


def test_graduacao_topo_email_is_homologated():
    assert "08_topo_email/graduacao" in HOMOLOGATED_TEMPLATE_SPECS


def test_all_graduacao_templates_have_context_and_planner_payloads():
    missing: list[str] = []

    for template_dir in sorted(TEMPLATES_LIBRARY_DIR.glob("*/graduacao")):
        template_key = str(template_dir.relative_to(TEMPLATES_LIBRARY_DIR)).replace("\\", "/")
        context_path = template_dir / "template_context.json"
        if not context_path.exists():
            missing.append(f"{template_key}: template_context.json ausente")
            continue

        context = _load_json(context_path)
        expected_template_id = context.get("meta", {}).get("template_id")
        if expected_template_id != template_key:
            missing.append(f"{template_key}: meta.template_id inválido")

        planner_dir = template_dir / "planner_payloads"
        for file_name in (
            "context_json_padrao.json",
            "step1_planner_payload.json",
            "step2_planner_payload.json",
            "step3_planner_payload.json",
        ):
            if not (planner_dir / file_name).exists():
                missing.append(f"{template_key}: {file_name} ausente")

    assert not missing, "Templates de graduacao incompletos:\n- " + "\n- ".join(missing)


def _load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def _discover_templates_with_planner_payloads() -> list[Path]:
    discovered: list[Path] = []
    for planner_dir in TEMPLATES_LIBRARY_DIR.rglob("planner_payloads"):
        template_dir = planner_dir.parent
        if (template_dir / "template_context.json").exists():
            discovered.append(template_dir)
    return sorted(discovered)


def _validate_template_payloads(template_relative_path: Path) -> list[str]:
    planner_dir = template_relative_path / "planner_payloads"
    context_default = _load_json(planner_dir / "context_json_padrao.json")
    step1 = _load_json(planner_dir / "step1_planner_payload.json")
    step2 = _load_json(planner_dir / "step2_planner_payload.json")
    step3 = _load_json(planner_dir / "step3_planner_payload.json")
    context = _load_json(template_relative_path / "template_context.json")

    errors: list[str] = []
    template_key = str(template_relative_path.relative_to(TEMPLATES_LIBRARY_DIR)).replace("\\", "/")

    step_payloads = [step1, step2, step3]
    expected_template_id = context.get("meta", {}).get("template_id")
    if not expected_template_id:
        errors.append("template_context sem meta.template_id.")
        return errors

    if context_default.get("meta", {}).get("template_id") != expected_template_id:
        errors.append("context_json_padrao.meta.template_id diverge de template_context.meta.template_id.")

    for idx, payload in enumerate(step_payloads, start=1):
        if payload.get("template_id") != expected_template_id:
            errors.append(f"step{idx}_planner_payload.template_id diverge de template_context.meta.template_id.")

    baseline_hard_locks = context_default.get("hard_locks")
    if not isinstance(baseline_hard_locks, dict):
        errors.append("context_json_padrao.hard_locks ausente ou inválido.")
        return errors

    for idx, payload in enumerate(step_payloads, start=1):
        step_hard_locks = payload.get("context_json_compacto", {}).get("hard_locks")
        if not isinstance(step_hard_locks, dict):
            errors.append(f"step{idx}_planner_payload.context_json_compacto.hard_locks ausente ou inválido.")
            continue
        if step_hard_locks.get("logos") != baseline_hard_locks.get("logos"):
            errors.append(f"step{idx}: hard_locks.logos diverge de context_json_padrao.")
        if step_hard_locks.get("must_preserve") != baseline_hard_locks.get("must_preserve"):
            errors.append(f"step{idx}: hard_locks.must_preserve diverge de context_json_padrao.")

    homologated_spec = HOMOLOGATED_TEMPLATE_SPECS.get(template_key)
    if homologated_spec:
        if baseline_hard_locks.get("logos") != homologated_spec["logos"]:
            errors.append("hard_locks.logos não bate com spec homologada.")
        if baseline_hard_locks.get("must_preserve") != homologated_spec["must_preserve"]:
            errors.append("hard_locks.must_preserve não bate com spec homologada.")

    return errors


def test_global_template_planner_payload_consistency():
    templates = _discover_templates_with_planner_payloads()
    assert templates, "Nenhum template com planner_payloads foi encontrado."

    pass_templates: list[str] = []
    pending_known: list[str] = []
    fail_homologated: list[str] = []

    for template_dir in templates:
        template_key = str(template_dir.relative_to(TEMPLATES_LIBRARY_DIR)).replace("\\", "/")
        errors = _validate_template_payloads(template_dir)
        if not errors:
            pass_templates.append(template_key)
            continue

        if template_key in HOMOLOGATED_TEMPLATE_SPECS:
            fail_homologated.append(f"{template_key}: {' | '.join(errors)}")
        else:
            pending_known.append(f"{template_key}: {' | '.join(errors)}")

    missing_homologated = sorted(set(HOMOLOGATED_TEMPLATE_SPECS.keys()) - {str(p.relative_to(TEMPLATES_LIBRARY_DIR)).replace('\\', '/') for p in templates})
    if missing_homologated:
        fail_homologated.append(f"Templates homologados sem planner_payloads: {', '.join(missing_homologated)}")

    if pending_known:
        warnings.warn(
            "Templates com inconsistência em modo pendente conhecido (não bloqueante):\n- "
            + "\n- ".join(pending_known),
            stacklevel=1,
        )

    assert not fail_homologated, (
        "Falhas em templates homologados:\n- "
        + "\n- ".join(fail_homologated)
        + "\n\nTemplates PASS:\n- "
        + ("\n- ".join(sorted(pass_templates)) if pass_templates else "(nenhum)")
    )


def test_expected_ens_only_templates_have_ens_lock_profile():
    expected_logos = ["ENS"]
    expected_must_preserve = [
        "logo_ens_assinatura",
        "rodape",
        "degrade_principal",
        "overlays_organicos",
    ]

    for template_key in ENS_ONLY_TEMPLATE_EXPECTATIONS:
        template_dir = TEMPLATES_LIBRARY_DIR / Path(template_key)
        planner_dir = template_dir / "planner_payloads"
        assert planner_dir.exists(), f"{template_key} sem planner_payloads."
        context_default = _load_json(planner_dir / "context_json_padrao.json")
        step1 = _load_json(planner_dir / "step1_planner_payload.json")
        step2 = _load_json(planner_dir / "step2_planner_payload.json")
        step3 = _load_json(planner_dir / "step3_planner_payload.json")

        payloads = [context_default, step1, step2, step3]
        for payload in payloads:
            hard_locks = payload["hard_locks"] if "hard_locks" in payload else payload["context_json_compacto"]["hard_locks"]
            assert hard_locks["logos"] == expected_logos, f"{template_key} possui logos inconsistentes."
            assert hard_locks["must_preserve"] == expected_must_preserve, f"{template_key} possui must_preserve inconsistente."
