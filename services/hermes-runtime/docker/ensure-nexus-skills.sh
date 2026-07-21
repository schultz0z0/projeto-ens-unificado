#!/bin/bash
set -euo pipefail

HERMES_HOME="${HERMES_HOME:-/opt/data}"
SOURCE_ROOT="${NEXUS_MANAGED_SKILLS_DIR:-/opt/nexus-skills}"
MANAGED_SKILL="picture-hermes"

install_managed_skill() {
  local profile_home="$1"
  local skills_root="${profile_home}/skills"
  local source="${SOURCE_ROOT}/${MANAGED_SKILL}"
  local target="${skills_root}/${MANAGED_SKILL}"
  local temporary="${skills_root}/.${MANAGED_SKILL}.tmp.$$"

  if [ ! -f "${source}/SKILL.md" ]; then
    echo "[hermes-skills] managed source missing: ${source}/SKILL.md" >&2
    return 1
  fi

  mkdir -p "$skills_root"
  if [ -d "$target" ] && diff -qr "$source" "$target" >/dev/null 2>&1; then
    return 0
  fi

  case "$target" in
    "$skills_root/$MANAGED_SKILL") ;;
    *) echo "[hermes-skills] refusing unsafe target: $target" >&2; return 1 ;;
  esac

  rm -rf -- "$temporary"
  cp -R "$source" "$temporary"
  rm -rf -- "$target"
  mv "$temporary" "$target"
  echo "[hermes-skills] installed ${MANAGED_SKILL} in ${profile_home}"
}

install_managed_skill "$HERMES_HOME"

if [ -d "$HERMES_HOME/profiles" ]; then
  for profile_home in "$HERMES_HOME"/profiles/*; do
    [ -d "$profile_home" ] || continue
    install_managed_skill "$profile_home"
  done
fi
