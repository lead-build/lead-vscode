import * as vscode from 'vscode';

import { formatText } from "./formatter";
import { validateFormattedText } from "./formattervalidator";


export function activate(context: vscode.ExtensionContext) {

	const provider: vscode.DocumentFormattingEditProvider = {
		async provideDocumentFormattingEdits(document) {

			const text = document.getText();

			let formatted: string;
			try {
				formatted = await formatText(text);
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				vscode.window.showErrorMessage(`Formatting failed: ${message}`);
				return [];
			}

			// Keep this guard so formatting stays limited to whitespace and line
			// breaks; it prevents accidental token changes from reaching users.
			if (!validateFormattedText(text, formatted)) {
				vscode.window.showWarningMessage('Formatting aborted: non-whitespace changes detected.');
				return [];
			}

			const lastLine = document.lineAt(document.lineCount - 1);

			return [
				vscode.TextEdit.replace(
					new vscode.Range(
						0,
						0,
						document.lineCount - 1,
						lastLine.text.length
					),
					formatted
				)
			];
		}
	};

	context.subscriptions.push(
		vscode.languages.registerDocumentFormattingEditProvider(
			'pbb',
			provider
		)
	);
}

// This method is called when your extension is deactivated
export function deactivate() { }
