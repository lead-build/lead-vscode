import * as vscode from 'vscode';

import { loadBracketSets, formatText } from "./formatter";
import { validateFormattedText } from "./formattervalidator";


export function activate(context: vscode.ExtensionContext) {

	const { openers, closers } =
		loadBracketSets(context.extensionPath);


	const provider: vscode.DocumentFormattingEditProvider = {
		provideDocumentFormattingEdits(document) {

			const text = document.getText();
			const formatted = formatText(text, openers, closers);

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
