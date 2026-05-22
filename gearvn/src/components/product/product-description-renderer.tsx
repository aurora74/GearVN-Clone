import DOMPurify from "isomorphic-dompurify";

type ProductDescriptionRendererProps = {
  description?: string | null;
  fallback?: string;
  className?: string;
};

const EDITOR_HTML_TAG_PATTERN =
  /<\/?(p|h[1-6]|div|section|article|ul|ol|li|table|thead|tbody|tr|td|th|blockquote|pre|code|strong|em|b|i|u|a|img|br|figure|figcaption|span)\b[^>]*>/i;
const HEADING_PATTERN = /^(#{2,6})\s+(.+)$/;
const BULLET_PATTERN = /^\s*(?:[-*+•]|(?:\d+\.))\s+(.+)$/;
const MAX_HEADING_TITLE_LENGTH = 90;
const MIN_HEADING_TITLE_LENGTH = 12;

const sanitizeEditorHtml = (description: string) =>
  DOMPurify.sanitize(description, {
    USE_PROFILES: { html: true },
    ADD_TAGS: [],
    ADD_ATTR: [],
  });

const normalizeLine = (line: string) => line.replace(/\s+/g, " ").trim();

const preparePlainDescription = (description: string) =>
  description
    .replace(/\r\n?/g, "\n")
    .replace(/([^\n])\s+(#{2,6})\s+/g, "$1\n$2 ");

const splitHeadingText = (text: string) => {
  const normalizedText = normalizeLine(text);

  const splitAt = (index: number) => ({
    title: normalizeLine(normalizedText.slice(0, index).replace(/[.:：-]+$/, "")),
    remainder: normalizeLine(normalizedText.slice(index)),
  });

  const boundaryMatches = [
    normalizedText.match(/\s+Nội dung chính\b/i),
    normalizedText.match(/\s+\d+\.\s+/),
  ].filter((match): match is RegExpMatchArray => Boolean(match?.index));

  const boundary = boundaryMatches
    .map((match) => match.index ?? -1)
    .filter((index) => index >= MIN_HEADING_TITLE_LENGTH)
    .sort((a, b) => a - b)[0];

  if (boundary) {
    return splitAt(boundary);
  }

  const punctuation = normalizedText.match(/[.!?。！？:：]\s+/);
  if (
    punctuation?.index &&
    punctuation.index >= MIN_HEADING_TITLE_LENGTH &&
    punctuation.index + punctuation[0].length < normalizedText.length
  ) {
    return splitAt(punctuation.index + 1);
  }

  if (normalizedText.length <= MAX_HEADING_TITLE_LENGTH) {
    return { title: normalizedText, remainder: "" };
  }

  const cappedTitle = normalizedText.slice(0, MAX_HEADING_TITLE_LENGTH);
  const splitIndex = cappedTitle.lastIndexOf(" ");

  if (splitIndex >= MIN_HEADING_TITLE_LENGTH) {
    return splitAt(splitIndex);
  }

  return {
    title: normalizedText.slice(0, MAX_HEADING_TITLE_LENGTH),
    remainder: normalizeLine(normalizedText.slice(MAX_HEADING_TITLE_LENGTH)),
  };
};

type TextBlock =
  | { type: "heading"; level: 2 | 3; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] };

const parsePlainDescription = (description: string): TextBlock[] => {
  const blocks: TextBlock[] = [];
  const seen = new Set<string>();
  let paragraphLines: string[] = [];
  let listItems: string[] = [];

  const pushParagraph = () => {
    const text = normalizeLine(paragraphLines.join(" "));
    paragraphLines = [];
    if (!text || seen.has(text)) return;
    seen.add(text);
    blocks.push({ type: "paragraph", text });
  };

  const pushList = () => {
    const uniqueItems = listItems.filter((item) => {
      if (seen.has(item)) return false;
      seen.add(item);
      return true;
    });
    listItems = [];
    if (uniqueItems.length) blocks.push({ type: "list", items: uniqueItems });
  };

  preparePlainDescription(description)
    .split("\n")
    .forEach((rawLine) => {
      const line = normalizeLine(rawLine);

      if (!line) {
        pushParagraph();
        pushList();
        return;
      }

      const headingMatch = line.match(HEADING_PATTERN);
      if (headingMatch) {
        pushParagraph();
        pushList();
        const { title, remainder } = splitHeadingText(headingMatch[2]);
        if (title && !seen.has(title)) {
          seen.add(title);
          blocks.push({
            type: "heading",
            level: headingMatch[1].length === 2 ? 2 : 3,
            text: title,
          });
        }
        if (remainder) paragraphLines.push(remainder);
        return;
      }

      const bulletMatch = line.match(BULLET_PATTERN);
      if (bulletMatch) {
        pushParagraph();
        const item = normalizeLine(bulletMatch[1]);
        if (item) listItems.push(item);
        return;
      }

      pushList();
      paragraphLines.push(line);
    });

  pushParagraph();
  pushList();

  return blocks;
};

export function ProductDescriptionRenderer({
  description,
  fallback = "Không có mô tả",
  className = "description",
}: ProductDescriptionRendererProps) {
  const content = description?.trim();

  if (!content) {
    return <p className="text-gray-500 italic">{fallback}</p>;
  }

  if (EDITOR_HTML_TAG_PATTERN.test(content)) {
    return (
      <div
        className={className}
        dangerouslySetInnerHTML={{ __html: sanitizeEditorHtml(content) }}
      />
    );
  }

  const blocks = parsePlainDescription(content);

  if (!blocks.length) {
    return <p className="text-gray-500 italic">{fallback}</p>;
  }

  return (
    <div className={className}>
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          const HeadingTag = block.level === 2 ? "h2" : "h3";
          return <HeadingTag key={`${block.text}-${index}`}>{block.text}</HeadingTag>;
        }

        if (block.type === "list") {
          return (
            <ul
              key={`list-${index}`}
              className="list-disc space-y-1 pl-5 marker:text-gray-500"
            >
              {block.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          );
        }

        return <p key={`${block.text}-${index}`}>{block.text}</p>;
      })}
    </div>
  );
}
