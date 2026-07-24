import type { SatoriJSX } from "./types.ts";

// Convert our JSON JSX tree to React-like elements for Satori
export function jsxToReact(node: SatoriJSX | string | number | any): any {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (!node || typeof node !== "object") return String(node ?? "");

  const { tag = "div", props = {}, children = [], ...rest } = node;
  const mergedProps = { ...(props && typeof props === "object" ? props : {}), ...rest };
  const rawChildren = Array.isArray(children) ? children : children !== undefined ? [children] : [];
  const childElements = rawChildren.map((c) => jsxToReact(c));

  return {
    type: tag,
    props: {
      ...mergedProps,
      children: childElements.length === 1 ? childElements[0] : childElements.length > 0 ? childElements : undefined,
    },
  };
}
