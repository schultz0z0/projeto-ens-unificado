import path from "node:path";

import { PictureError } from "../errors.ts";

const WINDOWS_DRIVE_PATTERN = /^[a-zA-Z]:[/\\]/;

export function normalizeWorkspacePath(value: string): string {
  if (typeof value !== "string") {
    throw new PictureError("picture_workspace_path_invalid", "Workspace path must be a string.");
  }

  const candidate = value.trim();
  if (
    !candidate ||
    candidate.includes("\0") ||
    candidate.includes("\\") ||
    candidate.startsWith("/") ||
    WINDOWS_DRIVE_PATTERN.test(candidate) ||
    path.posix.isAbsolute(candidate)
  ) {
    throw new PictureError("picture_workspace_path_invalid", "Workspace path must be a safe POSIX relative path.");
  }

  const segments = candidate.split("/");
  if (segments.some((segment) => !segment || segment === "." || segment === "..")) {
    throw new PictureError("picture_workspace_path_invalid", "Workspace path contains an unsafe segment.");
  }

  const normalized = path.posix.normalize(candidate);
  if (normalized !== candidate || normalized.startsWith("../")) {
    throw new PictureError("picture_workspace_path_invalid", "Workspace path escapes its workspace.");
  }
  return normalized;
}

export function resolveWorkspacePath(root: string, relativePath: string): string {
  const normalized = normalizeWorkspacePath(relativePath);
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, ...normalized.split("/"));
  const prefix = resolvedRoot.endsWith(path.sep) ? resolvedRoot : `${resolvedRoot}${path.sep}`;
  if (resolved !== resolvedRoot && !resolved.startsWith(prefix)) {
    throw new PictureError("picture_workspace_path_escape", "Workspace path escapes its workspace.");
  }
  return resolved;
}

export function isWorkspacePath(value: string, options: { prefix?: string } = {}): boolean {
  try {
    const normalized = normalizeWorkspacePath(value);
    return options.prefix ? normalized.startsWith(options.prefix) : true;
  } catch {
    return false;
  }
}
