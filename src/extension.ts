import * as vscode from 'vscode';

import { loadBracketSets, formatText } from "./formatter";


export function activate(context: vscode.ExtensionContext) {

	const { openers, closers } =
		loadBracketSets(context.extensionPath);


	const provider: vscode.DocumentFormattingEditProvider = {
		provideDocumentFormattingEdits(document) {

			const text = document.getText();
			const formatted = formatText(text, openers, closers);

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
