---
description: |
  Software development workflow skills. Includes the COMPLETE 14-skill superpowers
  package (obra/superpowers, MIT) for software engineering rigor: brainstorming,
  planning, TDD, debugging, code review, subagent delegation, and verification.
  Entry point: using-superpowers (loads the meta-skill that establishes
  how/when to invoke each skill).
---

# Software Development Skills

## Superpowers package (14 skills, MIT, byte-identical to upstream obra/superpowers)

### Process / workflow (6)
- **using-superpowers** (5.9KB) - meta-skill, must load first
- **brainstorming** (10.4KB) - before any creative work
- **writing-plans** (7.1KB) - turn spec into bite-sized tasks
- **executing-plans** (2.6KB) - run a plan in separate session
- **subagent-driven-development** (21.6KB) - dispatch parallel subagents
- **dispatching-parallel-agents** (6.6KB) - 2+ independent tasks

### Quality / verification (4)
- **test-driven-development** (9.9KB) - RED-GREEN-REFACTOR
- **systematic-debugging** (9.9KB) - 4-phase root cause
- **verification-before-completion** (4.2KB) - before claiming done
- **requesting-code-review** (2.8KB) - dispatch reviewer subagent

### Feedback / collaboration (2)
- **receiving-code-review** (6.4KB) - handle review feedback
- **finishing-a-development-branch** (6.8KB) - integrate completed work

### Meta / process support (2)
- **using-git-worktrees** (7.5KB) - isolate feature work
- **writing-skills** (26.9KB) - author new skills

## Backup history
- _backup-pre-superpowers-replace-20260627-143642/ - 4 previous Hermes-adapted skills
  (requesting-code-review, systematic-debugging, test-driven-development, plan)
- _backup-pre-frontend-import-20260627-140942/ - frontend arsenal backup

## Recommended invocation order
1. using-superpowers (always first - establishes context)
2. brainstorming (if creating features)
3. writing-plans (multi-step work)
4. using-git-worktrees (isolate work)
5. test-driven-development + systematic-debugging (during implementation)
6. requesting-code-review (before merge)
7. verification-before-completion (before claiming done)
8. finishing-a-development-branch (merge/PR)
