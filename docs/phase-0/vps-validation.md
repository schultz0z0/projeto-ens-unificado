# Validação VPS Linux — Fase 0

## Status

- **Estado:** `pending_user_deploy`
- **Execução:** somente depois que o usuário enviar o commit validado e atualizar a VPS
- **Responsável pelo push/deploy:** usuário
- **Responsável pelo roteiro de validação:** Codex com o usuário

## Pré-condições

- commit da Fase 0 revisado localmente;
- push realizado pelo usuário;
- backup confirmado;
- `.env` preservado e não impresso;
- acesso à VPS autorizado;
- janela de validação definida.

## Checklist não destrutivo

- [ ] Confirmar commit implantado.
- [ ] Executar validação do Compose com os dois arquivos.
- [ ] Confirmar serviços, health checks e dependências.
- [ ] Validar volumes e permissões Linux.
- [ ] Confirmar redes e portas locais.
- [ ] Validar DNS, TLS e rotas Traefik públicas.
- [ ] Confirmar que RAG e Graph continuam internos.
- [ ] Verificar logs sem secrets.
- [ ] Reiniciar serviços selecionados e conferir persistência.
- [ ] Executar smoke tests com dados de teste.
- [ ] Confirmar backup e caminho de rollback.
- [ ] Registrar divergências entre repositório e produção.

## Resultado

Ainda não executado. A Fase 0 não pode receber status `completed` até este documento registrar comandos, saídas resumidas, horário, commit e aceite.
