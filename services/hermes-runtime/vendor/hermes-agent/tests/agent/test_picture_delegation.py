from agent.picture_delegation import bind_current_picture_delegation


def test_current_picture_delegation_overrides_model_placeholder():
    prompt = """[PICTURE_DELEGATION]
delegation_token: header.current-signature-that-is-long-enough
[/PICTURE_DELEGATION]"""
    args = bind_current_picture_delegation(
        "mcp_nexus_picture_picture_start_job",
        {"delegation_token": "[REDACTED]", "workspace_id": "workspace"},
        prompt,
    )
    assert args["delegation_token"] == "header.current-signature-that-is-long-enough"


def test_picture_delegation_does_not_touch_other_tools():
    args = {"delegation_token": "original"}
    assert bind_current_picture_delegation("memory", args, "") is args
