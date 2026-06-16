# Transição monorepo — notas de segurança

## Originais são backup

A transição foi feita por cópia para:

```text
D:/Projetos SaaS/projeto-ens-unificado
```

Os projetos originais ficaram em:

```text
D:/Projetos SaaS/PROJETO ENS
```

Não foram modificados.

## Git desvinculado

Na cópia unificada, nenhum `.git` interno foi preservado. Isso evita sub-repositórios acidentais dentro do monorepo.

Quando a estrutura local estiver validada, inicializar um Git único na raiz:

```bash
cd "D:/Projetos SaaS/projeto-ens-unificado"
git init
git add .
git commit -m "chore: initialize Projeto ENS monorepo"
```

Antes disso, revisar `.env`, `data/` e `.gitignore`.

## O que não foi copiado

Foram excluídos artefatos pesados/sensíveis:

- `.git/`
- `.env` real
- `node_modules/`
- `dist/`, `build/`, `.next/`, `.turbo/`
- `.venv/`, `venv/`, `__pycache__/`
- `data/`, `logs/`, `outputs/`, `tmp/`, `temp/`

`.env.example` e arquivos de código/configuração foram preservados.

## Primeiro teste local recomendado

1. Preencher `.env` com os valores reais.
2. Rodar:

```bash
bash scripts/bootstrap.sh
bash scripts/validate.sh
```

3. Só depois:

```bash
docker compose --env-file .env up -d --build
```
