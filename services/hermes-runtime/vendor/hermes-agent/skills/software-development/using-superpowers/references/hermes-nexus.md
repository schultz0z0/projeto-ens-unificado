# Hermes Agent / Nexus Agent -- Tool Reference

This reference documents how the **Hermes Agent** CLI and the **Nexus Agent** fork
(Soluções Nexus AI white-label of Hermes) expose skills, plugins, and tools to the
agent loop. Use this when running on the Hermes runtime.

## Runtime context

- **Default agent:** `HermesAgent` (in `run_agent.py`)
- **Tool gateway:** OpenAI-compatible function-calling (`toolsets.py`, `model_tools.py`)
- **Loop:** synchronous; max 90 iterations by default (`max_iterations=90`)
- **Concurrency:** single agent + subagents (`delegate_task`)
- **Per-conversation prompt caching:** preserved by injecting skills as user message,
  never mutating the cached system prompt mid-conversation

## Skill invocation (how Hermes triggers skills)

Unlike Claude Code or Codex, Hermes loads skills **on-demand per turn**, not all
upfront. The mechanism is:

1. At turn start, Hermes scans `~/.hermes/skills/` and project skills paths
2. Skill names + descriptions + triggers go into a **user message** (not system prompt)
3. When the user says something matching a trigger, Hermes injects the full
   SKILL.md content into the conversation context for that turn
4. The next turn, the injected content is gone (preserves prompt cache)

**Implication for superpowers users:** the agent sees one skill at a time.
This means `using-superpowers` and each individual skill must be invoked
explicitly by the model via tool calls -- they are not always loaded.

## Tool surface (Hermes core)

| Tool category | Examples |
|---------------|----------|
| File | `read_file`, `write_file`, `patch`, `search_files` |
| Terminal | `terminal` (foreground + background), `process` (manage bg) |
| Code execution | `execute_code` (Python sandbox with hermes_tools) |
| Web | `browser_navigate`, `browser_snapshot`, `browser_click`, `browser_type`, `browser_console`, `browser_vision`, `browser_get_images` |
| Vision | `vision_analyze` (load image into context) |
| Image gen | `image_generate` (FAL.ai backend by default) |
| Search | `web_search`, `x_search` |
| Delegation | `delegate_task` (subagent spawn) |
| Memory | `memory` (persistent cross-session) |
| Cron | `cronjob` (scheduled jobs) |
| Plan | `todo` (todo list) |
| Skills | `skill_view`, `skill_manage`, `skills_list` |
| Clarify | `clarify` (structured user question) |
| Audio | `text_to_speech` |
| Session | `session_search` (past conversation recall) |

**No Claude Code tools:** Hermes does NOT have `Read`/`Edit`/`Bash`/`Glob`/`Grep`
as separate tools. It has unified `read_file`/`patch`/`terminal`/`search_files`.

**No MCP tool discovery at agent level:** MCP servers (e.g. `nexus_rag`) are
configured via `~/.hermes/config.yaml` (or per-profile) and exposed as
service-gated tools (`check_fn`). They appear in the tool list like any other tool.

## Where skills live

Hermes scans these locations for `SKILL.md` files (in priority order):

1. `~/.hermes/skills/<category>/<skill>/SKILL.md` (user-global)
2. `<project>/.hermes/skills/<category>/<skill>/SKILL.md` (project-local)
3. Vendored: `<hermes-install>/skills/<category>/<skill>/SKILL.md` (shipped)

For the Nexus Agent fork at `services/hermes-runtime/vendor/hermes-agent`:
- Vendored skills: `services/hermes-runtime/vendor/hermes-agent/skills/`
- Profile skills: `data/hermes/profiles/<profile>/skills/`
- Runtime data: `data/hermes/`

## Frontmatter schema (Hermes convention)

```yaml
---
name: my-skill                    # required, must match folder name
description: |                     # required, what triggers it
  Multi-line description of what the skill does.
triggers:                          # optional, list of phrases that should invoke
  - "phrase one"
  - "phrase two"
---
```

The `name` field MUST match the folder name. The `description` and `triggers`
fields drive the auto-injection by the model. Tags / version / author are
optional and not used for invocation.

## Plugins vs Skills

Hermes distinguishes:

- **Skills:** pure prompt + behavior. Just a `SKILL.md`. No code.
- **Plugins:** Python packages in `plugins/` that extend the runtime (memory
  backends, model providers, observability, kanban workers, etc). Have
  manifests, may register tools, hooks, or CLI subcommands.

The superpowers package is **skills-only**. No Python code is shipped.

## Subagent delegation

Hermes has `delegate_task` (similar to Claude Code's Task tool). For the
superpowers `subagent-driven-development` skill:

```
delegate_task(
    goal="Implement the auth feature from the plan",
    context="See /tmp/plan.md for the full plan. Use test-driven-development.",
    toolsets=["file", "terminal", "web"]
)
```

The subagent gets its own conversation context. To preserve the system prompt
cache, subagents do NOT inherit your conversation history -- pass context
explicitly.

## The Nexus Agent fork specifics

- Git remote: `https://github.com/schultz0z0/Nexus-agent.git`
- White-label rebrand of NousResearch/hermes-agent
- Same runtime, same API; branding and config defaults differ
- Per AGENTS.md: "narrow waist, capability at the edges" -- prefer skills/
  plugins over core changes
- Backup convention: any destructive skill replacement is preserved at
  `skills/_backup-<reason>-<timestamp>/`

## Common gotchas when running superpowers on Hermes

1. **`patch` tool, not `Edit`** -- superpowers scripts may assume Claude Code's
   `Edit` tool. Translate to Hermes `patch` (mode=replace, requires path +
   old_string + new_string).

2. **`terminal` is foreground-first** -- background tasks return a session_id
   you poll with `process(action="poll")`. Don't use shell `&`.

3. **`browser_navigate` works on desktop GUI Hermes** -- runs in an embedded
   browser tab. Sessions are ephemeral; data does not persist.

4. **`execute_code` runs in a Python sandbox** -- has access to `hermes_tools`
   module which re-exposes the same tools programmatically. Use for loops
   or processing chains that would flood the chat context if done as raw
   tool calls.

5. **Skills cost system-prompt tokens when injected** -- keep SKILL.md files
   short. Hermes Agent's `agent/skill_commands.py` injects the FULL SKILL.md
   content on every trigger match. Long files multiply per-turn cost.

6. **No native `git worktree` helpers** -- `using-git-worktrees` skill provides
   the procedure; you run `git` commands via `terminal`.

## Profile-scoped MCP servers

In the Nexus deployment, MCP servers (including `nexus_rag`) are configured
in `data/hermes/config.yaml` and inherited by every profile under
`data/hermes/profiles/<profile>/`. The `hermes-api` and `hermes-kanban`
containers re-apply the `nexus_rag` block on start without overwriting
existing profile settings -- sessions, memory, and skills are preserved.

## See also

- `using-superpowers/SKILL.md` -- meta-skill, load first
- `references/claude-code-tools.md`, `codex-tools.md`, etc -- translations for
  other agents; this file fills the gap for Hermes specifically
