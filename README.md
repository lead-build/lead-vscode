# Lead build VSCode plugin

## What This Extension Is

This extension provides syntax highlighting for `lead-build` script files and a simple auto formatter for `.pbb` files.

It is meant to make Lead scripts easier to read and edit while the language and supporting tools are still evolving.

See:
- [lead-build](https://github.com/lead-build/lead-build/) ([docs](https://lead-build.readthedocs.io))
- [lead-lib](https://github.com/lead-build/lead-lib/) ([docs](https://lead-lib.readthedocs.io))

## Installation And Use

Install the extension in VS Code, then open any `.pbb` file.

Once installed, the extension provides:

- Syntax highlighting for Lead build files
- Formatting support through the built-in document formatter

To use the formatter, open a `.pbb` file and run the format document command in VS Code.

## Notes on this tool and AI

This is a personal note on AI-assisted development.

This extension was generated with AI and currently has limited functionality. It is an experiment to see what AI can do at this stage, but the result is not impressive from a systems engineering point of view. I would expect better structure and better generalization.

I have had several issues with the quality of the generated code and its output. For example, commas were sometimes lost during formatting, so I do not yet trust the formatter to preserve everything correctly. I therefore added an inline validator to check that the input matches the output, because I do not want silent changes to tokens or structure.

For that reason, `lead-build`, `lead-lib`, and any tool that really matters remain completely AI-free until they can be proven to work well. I am being deliberately hard on AI here because I want the main projects to stay under human control until the results are actually reliable.

AI seems to work reasonably well for documentation, especially for someone who is not a native English speaker. Even there, it still needs manual review and correction.

For now, I cannot deny that this VS Code extension took only an evening to build with AI, which is impressive for what it is. But it is still just a temporary helper to get started on the projects that matter most here: `lead-build` and `lead-lib`.
