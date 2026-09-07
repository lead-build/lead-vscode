import * as vscode from 'vscode';
import { LanguageClient } from 'vscode-languageclient/node';

import { createClient } from "./client";

let client: LanguageClient | undefined;

export function activate(context: vscode.ExtensionContext) {

	client = createClient();
	client.start().catch((err) => {
		const message = err instanceof Error ? err.message : String(err);
		vscode.window.showErrorMessage(
			`Failed to start pbls: ${message}. Install lead-build's pbls, or set the "pblang.serverPath" setting.`
		);
	});
	context.subscriptions.push({ dispose: () => client?.stop() });

	// Document formatting is provided by pbls (textDocument/formatting),
	// registered automatically by the language client from the server's
	// advertised capabilities — no client-side provider needed here.
}

// This method is called when your extension is deactivated
export function deactivate(): Thenable<void> | undefined {
	return client?.stop();
}
