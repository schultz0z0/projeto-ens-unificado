# SLO e observabilidade

| Indicador | SLO mensal | Alerta inicial |
|---|---:|---:|
| Disponibilidade `/health` | 99,9% | 2 falhas consecutivas |
| Disponibilidade `/ready` | 99,5% | indisponível por 2 min |
| Latência REST leitura p95 | <= 500 ms | > 750 ms por 10 min |
| Latência REST mutação p95 | <= 1.000 ms | > 1.500 ms por 10 min |
| Erros 5xx | < 1% | > 2% por 5 min |
| Outbox não publicada | < 15 min | evento pendente > 15 min |

Logs são JSON e contêm correlation ID, rota e status, nunca bearer, delegation token, cookie, senha ou chave. Métricas mínimas: requisições/status, latência, negação de autorização, conflito, replay e idade da outbox.

Ownership: Backend/Plataforma responde por serviço/RLS/outbox; Segurança por delegação/rotação; DevOps por Compose/Traefik/backup; Produto pelo rollout.
