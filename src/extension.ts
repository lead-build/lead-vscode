import * as vscode from 'vscode';
import { LanguageClient } from 'vscode-languageclient/node';

import { createClient } from "./client";

let client: LanguageClient | undefined;

// Stops the current client (if any) and starts a fresh one, re-reading
// "pblang.serverPath" — a plain `client.restart()` would keep reusing the
// server path that was resolved when the client was first constructed, so a
// changed setting wouldn't take effect until the window itself was reloaded.
async function restartClient(): Promise<void> {
	if (client) {
		await client.stop();
	}
	client = createClient();
	try {
		await client.start();
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		vscode.window.showErrorMessage(
			`Failed to start pbls: ${message}. Install lead-build's pbls, or set the "pblang.serverPath" setting.`
		);
	}
}

export function activate(context: vscode.ExtensionContext) {

	restartClient();
	context.subscriptions.push({ dispose: () => client?.stop() });

	context.subscriptions.push(
		vscode.commands.registerCommand('lead-build.restartLanguageServer', restartClient)
	);

	// Document formatting is provided by pbls (textDocument/formatting),
	// registered automatically by the language client from the server's
	// advertised capabilities — no client-side provider needed here.
}

// This method is called when your extension is deactivated
export function deactivate(): Thenable<void> | undefined {
	return client?.stop();
}
