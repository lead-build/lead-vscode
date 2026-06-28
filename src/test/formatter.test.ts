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

describe('Formatter', () => {
    it('should indent nested blocks and let/in constructs', () => {
        const input = `let
name = "demo";
in
{
path = cwd / "src";
}`;
        const expected = `let
    name = "demo";
in
{
    path = cwd / "src";
}`;

        const result = formatText(input, new Set(['{', '[', '(', 'let']), new Set(['}', ']', ')', 'in']));
        assert.strictEqual(result, expected);
    });

    it('should not miscount "in" inside include and should indent closing braces correctly', () => {
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
        sources = [ cwd / "src" / "main.c" ];
    },
]`;

        const expected = `|{ cwd, pb, include, ... }|
let
    objdir = cwd / "obj";

    lib = include (cwd / "lib.pbb");
in
[
    lib.c_build {
        output = cwd / "app";
        srcdir = cwd / "src";
        objdir = cwd / "build";
        sources = [ cwd / "src" / "main.c" ];
    },
]`;

        const result = formatText(input, new Set(['{', '[', '(', 'let']), new Set(['}', ']', ')', 'in']));
        assert.strictEqual(result, expected);
    });

    it('should preserve pipe-block spacing for |{ ... }| literals', () => {
        const input = `| { cwd, pb, include, ... } |
let
name = "demo";
in
{
    path = cwd / "src";
}`;
        const expected = `|{ cwd, pb, include, ... }|
let
    name = "demo";
in
{
    path = cwd / "src";
}`;

        const result = formatText(input, new Set(['{', '[', '(', 'let']), new Set(['}', ']', ')', 'in']));
        assert.strictEqual(result, expected);
    });

    it('should insert line breaks after let-block statements', () => {
        const input = `let
objdir = cwd / "obj"; lib = include (cwd / "lib.pbb");
in
{
path = cwd / "src"; }`;
        const expected = `let
    objdir = cwd / "obj";
    lib = include (cwd / "lib.pbb");
in
{
    path = cwd / "src";
}`;

        const result = formatText(input, new Set(['{', '[', '(', 'let']), new Set(['}', ']', ')', 'in']));
        assert.strictEqual(result, expected);
    });

    it('should wrap long lines while preserving parenthesized indentation', () => {
        const input = `let
    longExpr = include (cwd / "lib.pbb" / "path" / "to" / "deep" / "resource" / "file.pbb");
in
{
    path = cwd / "src";
}`;
        const result = formatText(input, new Set(['{', '[', '(', 'let']), new Set(['}', ']', ')', 'in']));

        assert.ok(result.includes('longExpr = include (cwd / "lib.pbb" / "path" / "to" / "deep" / "resource" /'), 'first wrapped segment should include the opening parenthesized expression');
        assert.ok(result.includes('        "file.pbb");'), 'continuation should be indented and include the closing parenthesis');
        assert.ok(result.includes('    path = cwd / "src";'), 'the remainder of the let/in block should still be formatted correctly');
    });

    it('should split long list literals so each element gets its own line', () => {
        const input = `let
    sources = [cwd / "src" / "main.c", cwd / "src" / "main2.c", cwd / "src" / "main3.c"];
in
{
    path = cwd / "src";
}`;
        const result = formatText(input, new Set(['{', '[', '(', 'let']), new Set(['}', ']', ')', 'in']));

        assert.ok(result.includes('    sources = ['), 'opening list bracket should be preserved');
        assert.ok(result.includes('        cwd / "src" / "main.c",'), 'first list element should be on its own line');
        assert.ok(result.includes('        cwd / "src" / "main2.c",'), 'second list element should be on its own line');
        assert.ok(result.includes('        cwd / "src" / "main3.c"'), 'third list element should be on its own line');
        assert.ok(result.includes('    ];'), 'list closing bracket should remain aligned');
    });

    it('should split long inline list entries onto separate lines', () => {
        const input = `let
    sources = [
        cwd / "src" / "main.c",
        cwd / "src" / "main.c", cwd / "src" / "main.c", cwd / "src" / "main.c", cwd / "src" / "main.c",
        cwd / "src" / "main.c",
        cwd / "src" / "main.c"
    ];
in
{
    path = cwd / "src";
}`;
        const result = formatText(input, new Set(['{', '[', '(', 'let']), new Set(['}', ']', ')', 'in']));

        assert.ok(result.includes('        cwd / "src" / "main.c",\n        cwd / "src" / "main.c",\n        cwd / "src" / "main.c",'), 'a long inline list should be broken into separate entries');
    });

    it('should preserve string literals while formatting whitespace', () => {
        const input = `rule_link = pb.rule (
    |   {input, output, ...}|
    {
        command = ["gcc", "-o", output, input];
        depfile = "\${output}.d";
    }
);`;
        const result = formatText(input, new Set(['{', '[', '(', 'let']), new Set(['}', ']', ')', 'in']));

        assert.strictEqual(stripFormattingWhitespace(result), stripFormattingWhitespace(input));
        assert.ok(result.includes('"gcc"'), 'string literals should remain intact');
        assert.ok(result.includes('"-o"'), 'string literals should remain intact');
        assert.ok(result.includes('"${output}.d"'), 'interpolated string literals should remain intact');
    });

    it('should keep empty lists inline', () => {
        const input = `let
    empty = [];
in
{
    path = cwd / "src";
}`;
        const result = formatText(input, new Set(['{', '[', '(', 'let']), new Set(['}', ']', ')', 'in']));

        assert.ok(result.includes('    empty = [];'), 'empty list should remain inline');
        assert.ok(!result.includes('empty = [\n'), 'empty list should not be split into multiple lines');
    });

    it('should remove inner whitespace from empty lists while keeping them inline', () => {
        const input = `let
    empty = [    ];
in
{
    path = cwd / "src";
}`;
        const result = formatText(input, new Set(['{', '[', '(', 'let']), new Set(['}', ']', ')', 'in']));

        assert.ok(result.includes('    empty = [];'), 'empty list should be normalized to [] inline');
        assert.ok(!result.includes('[    ]'), 'inner whitespace inside empty list should be removed');
        assert.ok(!result.includes('empty = [\n'), 'empty list should not be split into multiple lines');
    });
});
