#!/bin/bash
set -euo pipefail

HERMES_HOME="${HERMES_HOME:-/opt/data}"
SOURCE_ROOT="${NEXUS_MANAGED_SKILLS_DIR:-/opt/nexus-skills}"
MANAGED_SKILLS=("picture-hermes" "marketing-ops-operator")

install_managed_skill() {
  local profile_home="$1"
  local managed_skill="$2"
  local skills_root="${profile_home}/skills"
  local source="${SOURCE_ROOT}/${managed_skill}"
  local target="${skills_root}/${managed_skill}"
  local temporary="${skills_root}/.${managed_skill}.tmp.$$"

  if [ ! -f "${source}/SKILL.md" ]; then
    echo "[hermes-skills] managed source missing: ${source}/SKILL.md" >&2
    return 1
  fi

  mkdir -p "$skills_root"
  if [ -d "$target" ] && diff -qr "$source" "$target" >/dev/null 2>&1; then
    return 0
  fi

  case "$target" in
    "$skills_root/$managed_skill") ;;
    *) echo "[hermes-skills] refusing unsafe target: $target" >&2; return 1 ;;
  esac

  rm -rf -- "$temporary"
  cp -R "$source" "$temporary"
  rm -rf -- "$target"
  mv "$temporary" "$target"
  echo "[hermes-skills] installed ${managed_skill} in ${profile_home}"
}

for managed_skill in "${MANAGED_SKILLS[@]}"; do
  install_managed_skill "$HERMES_HOME" "$managed_skill"
done

if [ -d "$HERMES_HOME/profiles" ]; then
  for profile_home in "$HERMES_HOME"/profiles/*; do
    [ -d "$profile_home" ] || continue
    for managed_skill in "${MANAGED_SKILLS[@]}"; do
      install_managed_skill "$profile_home" "$managed_skill"
    done
  done
fi
