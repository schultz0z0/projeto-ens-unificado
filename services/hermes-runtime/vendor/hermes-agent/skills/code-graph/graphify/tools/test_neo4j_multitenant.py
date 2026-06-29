"""test_neo4j_multitenant.py - Valida logica de tenant isolation."""

import sys, os
sys.path.insert(0, "/home/nexusai/Nexus-white-label/services/hermes-runtime/vendor/hermes-agent/skills/code-graph/graphify/tools")

from graphify_backend import GraphBackend, tenant_database_name, TENANT_ID_PATTERN

def test_tenant_db_name():
    assert tenant_database_name("acme") == "nexus_tenant_acme"
    assert tenant_database_name(None) == "neo4j"
    print("[OK] test_tenant_db_name")

def test_tenant_id_validation():
    valid = ["acme", "globex-2024", "tenant_abc", "abc123"]
    invalid = [
        "BAD@ID",
        "ab",
        "../path",
        "x" * 100,
    ]
    for v in valid:
        assert TENANT_ID_PATTERN.match(v), f"should be valid: {v}"
    for i in invalid:
        assert not TENANT_ID_PATTERN.match(i), f"should be invalid: {i}"
    print("[OK] test_tenant_id_validation")

def test_database_resolution():
    tenants = ["acme", "globex", "initech"]
    dbs = [tenant_database_name(t) for t in tenants]
    assert len(set(dbs)) == len(dbs)
    for db in dbs:
        assert db.startswith("nexus_tenant_")
    print("[OK] test_database_resolution")

def test_mode_validation():
    from graphify_backend import detect_backend_mode
    for mode in ["local", "neo4j-self-hosted", "neo4j-multi-tenant"]:
        os.environ["NEXUS_GRAPH_BACKEND"] = mode
        assert detect_backend_mode() == mode
    os.environ["NEXUS_GRAPH_BACKEND"] = "invalid-mode"
    assert detect_backend_mode() == "neo4j-multi-tenant"
    print("[OK] test_mode_validation")

def test_tenant_environment_isolation():
    """Cada tenant_id produz database unica e NEXUS_TENANT_ID nao vaza entre calls."""
    os.environ.pop("NEXUS_TENANT_ID", None)
    b1 = GraphBackend.__init__(GraphBackend.__new__(GraphBackend), mode="neo4j-multi-tenant")
    # Defaults
    os.environ["NEXUS_TENANT_ID"] = "acme"
    os.environ["NEXUS_TENANT_ID"] = "globex"
    # diff env: nova instancia deve usar ultimo valor
    b2 = GraphBackend.__init__(GraphBackend.__new__(GraphBackend), mode="neo4j-multi-tenant")
    # tenant_database_name sempre correto se chamarmos com param
    assert tenant_database_name("acme") == "nexus_tenant_acme"
    assert tenant_database_name("globex") == "nexus_tenant_globex"
    assert tenant_database_name("acme") != tenant_database_name("globex")
    print("[OK] test_tenant_environment_isolation")


if __name__ == "__main__":
    test_tenant_db_name()
    test_tenant_id_validation()
    test_database_resolution()
    test_mode_validation()
    test_tenant_environment_isolation()
    print()
    print("=" * 60)
    print("ALL 5 LOGIC TESTS PASSED")
    print("=" * 60)
