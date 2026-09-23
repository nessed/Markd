"use client";

import React, { createContext, useContext, useMemo, useState } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";

type AstNode = {
  type: string;
  value?: string;
  depth?: number;
  children?: AstNode[];
  data?: { hName?: string; hProperties?: Record<string, string> };
};

export type MarkdownHeading = { id: string; text: string; level: 2 | 3 };

const slug = (text: string) =>
  text
    .toLowerCase()
    .replace(/<[^>]*>/g, "")
    .replace(/\$|\\|\*/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-|-$/g, "") || "section";

/** IDs shared by the renderer and the table of contents. */
export function getMarkdownHeadings(markdown: string): MarkdownHeading[] {
  const used = new Map<string, number>();
  let fence: { marker: string; length: number } | null = null;
  return markdown.split(/\r?\n/).flatMap((line) => {
    const fenceMatch = /^ {0,3}(`{3,}|~{3,})/.exec(line);
    if (fenceMatch) {
      const marker = fenceMatch[1][0];
      if (!fence) fence = { marker, length: fenceMatch[1].length };
      else if (fence.marker === marker && fenceMatch[1].length >= fence.length) fence = null;
      return [];
    }
    if (fence) return [];
    const match = /^ {0,3}(#{2,3})\s+(.+?)\s*#*\s*$/.exec(line);
    if (!match) return [];
    const text = match[2].replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/[*_`~]/g, "");
    const base = slug(text);
    const count = used.get(base) ?? 0;
    used.set(base, count + 1);
    return [{ id: count ? `${base}-${count + 1}` : base, text, level: match[1].length as 2 | 3 }];
  });
}

/** Opens a collapsed section before following a TOC anchor. */
export function openHeadingSection(id: string) {
  const heading = document.getElementById(id);
  const section = heading?.closest("[data-reader-section]");
  if (section && section.getAttribute("data-collapsed") === "true") {
    const button = section.querySelector<HTMLButtonElement>(".md-section-toggle");
    button?.click();
  }
  requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }));
}

function remarkReader(headings: MarkdownHeading[]) {
  return () => (tree: AstNode) => {
    let headingIndex = 0;
    const walk = (node: AstNode) => {
      if (node.type === "heading" && (node.depth === 2 || node.depth === 3)) {
        const match = headings[headingIndex++];
        if (match) node.data = { ...node.data, hProperties: { ...node.data?.hProperties, id: match.id } };
      }

      if (node.type === "blockquote" && node.children?.length) {
        const first = node.children[0];
        const firstText = first.type === "paragraph" ? first.children?.[0] : undefined;
        const match = firstText?.type === "text" && /^\s*\[!([\w-]+)\]\s*/.exec(firstText.value ?? "");
        if (match && firstText) {
          const kind = match[1].toUpperCase();
          firstText.value = (firstText.value ?? "").slice(match[0].length);
          if (!firstText.value) first.children?.shift();
          if (!first.children?.length) node.children.shift();
          node.data = { ...node.data, hProperties: { ...node.data?.hProperties, "data-callout": kind } };
        }
      }

      if (!node.children) return;
      const output: AstNode[] = [];
      for (const child of node.children) {
        if (child.type === "text" && child.value?.includes("==")) {
          const pieces = child.value.split(/(==[^=\n]+==)/g);
          for (const piece of pieces) {
            if (!piece) continue;
            if (piece.startsWith("==") && piece.endsWith("==")) {
              output.push({ type: "mark", data: { hName: "mark" }, children: [{ type: "text", value: piece.slice(2, -2) }] });
            } else output.push({ type: "text", value: piece });
          }
        } else {
          walk(child);
          output.push(child);
        }
      }
      node.children = output;
    };
    walk(tree);

    // Wrap each level-two section so its content can collapse together.
    if (!tree.children) return;
    const sections: AstNode[] = [];
    let current: AstNode | undefined;
    for (const child of tree.children) {
      if (child.type === "heading" && child.depth === 2) {
        current = {
          type: "section",
          data: { hName: "section", hProperties: { "data-reader-section": "", "data-section-id": child.data?.hProperties?.id ?? "" } },
          children: [child],
        };
        sections.push(current);
      } else if (current) current.children?.push(child);
      else sections.push(child);
    }
    tree.children = sections;
  };
}

const callouts: Record<string, { label: string; icon: string; tone: string }> = {
  DEF: { label: "Definition", icon: "◈", tone: "blue" },
  EXAMPLE: { label: "Example", icon: "✦", tone: "green" },
  EXAM: { label: "Exam tip", icon: "✳", tone: "amber" },
  TRAP: { label: "Common mistake", icon: "!", tone: "red" },
  SOURCE: { label: "Source", icon: "↗", tone: "purple" },
  CHECK: { label: "Check yourself", icon: "?", tone: "grey" },
  STEPS: { label: "Step by step", icon: "≡", tone: "teal" },
  ARGUMENT: { label: "Argument", icon: "⇄", tone: "indigo" },
};

function Callout({ kind, children }: { kind: string; children: React.ReactNode }) {
  const [revealed, setRevealed] = useState(false);
  const info = callouts[kind] ?? { label: kind, icon: "•", tone: "grey" };
  return (
    <aside className={`md-callout md-callout-${info.tone}`} data-kind={kind}>
      <div className="md-callout-head">
        <span className="md-callout-icon" aria-hidden="true">{info.icon}</span>
        <span>{info.label}</span>
      </div>
      {kind === "CHECK" && !revealed ? (
        <button className="md-check-button" type="button" onClick={() => setRevealed(true)}>Show</button>
      ) : (
        <div className="md-callout-content">
          {children}
          {kind === "CHECK" && <button className="md-check-button" type="button" onClick={() => setRevealed(false)}>Hide</button>}
        </div>
      )}
    </aside>
  );
}

function CodeBlock({ children }: { children: React.ReactNode }) {
  const code = React.Children.only(children) as React.ReactElement<{ className?: string; children?: React.ReactNode }>;
  const language = /language-([\w+-]+)/.exec(code.props.className ?? "")?.[1];
  const source = String(code.props.children ?? "").replace(/\n$/, "");
  return (
    <div className="md-code-block">
      {language && <span className="md-code-language">{language}</span>}
      <SyntaxHighlighter language={language ?? "text"} useInlineStyles={false} PreTag="pre" CodeTag="code">
        {source}
      </SyntaxHighlighter>
    </div>
  );
}

const ReaderContext = createContext<{
  collapsedSections: Set<string>;
  onToggleSection: (id: string) => void;
  headings: MarkdownHeading[];
}>({ collapsedSections: new Set(), onToggleSection: () => {}, headings: [] });

const readerComponents: Components = {
  section: function Section({ node, children, ...props }) {
    const { collapsedSections, onToggleSection, headings } = useContext(ReaderContext);
    const id = String(node?.properties?.["data-section-id"] ?? "");
    const parts = React.Children.toArray(children);
    const collapsed = collapsedSections.has(id);
    const heading = parts[0];
    return (
      <section {...props} data-reader-section="" data-collapsed={collapsed}>
        {React.isValidElement(heading) ? React.cloneElement(heading as React.ReactElement<{ children?: React.ReactNode }>, {},
          <button className="md-section-toggle" type="button" onClick={() => onToggleSection(id)} aria-expanded={!collapsed} aria-label={`${collapsed ? "Expand" : "Collapse"} ${headings.find((item) => item.id === id)?.text ?? "section"}`}>
            <span className="md-section-chevron" aria-hidden="true">⌄</span>
            {heading.props.children}
          </button>
        ) : heading}
        <div hidden={collapsed}>{parts.slice(1)}</div>
      </section>
    );
  },
  blockquote({ node, children, ...props }) {
    const kind = node?.properties?.["data-callout"];
    return kind ? <Callout kind={String(kind)}>{children}</Callout> : <blockquote {...props}>{children}</blockquote>;
  },
  pre({ children }) { return <CodeBlock>{children}</CodeBlock>; },
  table({ children, ...props }) { return <div className="md-table-scroll" tabIndex={0} role="region" aria-label="Scrollable table"><table {...props}>{children}</table></div>; },
};

export function MarkdownReader({ markdown, collapsedSections, onToggleSection }: {
  markdown: string;
  collapsedSections: Set<string>;
  onToggleSection: (id: string) => void;
}) {
  const headings = useMemo(() => getMarkdownHeadings(markdown), [markdown]);
  const plugins = useMemo(() => [remarkGfm, remarkMath, remarkReader(headings)], [headings]);

  return (
    <ReaderContext.Provider value={{ collapsedSections, onToggleSection, headings }}>
    <article className="markdown-body">
      <ReactMarkdown
        remarkPlugins={plugins}
        rehypePlugins={[rehypeKatex]}
        components={readerComponents}
      >
        {markdown}
      </ReactMarkdown>
    </article>
    </ReaderContext.Provider>
  );
}
