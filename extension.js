const vscode = require('vscode');
const path = require('path');

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
	const command = vscode.commands.registerCommand(
		'codex.sendSelectedCode',
		() => {
			const editor = vscode.window.activeTextEditor;

			if (!editor) {
				vscode.window.showWarningMessage('请先打开代码文件。');
				return;
			}

			const terminal = findCodexTerminal();
			if (!terminal) {
				vscode.window.showWarningMessage(
					'请先打开 Codex CLI 终端，并让它处于活动状态。'
				);
				return;
			}

			const document = editor.document;
			const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
			const relativePath = workspaceFolder
				? path.relative(workspaceFolder.uri.fsPath, document.fileName)
				: document.fileName;
			const content = editor.selection.start.line === editor.selection.end.line
				? `${relativePath.replace(/\\/g, '/')}:${editor.selection.start.line + 1}`
				: document.getText(editor.selection);
			const autoSubmit = vscode.workspace
				.getConfiguration('codex')
				.get('autoSubmit', false);
			const prefix = vscode.workspace
				.getConfiguration('codex')
				.get('prefix', '');
			const message = prefix ? `${prefix}\n${content}` : content;

			terminal.show(false);
			vscode.env.clipboard.writeText(message).then(() =>
				vscode.commands.executeCommand('workbench.action.terminal.paste')
			).then(() => {
				if (autoSubmit)
					terminal.sendText('', true);
			}).catch((error) => {
				const message = error instanceof Error ? error.message : String(error);
				vscode.window.showErrorMessage(`粘贴代码失败：${message}`);
			});
		}
	);

	context.subscriptions.push(command);
}

function findCodexTerminal() {
	const codexTerminal = vscode.window.terminals.find((terminal) =>
		terminal.name.toLowerCase().includes('codex')
	);

	return codexTerminal || vscode.window.activeTerminal;
}

function deactivate() {}

module.exports = {
	activate,
	deactivate,
};
