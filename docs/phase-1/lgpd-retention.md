# LGPD e retenção

| Dado | Finalidade | Retenção Fase 1 | Exclusão/exportação |
|---|---|---|---|
| Tenant/membership | controle de acesso | vínculo ativo + política contratual | exportável; inativar antes de excluir |
| Campaign/item draft | operação de marketing | enquanto ativo; arquivamento lógico | exportável por tenant |
| Audit event | segurança e prova | sem expurgo automático na Fase 1 | imutável; manager/admin |
| Domain event | integração confiável | até publicação + janela a definir | não excluir antes de publicar |
| Idempotency record | retry seguro | 24 horas no schema atual | job posterior |
| Delegation use | anti-replay | expiração + janela a definir | job posterior |

O serviço minimiza dados: IDs técnicos substituem conteúdo pessoal sempre que possível. `before_state`/`after_state` não recebem tokens, secrets ou anexos brutos. Exportação/exclusão são tenant-scoped e auditadas. Jobs automáticos ficam fora da Fase 1 até aprovação jurídica/compliance.
