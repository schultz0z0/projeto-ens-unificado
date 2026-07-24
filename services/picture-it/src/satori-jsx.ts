import type { SatoriJSX } from "./types.ts";

// Convert our JSON JSX tree to React-like elements for Satori
export function jsxToReact(node: SatoriJSX | string | number): any {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);

  const { tag, props = {}, children = [] } = node;
  const childElements = children.map((c) => jsxToReact(c));

  return {
    type: tag,
    props: {
      ...props,
      children: childElements.length === 1 ? childElements[0] : childElements.length > 0 ? childElements : undefined,
    },
  };
}
