import type { Editor } from "@tiptap/react";
import { NodeSelection } from "@tiptap/pm/state";
import type { Node as TiptapNode } from "@tiptap/pm/model";

export const MAX_FILE_SIZE = 5 * 1024 * 1024;

export const MAC_SYMBOLS: Record<string, string> = {
  mod: "⌘",
  ctrl: "⌘",
  alt: "⌥",
  shift: "⇧",
  backspace: "Del",
} as const;

export function cn(
  ...classes: (string | boolean | undefined | null)[]
): string {
  return classes.filter(Boolean).join(" ");
}

export function isMac(): boolean {
  return (
    typeof navigator !== "undefined" &&
    navigator.platform.toLowerCase().includes("mac")
  );
}

export const formatShortcutKey = (
  key: string,
  isMac: boolean,
  capitalize: boolean = true
) => {
  if (isMac) {
    const lowerKey = key.toLowerCase();
    return MAC_SYMBOLS[lowerKey] || (capitalize ? key.toUpperCase() : key);
  }

  return capitalize ? key.charAt(0).toUpperCase() + key.slice(1) : key;
};

export const parseShortcutKeys = (props: {
  shortcutKeys: string | undefined;
  delimiter?: string;
  capitalize?: boolean;
}) => {
  const { shortcutKeys, delimiter = "+", capitalize = true } = props;

  if (!shortcutKeys) return [];

  return shortcutKeys
    .split(delimiter)
    .map((key) => key.trim())
    .map((key) => formatShortcutKey(key, isMac(), capitalize));
};

export const isMarkInSchema = (
  markName: string,
  editor: Editor | null
): boolean => {
  if (!editor?.schema) return false;
  return editor.schema.spec.marks.get(markName) !== undefined;
};

export const isNodeInSchema = (
  nodeName: string,
  editor: Editor | null
): boolean => {
  if (!editor?.schema) return false;
  return editor.schema.spec.nodes.get(nodeName) !== undefined;
};

export function isValidPosition(pos: number | null | undefined): pos is number {
  return typeof pos === "number" && pos >= 0;
}

export function isExtensionAvailable(
  editor: Editor | null,
  extensionNames: string | string[]
): boolean {
  if (!editor) return false;

  const names = Array.isArray(extensionNames)
    ? extensionNames
    : [extensionNames];

  const found = names.some((name) =>
    editor.extensionManager.extensions.some((ext) => ext.name === name)
  );

  if (!found) {
    console.warn(
      `None of the extensions [${names.join(
        ", "
      )}] were found in the editor schema. Ensure they are included in the editor configuration.`
    );
  }

  return found;
}

export function findNodeAtPosition(editor: Editor, position: number) {
  try {
    const node = editor.state.doc.nodeAt(position);
    if (!node) {
      console.warn(`No node found at position ${position}`);
      return null;
    }
    return node;
  } catch (error) {
    console.error(`Error getting node at position ${position}:`, error);
    return null;
  }
}

export function findNodePosition(props: {
  editor: Editor | null;
  node?: TiptapNode | null;
  nodePos?: number | null;
}): { pos: number; node: TiptapNode } | null {
  const { editor, node, nodePos } = props;

  if (!editor || !editor.state?.doc) return null;

  const hasValidNode = node !== undefined && node !== null;
  const hasValidPos = isValidPosition(nodePos);

  if (!hasValidNode && !hasValidPos) {
    return null;
  }

  if (hasValidNode) {
    let foundPos = -1;
    let foundNode: TiptapNode | null = null;

    editor.state.doc.descendants((currentNode, pos) => {
      if (currentNode === node) {
        foundPos = pos;
        foundNode = currentNode;
        return false;
      }
      return true;
    });

    if (foundPos !== -1 && foundNode !== null) {
      return { pos: foundPos, node: foundNode };
    }
  }

  if (hasValidPos) {
    const nodeAtPos = findNodeAtPosition(editor, nodePos!);
    if (nodeAtPos) {
      return { pos: nodePos!, node: nodeAtPos };
    }
  }

  return null;
}

export function isNodeTypeSelected(
  editor: Editor,
  types: string[] = []
): boolean {
  if (!editor || !editor.state.selection) return false;

  const { state } = editor;
  const { doc, selection } = state;

  if (selection.empty) return false;

  if (selection instanceof NodeSelection) {
    const node = doc.nodeAt(selection.from);
    return node ? types.includes(node.type.name) : false;
  }

  return false;
}

export const handleImageUpload = async (
  file: File,
  onProgress?: (event: { progress: number }) => void,
  abortSignal?: AbortSignal
): Promise<string> => {
  if (!file) {
    throw new Error("No file provided");
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error(
      `File size exceeds maximum allowed (${MAX_FILE_SIZE / (1024 * 1024)}MB)`
    );
  }

  for (let progress = 0; progress <= 100; progress += 10) {
    if (abortSignal?.aborted) {
      throw new Error("Upload cancelled");
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
    onProgress?.({ progress });
  }

  return "/images/tiptap-ui-placeholder-image.jpg";
};

type ProtocolOptions = {
  scheme: string;
  optionalSlashes?: boolean;
};

type ProtocolConfig = Array<ProtocolOptions | string>;

const ATTR_WHITESPACE =
  /[\u0000-\u0020\u00A0\u1680\u180E\u2000-\u2029\u205F\u3000]/g;

export function isAllowedUri(
  uri: string | undefined,
  protocols?: ProtocolConfig
) {
  const allowedProtocols: string[] = [
    "http",
    "https",
    "ftp",
    "ftps",
    "mailto",
    "tel",
    "callto",
    "sms",
    "cid",
    "xmpp",
  ];

  if (protocols) {
    protocols.forEach((protocol) => {
      const nextProtocol =
        typeof protocol === "string" ? protocol : protocol.scheme;

      if (nextProtocol) {
        allowedProtocols.push(nextProtocol);
      }
    });
  }

  return (
    !uri ||
    uri
      .replace(ATTR_WHITESPACE, "")
      .match(
        new RegExp(
          `^(?:(?:${allowedProtocols.join(
            "|"
          )}):|[^a-z]|[a-z0-9+.\-]+(?:[^a-z+.\-:]|$))`,
          "i"
        )
      )
  );
}

export function sanitizeUrl(
  inputUrl: string,
  baseUrl: string,
  protocols?: ProtocolConfig
): string {
  const url = new URL(inputUrl, baseUrl);

  if (isAllowedUri(url.href, protocols)) {
    return url.href;
  }
  return "#";
}
