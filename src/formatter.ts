import * as fs from "fs";
import * as path from "path";

interface LanguageConfig {
    brackets?: [string, string][];
}

// Load the bracket pairs from the extension's language configuration so the
// formatter can keep indentation aligned with the language rules.
export function loadBracketSets(extensionPath: string) {
    const configPath = path.join(extensionPath, "language-configuration.json");
    const config = JSON.parse(
        fs.readFileSync(configPath, "utf8").replace(/\/\/.*$/g, "")
    ) as LanguageConfig;

    const openers = new Set<string>();
    const closers = new Set<string>();

    for (const [open, close] of config.brackets ?? []) {
        openers.add(open);
        closers.add(close);
    }

    return { openers, closers };
}

// Escape a string so it can be used safely inside a regular expression.
function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Count how many times the tracked bracket or keyword tokens appear in a line.
function countTokens(line: string, tokens: Set<string>): number {
    let count = 0;
    for (const token of tokens) {
        const isWord = /^[A-Za-z_][A-Za-z0-9_]*$/.test(token);
        const pattern = isWord ? `\\b${escapeRegExp(token)}\\b` : escapeRegExp(token);
        const regex = new RegExp(pattern, 'g');
        const matches = line.match(regex);
        if (matches) {
            count += matches.length;
        }
    }
    return count;
}

// Split off a trailing line comment while leaving string literals intact.
function splitLineContent(line: string): { code: string; comment: string } {
    let inString = false;
    for (let i = 0; i < line.length - 1; i++) {
        const char = line[i];
        if (char === '"') {
            inString = !inString;
            if (line[i - 1] === '\\') {
                inString = !inString;
            }
        }
        if (!inString && char === '/' && line[i + 1] === '/') {
            return {
                code: line.slice(0, i).trimEnd(),
                comment: line.slice(i)
            };
        }
    }
    return { code: line, comment: '' };
}

// Break a statement into semicolon-terminated pieces so each statement can be
// formatted independently.
function splitCodeOnSemicolons(code: string): string[] {
    const parts: string[] = [];
    let current = '';
    let inString = false;

    for (let i = 0; i < code.length; i++) {
        const char = code[i];
        if (char === '"' && code[i - 1] !== '\\') {
            inString = !inString;
        }

        if (!inString && char === ';') {
            current += ';';
            parts.push(current);
            current = '';
            continue;
        }

        current += char;
    }

    if (current.trim()) {
        parts.push(current);
    }

    return parts;
}

// Normalize spacing outside string literals without touching the string text.
function normalizeOutsideString(segment: string): string {
    let text = segment.replace(/\s+/g, ' ');
    text = text.replace(/\s*\.\s*/g, '.');
    text = text.replace(/\s*,\s*/g, ', ');
    text = text.replace(/\s*;\s*/g, ';');
    text = text.replace(/\s*([=+\-*/<>!&|]{1,2}|\+\+|\/\/|->|==|!=|<=|>=|\|\||&&)\s*/g, ' $1 ');

    text = text.replace(/\|\s*\{\s*/g, '|{');
    text = text.replace(/([A-Za-z0-9_\)\]])\s*\{\s*/g, '$1 { ');
    text = text.replace(/\{\s*/g, '{ ');
    text = text.replace(/\s*\}/g, ' }');

    text = text.replace(/([A-Za-z0-9_\)\]])\s*\[\s*/g, '$1 [ ');
    text = text.replace(/\[\s*/g, '[ ');
    text = text.replace(/\s*\]/g, ' ]');

    text = text.replace(/([A-Za-z0-9_])\s*\(/g, '$1 (');
    text = text.replace(/\(\s*/g, '(');
    text = text.replace(/\s*\)/g, ')');

    text = text.replace(/\s+/g, ' ');
    text = text.replace(/\}\s*\|/g, '}|');
    return text;
}

// Normalize spacing for a full expression while preserving string literals.
function normalizeSpaces(segment: string): string {
    let result = '';
    let current = '';
    let inString = false;

    for (let i = 0; i < segment.length; i++) {
        const char = segment[i];
        const prev = i > 0 ? segment[i - 1] : '';

        if (char === '"' && prev !== '\\') {
            current += char;
            if (inString) {
                result += current;
                current = '';
            } else {
                result += normalizeOutsideString(current);
                current = '';
            }
            inString = !inString;
            continue;
        }

        current += char;
    }

    if (current.length > 0) {
        result += inString ? current : normalizeOutsideString(current);
    }

    return result.trim();
}

// Detect bracketed list literals and return their prefix, items, and suffix so
// they can be reflowed one item per line when needed.
function splitListItems(code: string): { prefix: string; items: string[]; suffix: string; hasTrailingComma: boolean } | null {
    const trimmed = code.trim();
    if (!trimmed.includes('[') || !trimmed.includes(']')) {
        return null;
    }

    let start = -1;
    let end = -1;
    let depth = 0;
    let inString = false;

    for (let i = 0; i < trimmed.length; i++) {
        const char = trimmed[i];
        if (char === '"' && trimmed[i - 1] !== '\\') {
            inString = !inString;
        }
        if (inString) {
            continue;
        }

        if (char === '[') {
            if (depth === 0) {
                start = i;
            }
            depth += 1;
        } else if (char === ']') {
            if (depth > 0) {
                depth -= 1;
                if (depth === 0) {
                    end = i;
                    break;
                }
            }
        }
    }

    if (start < 0 || end < 0) {
        return null;
    }

    const prefix = trimmed.slice(0, start).trimEnd();
    const inner = trimmed.slice(start + 1, end).trim();
    const suffix = trimmed.slice(end + 1).trim();
    const hasTrailingComma = /,\s*$/.test(inner);
    if (!inner) {
        return { prefix, items: [], suffix, hasTrailingComma: false };
    }

    const items = inner
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    if (items.length <= 1) {
        return null;
    }

    // If any individual item is long, or the whole list text is longer than
    // MAX_LINE_LENGTH, treat it as splittable so the formatter will put each
    // element on its own line. This also covers cases where the first item
    // sits directly after `[` and the combined line exceeds the limit.
    const longItems = items.filter((item) => item.length > 24);
    if (longItems.length === 0 && trimmed.length <= MAX_LINE_LENGTH) {
        return null;
    }

    return { prefix, items, suffix, hasTrailingComma };
}

// Split top-level comma-separated items while ignoring nested expressions.
function splitTopLevelItems(code: string): string[] | null {
    const trimmed = code.trim();
    if (!trimmed.includes(',')) {
        return null;
    }

    const items: string[] = [];
    let current = '';
    let depth = 0;
    let inString = false;

    for (let i = 0; i < trimmed.length; i++) {
        const char = trimmed[i];
        if (char === '"' && trimmed[i - 1] !== '\\') {
            inString = !inString;
        }
        if (inString) {
            current += char;
            continue;
        }

        if (char === '(' || char === '[') {
            depth += 1;
        } else if (char === ')' || char === ']') {
            depth = Math.max(depth - 1, 0);
        }

        if (char === ',' && depth === 0) {
            const item = current.trim();
            if (item) {
                items.push(item);
            }
            current = '';
            continue;
        }

        current += char;
    }

    const lastItem = current.trim();
    if (lastItem) {
        items.push(lastItem);
    }

    return items.length > 1 ? items : null;
}

type WrappedSegment = { code: string; extraIndent: number };
const MAX_LINE_LENGTH = 80;

// Find a safe wrap point near the line length limit, preferring commas and
// lower-nesting positions.
function findWrapPoint(text: string): { pos: number; depth: number } {
    const candidates: { pos: number; depth: number; score: number }[] = [];
    let depth = 0;
    let inString = false;

    for (let i = 0; i < Math.min(text.length, MAX_LINE_LENGTH); i++) {
        const char = text[i];
        if (char === '"' && text[i - 1] !== '\\') {
            inString = !inString;
        }
        if (inString) {
            continue;
        }

        if (char === '(') {
            depth += 1;
        } else if (char === ')') {
            depth = Math.max(depth - 1, 0);
        }

        if (char === ',' || char === ' ' || char === ';') {
            let nextNonSpace = i + 1;
            while (nextNonSpace < text.length && text[nextNonSpace] === ' ') {
                nextNonSpace += 1;
            }
            const nextChar = text[nextNonSpace] ?? '';
            const badParen = nextChar === '(' ? 1 : 0;
            const score = depth + badParen;
            candidates.push({ pos: i, depth, score });
        }
    }

    if (candidates.length === 0) {
        return { pos: -1, depth: 0 };
    }

    const firstOpenParen = text.indexOf('(');
    if (firstOpenParen >= 0) {
        const laterCandidates = candidates.filter(c => c.pos > firstOpenParen);
        if (laterCandidates.length > 0) {
            const best = laterCandidates.reduce((best, current) => {
                if (current.score < best.score || (current.score === best.score && current.pos > best.pos)) {
                    return current;
                }
                return best;
            }, laterCandidates[0]);
            return { pos: best.pos, depth: best.depth };
        }
    }

    const best = candidates.reduce((best, current) => {
        if (current.score < best.score || (current.score === best.score && current.pos > best.pos)) {
            return current;
        }
        return best;
    }, candidates[0]);

    return { pos: best.pos, depth: best.depth };
}

// Wrap a long line into multiple segments while preserving nesting-aware
// indentation.
function wrapLongLine(code: string, indentLevel: number): WrappedSegment[] {
    const segments: WrappedSegment[] = [];
    const trimmed = code.trim();

    const topLevelItems = splitTopLevelItems(trimmed);
    if (topLevelItems && topLevelItems.length > 1 && trimmed.length > MAX_LINE_LENGTH) {
        const hasTrailingComma = /,\s*$/.test(trimmed);
        return topLevelItems.map((item, index) => ({
            code: index < topLevelItems.length - 1 || hasTrailingComma ? `${item},` : item,
            extraIndent: 1
        }));
    }

    // Heuristic: if a list opens on this line but doesn't close here, and the
    // first line is long, split the visible first-line elements onto separate
    // lines. This handles cases where the `[` is followed by many items and
    // the closing `]` appears on later lines.
    if (trimmed.includes('[') && !trimmed.includes(']') && trimmed.length > MAX_LINE_LENGTH) {
        const openIdx = trimmed.indexOf('[');
        const afterOpen = trimmed.slice(openIdx + 1).trim();
        const hasTrailingComma = /,\s*$/.test(afterOpen);
        const firstLineItems = afterOpen.split(',').map(s => s.trim()).filter(Boolean);
        if (firstLineItems.length > 1) {
            const opening = trimmed.slice(0, openIdx + 1).trim();
            const segments2: WrappedSegment[] = [];
            segments2.push({ code: opening, extraIndent: 0 });
            for (let i = 0; i < firstLineItems.length; i++) {
                const item = firstLineItems[i];
                const shouldAppendComma = i < firstLineItems.length - 1 || hasTrailingComma;
                segments2.push({ code: shouldAppendComma ? `${item},` : item, extraIndent: 1 });
            }
            return segments2;
        }
    }

    const listItems = splitListItems(trimmed);
    if (listItems) {
        const opening = listItems.prefix ? `${listItems.prefix} [` : '[';
        segments.push({ code: opening, extraIndent: 0 });
        for (let i = 0; i < listItems.items.length; i++) {
            const item = listItems.items[i];
            const itemText = i < listItems.items.length - 1 || listItems.hasTrailingComma ? `${item},` : item;
            segments.push({ code: itemText, extraIndent: 1 });
        }
        const closing = listItems.suffix ? `]${listItems.suffix}` : ']';
        segments.push({ code: closing, extraIndent: 0 });
        return segments;
    }

    const parenthesizedList = trimmed.match(/^([A-Za-z0-9_\.\-]+\s*=\s*)?\[(.*)\](.*)$/);
    if (parenthesizedList) {
        const rawInner = parenthesizedList[2];
        const hasTrailingComma = /,\s*$/.test(rawInner.trim());
        const inner = rawInner.split(',').map((item) => item.trim()).filter(Boolean);
        if (inner.length > 1) {
            const prefix = parenthesizedList[1] ?? '';
            segments.push({ code: `${prefix}[`, extraIndent: 0 });
            for (let i = 0; i < inner.length; i++) {
                const item = inner[i];
                const itemText = i < inner.length - 1 || hasTrailingComma ? `${item},` : item;
                segments.push({ code: itemText, extraIndent: 1 });
            }
            const suffix = parenthesizedList[3] ?? '';
            segments.push({ code: `]${suffix}`, extraIndent: 0 });
            return segments;
        }
    }

    let remaining = trimmed;
    let extraIndent = 0;

    while (remaining.length > MAX_LINE_LENGTH) {
        const { pos, depth } = findWrapPoint(remaining);
        if (pos <= 0) {
            break;
        }

        const segment = remaining.slice(0, pos + 1).trimRight();
        segments.push({ code: segment, extraIndent });
        remaining = remaining.slice(pos + 1).trimLeft();
        extraIndent = depth > 0 ? 1 : 0;
    }

    segments.push({ code: remaining, extraIndent });
    return segments;
}

// Closing lines reduce indentation before they are emitted.
function isClosingLine(trimmed: string): boolean {
    return trimmed.startsWith('}') || trimmed.startsWith(']') || trimmed.startsWith(')') || /^in(\s|$)/.test(trimmed);
}

// Opening lines increase indentation after they are emitted.
function isOpeningLine(trimmed: string): boolean {
    return /^let(\s|$)/.test(trimmed) || /^bind(\s|$)/.test(trimmed);
}

// Strip whitespace outside strings so the validator can compare tokens only.
function stripFormattingWhitespace(text: string): string {
    let result = '';
    let inString = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const prev = i > 0 ? text[i - 1] : '';

        if (char === '"' && prev !== '\\') {
            inString = !inString;
            result += char;
            continue;
        }

        if (!inString && /\s/.test(char)) {
            continue;
        }

        result += char;
    }

    return result;
}

// Format the full document in two passes: first expand semicolon-separated
// statements, then reflow each line while tracking indentation and brackets.
export function formatText(text: string, openers: Set<string>, closers: Set<string>): string {
    const lines = text.split(/\r?\n/);
    const expandedLines: string[] = [];
    let letDepth = 0;

    // First pass: keep line structure, but split chained statements so each
    // statement can be indented separately.
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.length === 0) {
            expandedLines.push('');
            continue;
        }

        const leadingWhitespace = line.match(/^\s*/)?.[0] ?? '';
        const lineIndentWidth = leadingWhitespace.length;
        const { code, comment } = splitLineContent(trimmed);
        const startsLet = /^let(\s|$)/.test(code);
        const startsIn = /^in(\s|$)/.test(code);

        if (startsLet) {
            letDepth += 1;
        }

        if (code.includes(';')) {
            const segments = splitCodeOnSemicolons(code);
            for (let i = 0; i < segments.length; i++) {
                const segment = segments[i].trim();
                if (!segment) {
                    continue;
                }
                const segmentComment = comment && i === segments.length - 1 ? ` ${comment}` : '';
                const leadingWhitespace = line.match(/^\s*/)?.[0] ?? '';
                expandedLines.push(leadingWhitespace + segment + segmentComment);
            }
        } else {
            expandedLines.push(line);
        }

        if (startsIn && letDepth > 0) {
            letDepth -= 1;
        }
    }

    // Second pass: normalize spacing, wrap long lines, and track indentation.
    let level = 0;
    const indentSize = 4;
    const formatted: string[] = [];

    for (const line of expandedLines) {
        const trimmed = line.trim();
        if (trimmed.length === 0) {
            formatted.push('');
            continue;
        }

        const leadingWhitespace = line.match(/^\s*/)?.[0] ?? '';
        const lineIndentWidth = leadingWhitespace.length;
        const { code, comment } = splitLineContent(trimmed);
        const listItems = splitListItems(code);
        const formattedCode = listItems ? code : normalizeSpaces(code);
        const indentLevel = isClosingLine(formattedCode) ? Math.max(level - 1, 0) : level;
        const wrappedLines = wrapLongLine(formattedCode, indentLevel);
        const topLevelItems = splitTopLevelItems(formattedCode);

        // Prefer list-aware formatting for long comma-separated item lists.
        if (topLevelItems && topLevelItems.length > 1 && formattedCode.length > MAX_LINE_LENGTH) {
            const hasTrailingComma = /,\s*$/.test(formattedCode);
            const itemIndentWidth = /\[/.test(formattedCode) ? lineIndentWidth + indentSize : lineIndentWidth;
            for (let i = 0; i < topLevelItems.length; i++) {
                const item = topLevelItems[i];
                const itemComment = comment && i === topLevelItems.length - 1 ? ` ${comment}` : '';
                const itemText = i < topLevelItems.length - 1 || hasTrailingComma ? `${item},` : item;
                formatted.push(' '.repeat(itemIndentWidth) + itemText + itemComment);
            }
        } else {
            for (let i = 0; i < wrappedLines.length; i++) {
                const { code: wrappedCode, extraIndent } = wrappedLines[i];
                const actualIndentLevel = Math.max(indentLevel + extraIndent, 0);
                const lineComment = comment && i === wrappedLines.length - 1 ? ` ${comment}` : '';
                formatted.push(' '.repeat(actualIndentLevel * indentSize) + wrappedCode + lineComment);
            }
        }

        // Update the indentation level only after the current line has been emitted.
        const openCount = countTokens(formattedCode, openers);
        const closeCount = countTokens(formattedCode, closers);
        const net = openCount - closeCount;

        if (isClosingLine(formattedCode) && net === 0) {
            continue;
        }

        level = Math.max(level + net, 0);
    }

    // Final safety check: the formatter must only change whitespace and line
    // breaks, never non-whitespace tokens.
    const result = formatted.join('\n');
    if (stripFormattingWhitespace(text) !== stripFormattingWhitespace(result)) {
        return text;
    }

    return result;
}
