import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

suite('L10n Manager Extension Test Suite', () => {
	const fixturesPath = path.join(__dirname, '../../src/test/fixtures');
	let document: vscode.TextDocument;

	suiteSetup(async () => {
		// Wait for extension to activate
		await new Promise(resolve => setTimeout(resolve, 500));

		// Create test fixtures directory if it doesn't exist
		if (!fs.existsSync(fixturesPath)) {
			fs.mkdirSync(fixturesPath, { recursive: true });
		}

		// Create sample translation JSON
		const sampleTranslations = {
			auth: {
				login: {
					title: "Login",
					button: {
						submit: "Submit",
						cancel: "Cancel"
					}
				},
				register: {
					title: "Register"
				}
			}
		};

		fs.writeFileSync(
			path.join(fixturesPath, 'en.json'),
			JSON.stringify(sampleTranslations, null, 2)
		);

		// Configure extension with test file and wait for it to process
		const config = vscode.workspace.getConfiguration('l10n-manager');
		await config.update('sourceFiles', [path.join(fixturesPath, 'en.json')], vscode.ConfigurationTarget.Global);
		await new Promise(resolve => setTimeout(resolve, 500));
	});

	setup(async () => {
		// Create a new file for each test
		document = await vscode.workspace.openTextDocument({
			language: 'typescript',
			content: ''
		});
		await vscode.window.showTextDocument(document);
	});

	test('Provides completions for translation keys', async () => {
		// Insert test content
		const editor = vscode.window.activeTextEditor!;
		await editor.edit(editBuilder => {
			editBuilder.insert(new vscode.Position(0, 0), 't("")');
		});

		// Get completions at cursor position
		const position = new vscode.Position(0, 3);
		const completions = await vscode.commands.executeCommand<vscode.CompletionList>(
			'vscode.executeCompletionItemProvider',
			document.uri,
			position
		);

		assert.ok(completions?.items.length > 0, 'Should provide completion items');
		assert.ok(
			completions?.items.some(item => item.label === 'auth.login.title'),
			'Should include nested translation keys'
		);
	});

	test('Provides context-aware completions', async () => {
		// Insert test content with context
		const editor = vscode.window.activeTextEditor!;
		await editor.edit(editBuilder => {
			editBuilder.insert(new vscode.Position(0, 0), 'const { t } = useTranslation("auth")\nt("")');
		});

		// Get completions at cursor position
		const position = new vscode.Position(1, 3);
		const completions = await vscode.commands.executeCommand<vscode.CompletionList>(
			'vscode.executeCompletionItemProvider',
			document.uri,
			position
		);

		assert.ok(completions?.items.length > 0, 'Should provide completion items');
		assert.ok(
			completions?.items.some(item => item.label === 'login.title'),
			'Should show keys without context prefix'
		);
		assert.ok(
			!completions?.items.some(item => item.label === 'auth.login.title'),
			'Should not include context prefix in suggestions'
		);
	});

	test('Provides hover information', async () => {
		// Insert test content and wait for extension to process
		const editor = vscode.window.activeTextEditor!;
		await editor.edit(editBuilder => {
			editBuilder.insert(new vscode.Position(0, 0), 't("auth.login.title")');
		});

		// Wait for extension to process
		await new Promise(resolve => setTimeout(resolve, 100));

		// Get hover at position
		const position = new vscode.Position(0, 15);
		const hovers = await vscode.commands.executeCommand<vscode.Hover[]>(
			'vscode.executeHoverProvider',
			document.uri,
			position
		);

		assert.ok(hovers?.length > 0, 'Should provide hover information');
		const hoverContent = hovers[0].contents.map(content =>
			typeof content === 'string' ? content : content.value
		).join('');

		assert.ok(
			hoverContent.includes('Login'),
			'Should show correct translation in hover'
		);
	});

	test('Updates completions when translation files change', async () => {
		// Wait for initial cache to be ready
		await new Promise(resolve => setTimeout(resolve, 100));

		// Modify translation file
		const translationFile = path.join(fixturesPath, 'en.json');
		const original = fs.readFileSync(translationFile, 'utf8');

		const modified = {
			auth: {
				login: {
					title: "Login",
					newKey: "New Value"
				}
			}
		};

		fs.writeFileSync(translationFile, JSON.stringify(modified, null, 2));

		// Wait longer for file watcher to process
		await new Promise(resolve => setTimeout(resolve, 2000));

		// Force cache refresh
		await vscode.commands.executeCommand('l10n-manager.refreshCache');

		// Check for new completion
		const editor = vscode.window.activeTextEditor!;
		await editor.edit(editBuilder => {
			editBuilder.insert(new vscode.Position(0, 0), 't("")');
		});

		const position = new vscode.Position(0, 3);
		const completions = await vscode.commands.executeCommand<vscode.CompletionList>(
			'vscode.executeCompletionItemProvider',
			document.uri,
			position
		);

		// Restore original file
		fs.writeFileSync(translationFile, original);

		const hasNewKey = completions?.items.some(item =>
			item.label === 'auth.login.newKey' ||
			item.label === 'login.newKey'
		);
		assert.ok(hasNewKey, 'Should include newly added translation key');
	});

	suiteTeardown(() => {
		// Clean up test fixtures
		if (fs.existsSync(fixturesPath)) {
			fs.rmSync(fixturesPath, { recursive: true });
		}
	});

	teardown(async () => {
		// Close the test document
		await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
	});
});