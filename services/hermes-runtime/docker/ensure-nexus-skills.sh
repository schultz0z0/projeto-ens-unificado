#!/bin/bash
set -euo pipefail

HERMES_HOME="${HERMES_HOME:-/opt/data}"
SOURCE_ROOT="${NEXUS_MANAGED_SKILLS_DIR:-/opt/nexus-skills}"
MANAGED_SKILLS=(
  "picture-hermes:picture-hermes"
  "marketing-ops-operator:marketing/marketing-ops-operator"
)

install_managed_skill() {
  local profile_home="$1"
  local skill_spec="$2"
  local managed_skill="${skill_spec%%:*}"
  local relative_target="${skill_spec#*:}"
  local skills_root="${profile_home}/skills"
  local source="${SOURCE_ROOT}/${managed_skill}"
  local target="${skills_root}/${relative_target}"
  local target_parent
  target_parent="$(dirname "$target")"
  local temporary="${target_parent}/.${managed_skill}.tmp.$$"

  if [ ! -f "${source}/SKILL.md" ]; then
    echo "[hermes-skills] managed source missing: ${source}/SKILL.md" >&2
    return 1
  fi

  case "$relative_target" in
    "picture-hermes"|"marketing/marketing-ops-operator") ;;
    *) echo "[hermes-skills] refusing unsafe target: $relative_target" >&2; return 1 ;;
  esac

  mkdir -p "$target_parent"
  if [ -d "$target" ] && diff -qr "$source" "$target" >/dev/null 2>&1; then
    return 0
  fi

  rm -rf -- "$temporary"
  cp -R "$source" "$temporary"
  rm -rf -- "$target"
  mv "$temporary" "$target"
  echo "[hermes-skills] installed ${managed_skill} at ${relative_target} in ${profile_home}"
}

remove_stale_managed_skill() {
  local profile_home="$1"
  local skill_spec="$2"
  local managed_skill="${skill_spec%%:*}"
  local relative_target="${skill_spec#*:}"
  local stale_target="${profile_home}/skills/${managed_skill}"

  if [ "$relative_target" = "$managed_skill" ]; then
    return 0
  fi

  case "$stale_target" in
    "$profile_home/skills/marketing-ops-operator") ;;
    *) echo "[hermes-skills] refusing unsafe stale target: $stale_target" >&2; return 1 ;;
  esac

  if [ -e "$stale_target" ]; then
    rm -rf -- "$stale_target"
    echo "[hermes-skills] removed stale ${managed_skill} from ${profile_home}"
  fi
}

for skill_spec in "${MANAGED_SKILLS[@]}"; do
  install_managed_skill "$HERMES_HOME" "$skill_spec"
  remove_stale_managed_skill "$HERMES_HOME" "$skill_spec"
done

if [ -d "$HERMES_HOME/profiles" ]; then
  for profile_home in "$HERMES_HOME"/profiles/*; do
    [ -d "$profile_home" ] || continue
    for skill_spec in "${MANAGED_SKILLS[@]}"; do
      install_managed_skill "$profile_home" "$skill_spec"
      remove_stale_managed_skill "$profile_home" "$skill_spec"
    done
  done
fi
