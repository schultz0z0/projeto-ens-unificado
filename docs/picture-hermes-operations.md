# Operação do Picture-Hermes

O Picture-Hermes substitui integralmente o Designer API na página Geração de
Imagem. O chat normal continua usando o gerador padrão do Hermes. O Picture não
possui rota pública: browser → Bridge autenticada → Picture/Artifact Server na
rede Docker interna.

## Estado e retenção

O workspace ativo pertence a `tenant_id + user_id`, guarda a sessão Picture e
sobrevive a reload do browser, reinício do Hermes e restart dos containers. O
fluxo normal é:

`drafting → generating → review → validated → resetting → closed`

- um job `queued/running` por workspace;
- lease expirado pode ser retomado por outro worker sem criar outro job;
- aprovação promove somente a candidata final e cria `validated_works` do tipo
  `peca_visual` de forma idempotente;
- Criar nova peça exige aprovação, apaga chat e artefatos temporários e mantém a
  final promovida;
- `data/designer`, buckets e tabelas legadas não participam do runtime novo e
  devem permanecer preservados até uma decisão de retenção separada.

## Configuração obrigatória

Use a raiz `.env.example` como contrato. Em produção são obrigatórios:

- `NEXUS_SUPABASE_DATABASE_URL` com Session Pooler IPv4;
- `NEXUS_PICTURE_FAL_KEY` real;
- `NEXUS_PICTURE_INTERNAL_KEY` com pelo menos 32 caracteres;
- `NEXUS_PICTURE_DELEGATION_ACTIVE_KID` e
  `NEXUS_PICTURE_DELEGATION_ACTIVE_KEY` com pelo menos 32 caracteres;
- `NEXUS_PICTURE_DELEGATION_REFRESH_KEY` com pelo menos 32 caracteres,
  compartilhada somente entre Bridge e Picture;
- Artifact Server configurado com chave interna, segredo de acesso e URL pública;
- Supabase URL, anon key e service role do app.

O Bridge falha ao iniciar em produção se URL, chaves ou audience/issuer do
Picture estiverem ausentes ou forem placeholders. Nunca exponha `FAL_KEY`,
service role, chave interna ou delegação no frontend, logs ou tickets.

## Saúde e prontidão

`GET /health` do Picture confirma apenas que o processo HTTP está vivo. `GET
/ready` confirma também PostgreSQL e Artifact Server; é o endpoint usado pelo
Compose.

```bash
DC=(docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml)
"${DC[@]}" ps -a
"${DC[@]}" exec -T picture-it curl -fsS http://127.0.0.1:8090/health
"${DC[@]}" exec -T picture-it curl -fsS http://127.0.0.1:8090/ready
"${DC[@]}" exec -T artifact-server node -e "fetch('http://127.0.0.1:8095/health').then(async r=>{console.log(await r.text());process.exit(r.ok?0:1)})"
```

O Picture não deve receber labels Traefik nem porta publicada no host.

## Diagnóstico da fila

No SQL Editor do Supabase, consulte primeiro sem alterar dados:

```sql
select id, workspace_id, kind, status, progress, attempt_count, max_attempts,
       lease_owner, lease_expires_at, error_code, created_at, completed_at
from public.picture_jobs
order by created_at desc
limit 50;

select id, tenant_id, user_id, status, active, current_job_id,
       candidate_artifact_id, validated_artifact_id, validated_work_id,
       version, updated_at
from public.picture_workspaces
order by updated_at desc
limit 50;
```

Um job `running` com lease vencido é recuperado automaticamente enquanto
`attempt_count < max_attempts`. Antes de qualquer intervenção, confira logs e o
estado do Artifact Server:

```bash
"${DC[@]}" logs --since=30m picture-it app-bridge artifact-server hermes-api
"${DC[@]}" restart picture-it
"${DC[@]}" exec -T picture-it curl -fsS http://127.0.0.1:8090/ready
```

Não edite status/lease manualmente como primeira resposta. Guarde `job.id`,
`workspace_id`, `error_code` e o horário para correlação.

## Rotação da delegação

1. Copie o `ACTIVE_KID/KEY` atual para `PREVIOUS_KID/KEY` no `.env`.
2. Gere nova chave aleatória forte e novo `ACTIVE_KID`.
3. Recrie primeiro `picture-it`; valide `/ready`.
4. Recrie `app-bridge`, que passa a assinar com a chave nova.
5. Após expirar o TTL máximo e confirmar os logs, esvazie as duas variáveis
   `PREVIOUS_*` e recrie o Picture.

```bash
"${DC[@]}" up -d --no-deps --force-recreate picture-it
"${DC[@]}" exec -T picture-it curl -fsS http://127.0.0.1:8090/ready
"${DC[@]}" up -d --no-deps --force-recreate app-bridge
```

Nunca altere apenas um lado sem manter a chave anterior na janela de rotação.

O refresh não amplia autoridade: ele só renova um token expirado quando o run
da Bridge continua `running` e usuário, tenant, papel, sessão e workspace ainda
coincidem. A janela padrão é 900 segundos. Um token copiado de outro run ou
workspace é recusado.

## Smoke FAL pago, somente opt-in

Os testes normais usam engine fake e não consomem FAL. Depois de autorização
explícita para uma chamada paga, execute uma geração mínima dentro do container:

```bash
"${DC[@]}" exec -T picture-it sh -lc \
  'bun run index.ts generate --prompt "simple teal gradient, no text" --model flux-schnell --size 256x256 -o /tmp/picture-work/fal-smoke.png'
"${DC[@]}" exec -T picture-it ls -lh /tmp/picture-work/fal-smoke.png
```

Não rode esse comando em CI nem como healthcheck.

## Teste manual do produto

1. Entre como usuário autorizado e abra Geração de Imagem.
2. Confirme chat à esquerda e Arquivos da peça à direita; no mobile abra
   Arquivos pelo drawer.
3. Envie um briefing e, opcionalmente, referências.
4. Confirme nos logs que o Hermes carregou `picture-hermes` e
   `nexusai-ens-design-system`, chamou `picture_get_workspace` e depois
   `picture_start_job` sem `expected array, received object`.
5. Confirme que a resposta e a candidata são uma imagem: nenhum PPTX/slide e
   nenhum emoji ou ícone inventado sem pedido explícito.
6. Durante geração, recarregue a página e confirme o mesmo workspace.
7. Verifique `brief.json`, prompt, plano, steps, overlays, referências,
   intermediários e a candidata final conforme produzidos.
8. Abra previews JSON/texto/imagem e faça download da final.
9. Peça uma revisão; a candidata anterior deve continuar disponível se falhar.
10. Em `review`, aprove a peça; confirme o toast e o status Aprovada.
11. Clique Criar nova peça, leia o aviso completo e cancele; nada deve sumir.
12. Abra novamente e confirme; o chat/pasta antigos somem e surge workspace vazio.
13. Abra Trabalhos Validados, localize a peça visual, valide dimensões, preview e
    download.
14. Confirme que um chat normal ainda oferece o gerador padrão do Hermes e não
    usa o workspace Picture.

## Rollback sem apagar dados

O rollback deve trocar apenas código/imagens. Não reverta migrations aditivas,
não apague `data/artifacts`, `data/hermes`, `data/designer` nem registros
`picture_*`/`validated_works`.

Antes do deploy, marque o commit atual. Para voltar:

```bash
git tag "pre-picture-hermes-$(date +%Y%m%d-%H%M%S)" "$(git rev-parse HEAD)"
# Em um rollback posterior, selecione a tag criada acima:
git tag --list 'pre-picture-hermes-*'
git switch --detach <tag-pre-picture-hermes-YYYYMMDD-HHMMSS>
"${DC[@]}" build
"${DC[@]}" up -d --remove-orphans
```

Depois investigue e retorne ao branch de produção. O `.env` e os dados ficam no
host; as variáveis Picture extras são inofensivas para a versão anterior.
