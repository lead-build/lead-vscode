import * as vscode from 'vscode';
import {
	LanguageClient,
	LanguageClientOptions,
	ServerOptions,
	TransportKind,
} from 'vscode-languageclient/node';

// Resolves the pbls binary to launch: an explicit `pblang.serverPath`
// setting if given, otherwise "pbls" on PATH.
function resolveServerPath(): string {
	const configured = vscode.workspace.getConfiguration('pblang').get<string>('serverPath');
	return configured && configured.trim().length > 0 ? configured : 'pbls';
}

export function createClient(): LanguageClient {
	const serverPath = resolveServerPath();

	const serverOptions: ServerOptions = {
		command: serverPath,
		args: [],
		transport: TransportKind.stdio,
	};

	const clientOptions: LanguageClientOptions = {
		documentSelector: [{ scheme: 'file', language: 'pbb' }],
	};

	return new LanguageClient('pblang', 'Lead-build language server', serverOptions, clientOptions);
}
