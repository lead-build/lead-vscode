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

function isClosingLine(trimmed: string): boolean {
    return trimmed.startsWith('}') || trimmed.startsWith(']') || trimmed.startsWith(')') || /^in(\s|$)/.test(trimmed);
}

function isOpeningLine(trimmed: string): boolean {
    return /^let(\s|$)/.test(trimmed) || /^bind(\s|$)/.test(trimmed);
}

export function formatText(text: string, openers: Set<string>, closers: Set<string>): string {
    const lines = text.split(/\r?\n/);
    let level = 0;
    const indentSize = 4;
    const formatted: string[] = [];

    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.length === 0) {
            formatted.push('');
            continue;
        }

        const { code, comment } = splitLineContent(trimmed);
        const formattedCode = normalizeSpaces(code);
        const formattedLine = comment ? `${formattedCode} ${comment}` : formattedCode;

        const indentLevel = isClosingLine(formattedCode) ? Math.max(level - 1, 0) : level;
        formatted.push(' '.repeat(indentLevel * indentSize) + formattedLine);

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
