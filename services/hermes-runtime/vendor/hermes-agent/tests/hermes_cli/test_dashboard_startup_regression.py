import ast
from pathlib import Path


WEB_SERVER = Path(__file__).resolve().parents[2] / "hermes_cli" / "web_server.py"


def _call_name(node: ast.AST) -> str:
    if isinstance(node, ast.Name):
        return node.id
    if isinstance(node, ast.Attribute):
        return f"{_call_name(node.value)}.{node.attr}"
    return ""


def _is_asyncio_run_serve(node: ast.AST) -> bool:
    if not isinstance(node, ast.Expr) or not isinstance(node.value, ast.Call):
        return False
    call = node.value
    if _call_name(call.func) != "asyncio.run" or len(call.args) != 1:
        return False
    arg = call.args[0]
    return isinstance(arg, ast.Call) and _call_name(arg.func) == "_serve"


def _function(tree: ast.Module, name: str) -> ast.FunctionDef | ast.AsyncFunctionDef:
    for node in tree.body:
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name == name:
            return node
    raise AssertionError(f"{name} not found")


def test_dashboard_start_server_invokes_serve_at_function_tail():
    tree = ast.parse(WEB_SERVER.read_text(encoding="utf-8"))
    start_server = _function(tree, "start_server")
    drain_approvals = _function(tree, "_drain_approvals_ws")

    assert any(_is_asyncio_run_serve(node) for node in start_server.body)
    assert not any(_is_asyncio_run_serve(node) for node in ast.walk(drain_approvals))
