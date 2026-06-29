"""test_neo4j_multitenant.py - Valida logica multi-tenant + multi-user (v3.8+)."""

import sys, os
sys.path.insert(0, "/home/nexusai/Nexus-white-label/services/hermes-runtime/vendor/hermes-agent/skills/code-graph/graphify/tools")

from graphify_backend import (
    GraphBackend, tenant_database_name, user_database_name,
    TENANT_ID_PATTERN, USER_ID_PATTERN
)


def test_tenant_db_name():
    assert tenant_database_name("acme") == "nexus_tenant_acme"
    assert tenant_database_name(None) == "neo4j"
    print("[OK] test_tenant_db_name")


def test_user_db_name():
    """user_database_name mapeia (tenant, user) -> database privativa."""
    assert user_database_name("acme", "alice") == "nexus_tenant_acme_user_alice"
    assert user_database_name("acme", "alice-2024") == "nexus_tenant_acme_user_alice-2024"
    assert user_database_name("acme", None) == "neo4j"
    assert user_database_name(None, "alice") == "neo4j"
    print("[OK] test_user_db_name")


def test_tenant_id_validation():
    valid = ["acme", "globex-2024", "tenant_abc"]
    invalid = ["BAD@ID", "ab", "x" * 100]
    for v in valid:
        assert TENANT_ID_PATTERN.match(v), f"should be valid: {v}"
    for i in invalid:
        assert not TENANT_ID_PATTERN.match(i), f"should be invalid: {i}"
    print("[OK] test_tenant_id_validation")


def test_user_id_validation():
    """User IDs Supabase UUID formato."""
    valid = ["550e8400-e29b-41d4-a716-446655440000", "alice", "user_abc-123"]
    invalid = ["BAD@ID", "ab", "x" * 200, "user@host"]
    for v in valid:
        assert USER_ID_PATTERN.match(v), f"should be valid: {v}"
    for i in invalid:
        assert not USER_ID_PATTERN.match(i), f"should be invalid: {i}"
    print("[OK] test_user_id_validation")


def test_database_resolution():
    tenants = ["acme", "globex"]
    user_dbs = [user_database_name(t, "alice") for t in tenants]
    tenant_dbs = [tenant_database_name(t) for t in tenants]
    assert len(set(user_dbs)) == 2
    assert len(set(tenant_dbs)) == 2
    # user_dbs NUNCA devem bater com tenant_dbs (isolamento)
    assert set(user_dbs).isdisjoint(set(tenant_dbs)), "user dbs leaked to tenant dbs!"
    print("[OK] test_database_resolution (tenant != user)")


def test_mode_validation():
    """v3.8+: modos validos sao local, neo4j-self-hosted, neo4j-multi-tenant-user."""
    from graphify_backend import detect_backend_mode
    for mode in ["local", "neo4j-self-hosted", "neo4j-multi-tenant-user"]:
        os.environ["NEXUS_GRAPH_BACKEND"] = mode
        assert detect_backend_mode() == mode
    os.environ["NEXUS_GRAPH_BACKEND"] = "invalid-mode"
    assert detect_backend_mode() == "neo4j-multi-tenant-user"
    print("[OK] test_mode_validation")


def test_scope_routing():
    """Mesmo tenant + user tem database diferente dependendo do scope."""
    os.environ["NEXUS_GRAPH_BACKEND"] = "neo4j-multi-tenant-user"
    os.environ.pop("NEXUS_TENANT_ID", None)
    os.environ.pop("NEXUS_USER_ID", None)

    # Tenant scope (compartilhado, sem user_id)
    b_tenant = GraphBackend(tenant_id="acme", scope="tenant")
    assert b_tenant.database == "nexus_tenant_acme"
    assert b_tenant.scope == "tenant"

    # User scope (privado, com user_id)
    b_user_alice = GraphBackend(tenant_id="acme", user_id="alice", scope="user")
    assert b_user_alice.database == "nexus_tenant_acme_user_alice"

    # DIFFERENTES databases (isolamento por design)
    assert b_tenant.database != b_user_alice.database
    print("[OK] test_scope_routing (tenant != user)")


def test_user_env_isolation():
    """Cada user_id produz database UNICA."""
    user_ids = ["alice", "bob", "carol", "user-2024"]
    dbs = [user_database_name("acme", u) for u in user_ids]
    assert len(set(dbs)) == len(set(user_ids))
    for db in dbs:
        assert db.startswith("nexus_tenant_acme_user_")
    print("[OK] test_user_env_isolation")


if __name__ == "__main__":
    test_tenant_db_name()
    test_user_db_name()
    test_tenant_id_validation()
    test_user_id_validation()
    test_database_resolution()
    test_mode_validation()
    test_scope_routing()
    test_user_env_isolation()
    print()
    print("=" * 60)
    print("ALL 8 LOGIC TESTS PASSED (v3.8+ multi-tenant + multi-user)")
    print("=" * 60)
