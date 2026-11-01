import ts from "typescript";
import { ALLOWED_PHRASES, BANNED_TERMS } from "./banned-terms";

export interface ClaimHit {
  file: string;
  line: number;
  term: string;
  text: string;
}

export interface TextChunk {
  text: string;
  line: number;
}

// JSX attributes whose values are shown to (or read out to) the user.
const USER_VISIBLE_ATTRS = new Set(["alt", "title", "aria-label", "placeholder", "aria-description"]);

const bannedPatterns = BANNED_TERMS.map((src) => ({
  src,
  re: new RegExp(`(?<![\\w-])(?:${src})(?![\\w-])`, "i"),
}));

function stripAllowed(text: string): string {
  let out = text;
  for (const phrase of ALLOWED_PHRASES) {
    out = out.replace(new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), " ");
  }
  return out;
}

/** Returns the banned terms (as their pattern source) found in `text`. */
export function findBannedTerms(text: string): string[] {
  const cleaned = stripAllowed(text);
  return bannedPatterns.filter((p) => p.re.test(cleaned)).map((p) => p.src);
}

function lineOf(sf: ts.SourceFile, pos: number): number {
  return sf.getLineAndCharacterOfPosition(pos).line + 1;
}

function isStringLike(node: ts.Node): node is ts.StringLiteral | ts.NoSubstitutionTemplateLiteral {
  return ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node);
}

/**
 * Text a user can see in a .tsx file: JSX text, string children like {"..."},
 * and user-visible attributes. Ignores className, identifiers and comments.
 */
export function extractJsxUserText(source: string, fileName = "file.tsx"): TextChunk[] {
  const sf = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const chunks: TextChunk[] = [];

  const visit = (node: ts.Node) => {
    if (ts.isJsxText(node)) {
      const text = node.text.trim();
      if (text) chunks.push({ text, line: lineOf(sf, node.getStart(sf)) });
    } else if (ts.isJsxExpression(node) && node.expression && isStringLike(node.expression)) {
      const parent = node.parent;
      const isChild = ts.isJsxElement(parent) || ts.isJsxFragment(parent);
      const isVisibleAttr =
        ts.isJsxAttribute(parent) && USER_VISIBLE_ATTRS.has(parent.name.getText(sf));
      if (isChild || isVisibleAttr) {
        chunks.push({ text: node.expression.text, line: lineOf(sf, node.getStart(sf)) });
      }
    } else if (
      ts.isJsxAttribute(node) &&
      node.initializer &&
      ts.isStringLiteral(node.initializer) &&
      USER_VISIBLE_ATTRS.has(node.name.getText(sf))
    ) {
      chunks.push({ text: node.initializer.text, line: lineOf(sf, node.getStart(sf)) });
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return chunks;
}

/** Every string literal in a copy module (src/copy/*.ts holds UI strings only). */
export function extractCopyStrings(source: string, fileName = "copy.ts"): TextChunk[] {
  const sf = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const chunks: TextChunk[] = [];
  const visit = (node: ts.Node) => {
    if (isStringLike(node)) chunks.push({ text: node.text, line: lineOf(sf, node.getStart(sf)) });
    else if (ts.isTemplateExpression(node)) {
      const parts = [node.head.text, ...node.templateSpans.map((s) => s.literal.text)];
      chunks.push({ text: parts.join(" "), line: lineOf(sf, node.getStart(sf)) });
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return chunks;
}

/** String values (not keys) of a JSON document. Line numbers are approximate (first occurrence). */
export function extractJsonStrings(source: string): TextChunk[] {
  const chunks: TextChunk[] = [];
  const lines = source.split(/\r?\n/);
  const walk = (value: unknown) => {
    if (typeof value === "string") {
      const idx = lines.findIndex((l) => l.includes(JSON.stringify(value).slice(1, -1)));
      chunks.push({ text: value, line: idx + 1 });
    } else if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === "object") Object.values(value).forEach(walk);
  };
  walk(JSON.parse(source));
  return chunks;
}

/** Markdown/plain text: every line is user-facing. */
export function extractPlainText(source: string): TextChunk[] {
  return source.split(/\r?\n/).map((text, i) => ({ text, line: i + 1 }));
}

export function lintChunks(file: string, chunks: TextChunk[]): ClaimHit[] {
  return chunks.flatMap((c) =>
    findBannedTerms(c.text).map((term) => ({ file, line: c.line, term, text: c.text.slice(0, 120) })),
  );
}
