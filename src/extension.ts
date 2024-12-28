import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { refreshTranslationCache, registerCompletionProvider, registerHoverProvider, setupFileWatcher } from './autocomplete';

export function activate(context: vscode.ExtensionContext) {
	console.log('Congratulations, your extension "l10n-manager" is now active!');

	const config = vscode.workspace.getConfiguration('l10n-manager');

	// Function to get all JSON files from a directory recursively
	const getJsonFilesFromDirectory = (dirPath: string): string[] => {
		let jsonFiles: string[] = [];
		const items = fs.readdirSync(dirPath);

		items.forEach(item => {
			const fullPath = path.join(dirPath, item);
			const stat = fs.statSync(fullPath);

			if (stat.isDirectory()) {
				jsonFiles = jsonFiles.concat(getJsonFilesFromDirectory(fullPath));
			} else if (path.extname(fullPath).toLowerCase() === '.json') {
				jsonFiles.push(fullPath);
			}
		});

		return jsonFiles;
	};

	const setSourceFiles = vscode.commands.registerCommand('l10n-manager.setSourceFiles', async () => {
		const options: vscode.OpenDialogOptions = {
			canSelectMany: true,
			canSelectFolders: true,
			filters: {
				'JSON files': ['json']
			},
			title: 'Select JSON Files or Folders for Localization'
		};

		const uris = await vscode.window.showOpenDialog(options);

		if (uris && uris.length > 0) {
			let allJsonFiles: string[] = [];

			for (const uri of uris) {
				const stat = fs.statSync(uri.fsPath);
				if (stat.isDirectory()) {
					// If it's a directory, get all JSON files from it
					allJsonFiles = allJsonFiles.concat(getJsonFilesFromDirectory(uri.fsPath));
				} else if (path.extname(uri.fsPath).toLowerCase() === '.json') {
					// If it's a JSON file, add it directly
					allJsonFiles.push(uri.fsPath);
				}
			}

			// Remove duplicates
			const uniqueJsonFiles = [...new Set(allJsonFiles)];

			if (uniqueJsonFiles.length > 0) {
				await config.update('sourceFiles', uniqueJsonFiles, vscode.ConfigurationTarget.Global);
				vscode.window.showInformationMessage(
					`Added ${uniqueJsonFiles.length} JSON files to localization sources`
				);
			} else {
				vscode.window.showWarningMessage('No JSON files found in the selected locations');
			}
		}
	});

	const showSourceFiles = vscode.commands.registerCommand('l10n-manager.showSourceFiles', () => {
		const sourceFiles = config.get('sourceFiles') as string[];
		if (sourceFiles && sourceFiles.length > 0) {
			const fileList = sourceFiles.map(file => path.basename(file)).join(', ');
			vscode.window.showInformationMessage(`Current source files: ${fileList}`);
		} else {
			vscode.window.showInformationMessage('No source files configured');
		}
	});

	refreshTranslationCache(); // Initial cache refresh
	setupFileWatcher(context);
	registerCompletionProvider(context);
	registerHoverProvider(context);

	context.subscriptions.push(
		vscode.workspace.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration('l10n-manager')) {
				refreshTranslationCache();
				setupFileWatcher(context);
			}
		})
	);

	// Update your existing subscriptions
	context.subscriptions.push(setSourceFiles, showSourceFiles);
	context.subscriptions.push(setSourceFiles, showSourceFiles);
}

export function deactivate() { }