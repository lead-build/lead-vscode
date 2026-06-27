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

export function validateFormattedText(originalText: string, formattedText: string): boolean {
    return stripFormattingWhitespace(originalText) === stripFormattingWhitespace(formattedText);
}
