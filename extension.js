const vscode = require('vscode');
const path = require('path');
const childProcess = require('child_process');

const ALT_V_SEQUENCE = '\u001bv';
const POWERSHELL_TIMEOUT_MS = 1500;

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
	const sendWithPrefixCommand = vscode.commands.registerCommand(
		'codex.sendSelectedCode',
		() => sendSelectedCode(true)
	);
	const sendWithoutPrefixCommand = vscode.commands.registerCommand(
		'codex.sendSelectedCodeWithoutPrefix',
		() => sendSelectedCode(false)
	);
	const smartTerminalPasteCommand = vscode.commands.registerCommand(
		'codex.smartTerminalPaste',
		() => smartTerminalPaste()
	);

	context.subscriptions.push(
		sendWithPrefixCommand,
		sendWithoutPrefixCommand,
		smartTerminalPasteCommand
	);
}

async function smartTerminalPaste() {
	const terminal = vscode.window.activeTerminal;

	try {
		const text = await vscode.env.clipboard.readText();

		if (text.length > 0)
			return pasteToTerminal();
	} catch (_error) {
		return pasteToTerminal();
	}

	if (!terminal || !isCodexTerminal(terminal))
		return pasteToTerminal();

	try {
		const hasImage = await clipboardHasImage();

		if (hasImage) {
			terminal.sendText(ALT_V_SEQUENCE, false);
			return;
		}
	} catch (_error) {
		return pasteToTerminal();
	}

	return pasteToTerminal();
}

function sendSelectedCode(includePrefix) {
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
	const message = includePrefix && prefix
		? `${prefix}\n${content}`
		: content;

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

function findCodexTerminal() {
	const codexTerminal = vscode.window.terminals.find((terminal) =>
		isCodexTerminal(terminal)
	);

	return codexTerminal || vscode.window.activeTerminal;
}

function isCodexTerminal(terminal) {
	return terminal.name.toLowerCase().includes('codex');
}

function pasteToTerminal() {
	return vscode.commands.executeCommand('workbench.action.terminal.paste');
}

function clipboardHasImage() {
	return new Promise((resolve, reject) => {
		childProcess.execFile(
			'powershell.exe',
			[
				'-NoProfile',
				'-NonInteractive',
				'-STA',
				'-Command',
				'Add-Type -AssemblyName System.Windows.Forms; [Console]::Out.Write([System.Windows.Forms.Clipboard]::ContainsImage())',
			],
			{
				timeout: POWERSHELL_TIMEOUT_MS,
				windowsHide: true,
				maxBuffer: 1024,
			},
			(error, stdout) => {
				if (error) {
					reject(error);
					return;
				}

				resolve(stdout.trim().toLowerCase() === 'true');
			}
		);
	});
}

function deactivate() {}

module.exports = {
	activate,
	deactivate,
};
