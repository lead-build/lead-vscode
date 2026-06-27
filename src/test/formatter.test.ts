import * as assert from 'assert';
import { formatText } from '../formatter';

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
});
