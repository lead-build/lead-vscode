import * as assert from 'assert';
import { formatText } from '../formatter';

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

describe('Formatter list-first long inline', () => {
    it('moves first long item after [ onto its own line', () => {
        const input = `|{ cwd, pb, include, ... }|
let
    objdir = cwd / "obj";

    lib = include (cwd / "lib.pbb");
in
[
    lib.c_build {
        output = cwd / "app";
        srcdir = cwd / "src";
        objdir = cwd / "build";
        sources = [ cwd / "src" / "main.c", cwd / "src" / "main.c", cwd / "src" / "main.c", cwd / "src" / "main.c",
            cwd / "src" / "main.c",
            cwd / "src" / "main.c",
            cwd / "src" / "main.c"
        ];
    },
]`;
        const result = formatText(input, new Set(['{', '[', '(', 'let']), new Set(['}', ']', ')', 'in']));
        assert.ok(result.includes('sources = ['), 'opening list bracket should be preserved');
        assert.ok(result.includes('        cwd / "src" / "main.c",'), 'elements should be on their own lines');
        assert.ok(result.includes('            cwd / "src" / "main.c",\n            cwd / "src" / "main.c",'), 'split boundary should preserve trailing comma between first-line and following items');
        assert.strictEqual(stripFormattingWhitespace(result), stripFormattingWhitespace(input), 'formatter should only change whitespace/line breaks for this sample');
    });
});
