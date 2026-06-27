import * as fs from "fs";
import * as path from "path";

interface LanguageConfig {
    brackets?: [string, string][];
}

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

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

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

function normalizeSpaces(segment: string): string {
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
    return text.trim();
}

function splitListItems(code: string): { prefix: string; items: string[]; suffix: string } | null {
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
    if (!inner) {
        return { prefix, items: [], suffix };
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

    return { prefix, items, suffix };
}

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

function countBracketDelta(code: string): number {
    let depth = 0;
    let inString = false;

    for (let i = 0; i < code.length; i++) {
        const char = code[i];
        if (char === '"' && code[i - 1] !== '\\') {
            inString = !inString;
        }
        if (inString) {
            continue;
        }

        if (char === '[') {
            depth += 1;
        } else if (char === ']') {
            depth = Math.max(depth - 1, 0);
        }
    }

    return depth;
}

type WrappedSegment = { code: string; extraIndent: number };
const MAX_LINE_LENGTH = 80;

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

function wrapLongLine(code: string, indentLevel: number): WrappedSegment[] {
    const segments: WrappedSegment[] = [];
    const trimmed = code.trim();

    const topLevelItems = splitTopLevelItems(trimmed);
    if (topLevelItems && topLevelItems.length > 1 && trimmed.length > MAX_LINE_LENGTH) {
        return topLevelItems.map((item, index) => ({
            code: index < topLevelItems.length - 1 ? `${item},` : item,
            extraIndent: 1
        }));
    }

    const listItems = splitListItems(trimmed);
    if (listItems) {
        const opening = listItems.prefix ? `${listItems.prefix} [` : '[';
        segments.push({ code: opening, extraIndent: 0 });
        for (let i = 0; i < listItems.items.length; i++) {
            const item = listItems.items[i];
            const itemText = i < listItems.items.length - 1 ? `${item},` : item;
            segments.push({ code: itemText, extraIndent: 1 });
        }
        const closing = listItems.suffix ? `]${listItems.suffix}` : ']';
        segments.push({ code: closing, extraIndent: 0 });
        return segments;
    }

    const parenthesizedList = trimmed.match(/^([A-Za-z0-9_\.\-]+\s*=\s*)?\[(.*)\](.*)$/);
    if (parenthesizedList) {
        const inner = parenthesizedList[2].split(',').map((item) => item.trim()).filter(Boolean);
        if (inner.length > 1) {
            const prefix = parenthesizedList[1] ?? '';
            segments.push({ code: `${prefix}[`, extraIndent: 0 });
            for (let i = 0; i < inner.length; i++) {
                const item = inner[i];
                const itemText = i < inner.length - 1 ? `${item},` : item;
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

function isClosingLine(trimmed: string): boolean {
    return trimmed.startsWith('}') || trimmed.startsWith(']') || trimmed.startsWith(')') || /^in(\s|$)/.test(trimmed);
}

function isOpeningLine(trimmed: string): boolean {
    return /^let(\s|$)/.test(trimmed) || /^bind(\s|$)/.test(trimmed);
}

export function formatText(text: string, openers: Set<string>, closers: Set<string>): string {
    const lines = text.split(/\r?\n/);
    const expandedLines: string[] = [];
    let letDepth = 0;

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

        if (topLevelItems && topLevelItems.length > 1 && formattedCode.length > MAX_LINE_LENGTH) {
            const itemIndentWidth = /\[/.test(formattedCode) ? lineIndentWidth + indentSize : lineIndentWidth;
            for (let i = 0; i < topLevelItems.length; i++) {
                const item = topLevelItems[i];
                const itemComment = comment && i === topLevelItems.length - 1 ? ` ${comment}` : '';
                formatted.push(' '.repeat(itemIndentWidth) + (i < topLevelItems.length - 1 ? `${item},` : item) + itemComment);
            }
        } else {
            for (let i = 0; i < wrappedLines.length; i++) {
                const { code: wrappedCode, extraIndent } = wrappedLines[i];
                const actualIndentLevel = Math.max(indentLevel + extraIndent, 0);
                const lineComment = comment && i === wrappedLines.length - 1 ? ` ${comment}` : '';
                formatted.push(' '.repeat(actualIndentLevel * indentSize) + wrappedCode + lineComment);
            }
        }

        const openCount = countTokens(formattedCode, openers);
        const closeCount = countTokens(formattedCode, closers);
        const net = openCount - closeCount;

        if (isClosingLine(formattedCode) && net === 0) {
            continue;
        }

        level = Math.max(level + net, 0);
    }

    return formatted.join('\n');
}
