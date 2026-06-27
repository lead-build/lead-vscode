import * as assert from 'assert';
import { formatText } from '../formatter';

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
    });
});
