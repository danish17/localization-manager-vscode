import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

// Cache interface
interface TranslationCache {
  keys: string[];
  values: Map<string, string>;
  lastUpdate: number;
}

// Global cache
let translationCache: TranslationCache = {
  keys: [],
  values: new Map(),
  lastUpdate: 0
};

// File watcher
let fileWatcher: vscode.FileSystemWatcher | undefined;

// Translation patterns
const TRANSLATION_PATTERNS = [
  // Standard patterns
  /t\(\s*[`'"]$/,              // t("")
  /\$t\(\s*[`'"]$/,            // $t("")
  /useTranslation\(\s*[`'"][^"'`]*[`'"],\s*[`'"]/, // useTranslation("context", "")
  /i18n\.t\(\s*[`'"]$/,        // i18n.t("")

  // Context-aware patterns
  /useTranslation\(\s*[`'"][^"'`]*[`'"]\.t\(\s*[`'"]/, // useTranslation("context").t("")
  /useTranslation\([^)]*\)\.t\(\s*[`'"]/, // useTranslation(...).t("")

  // General patterns with possible prefix
  /[.]\s*t\(\s*[`'"]/, // any.t("")
  /\bt\(\s*[`'"]/, // word boundary t("")

  // Add other patterns as needed
];

/**
* Sets up a file system watcher for the translation source files
* Watches for changes in JSON files within configured source directories
* - Disposes existing watcher if present
* - Creates new watcher for all JSON files in source paths
* - Refreshes translation cache on file changes/creation/deletion
* @param context VS Code extension context to manage watcher lifecycle
*/
export function setupFileWatcher(context: vscode.ExtensionContext) {
  if (fileWatcher) {
    fileWatcher.dispose();
  }

  const config = vscode.workspace.getConfiguration('l10n-manager');
  const sourceFiles = config.get('sourceFiles') as string[];
  const sourcePaths = sourceFiles.map(file => path.dirname(file));

  fileWatcher = vscode.workspace.createFileSystemWatcher(
    `{${sourcePaths.join(',')}}/**.json`
  );

  fileWatcher.onDidChange(() => refreshTranslationCache());
  fileWatcher.onDidCreate(() => refreshTranslationCache());
  fileWatcher.onDidDelete(() => refreshTranslationCache());

  context.subscriptions.push(fileWatcher);
}

/**
* Refreshes the translation cache by reading all configured source files
* Recursively processes JSON files in directories and extracts translations
* Updates the global translationCache with new keys and values
* Features:
* - Handles both files and directories
* - Processes only JSON files
* - Removes duplicate keys
* - Updates cache timestamp
* - Shows error messages for failed operations
* @returns Promise that resolves when cache refresh is complete
*/
export async function refreshTranslationCache(): Promise<void> {
  try {
    const config = vscode.workspace.getConfiguration('l10n-manager');
    const sourceFiles = config.get('sourceFiles') as string[];

    const newCache: TranslationCache = {
      keys: [],
      values: new Map(),
      lastUpdate: Date.now()
    };

    /**
     * Helper function to process a single file or directory
     * @param filePath Path to the JSON file or directory to process
     */
    const processJsonFile = async (filePath: string) => {
      try {
        const stat = await fs.promises.stat(filePath);
        if (stat.isDirectory()) {
          const files = await fs.promises.readdir(filePath);
          for (const file of files) {
            if (path.extname(file).toLowerCase() === '.json') {
              await processJsonFile(path.join(filePath, file));
            }
          }
        } else if (path.extname(filePath).toLowerCase() === '.json') {
          const content = await fs.promises.readFile(filePath, 'utf-8');
          const json = JSON.parse(content);
          const extracted = extractTranslationData(json);

          newCache.keys.push(...extracted.keys);
          extracted.values.forEach((value, key) => {
            newCache.values.set(key, value);
          });
        }
      } catch (err) {
        vscode.window.showWarningMessage(`Error processing ${path.basename(filePath)}: ${err}`);
      }
    };

    for (const source of sourceFiles) {
      await processJsonFile(source);
    }

    // Remove duplicates from keys
    newCache.keys = [...new Set(newCache.keys)];
    translationCache = newCache;

  } catch (err) {
    vscode.window.showErrorMessage(`Failed to refresh translation cache: ${err}`);
  }
}

/**
* Handles errors that occur when processing translation files
* Logs the error to console and shows warning in VS Code UI
* @param file Path of the file that caused the error
* @param error The error object thrown during file processing
*/
export function handleFileError(file: string, error: any) {
  const errorMessage = `Error processing ${path.basename(file)}: ${error.message}`;
  console.error(errorMessage);
  vscode.window.showWarningMessage(errorMessage);
}

/**
* Recursively extracts translation keys and values from a JSON object
* Handles nested objects and arrays, generating dot notation keys
* Example: { "auth": { "login": "Login" } } -> "auth.login": "Login"
* @param obj The JSON object to extract translations from
* @param prefix Optional prefix for nested keys
* @returns Object containing array of keys and map of key-value pairs
*/
export function extractTranslationData(obj: any, prefix: string = ''): { keys: string[], values: Map<string, string> } {
  const keys: string[] = [];
  const values = new Map<string, string>();

  function traverse(current: any, currentPrefix: string) {
    if (!current) { return; }

    if (typeof current === 'object') {
      // Handle array structures
      if (Array.isArray(current)) {
        current.forEach((item, index) => {
          const newPrefix = currentPrefix ? `${currentPrefix}[${index}]` : `${index}`;
          traverse(item, newPrefix);
        });
        return;
      }

      // Handle nested objects
      Object.entries(current).forEach(([key, value]) => {
        const newPrefix = currentPrefix ? `${currentPrefix}.${key}` : key;
        traverse(value, newPrefix);
      });
    } else if (typeof current === 'string') {
      keys.push(currentPrefix);
      values.set(currentPrefix, current);
    }
  }

  traverse(obj, prefix);
  return { keys, values };
}

/**
* Extracts the translation context from the start of the file to the current line
* Detects patterns like useTranslation("context") or .t("context")
* @param linePrefix The code line up to the cursor position
* @returns The translation context string if found, empty string otherwise
*/
function getContext(linePrefix: string, lineNumber: number): string {
  // Find translation context from hook declaration
  const previousPattern = /const\s*{\s*t\s*}\s*=\s*useTranslation\(\s*["'`]([^"'`]*)["'`]\)/;

  const patterns = [
    previousPattern,
    /const\s*t\s*=\s*useTranslation\(\s*["'`]([^"'`]*)["'`]\)/,
    /useTranslation\(\s*["'`]([^"'`]*)["'`]/,
    /useTranslation\(\s*["'`]([^"'`]*)["'`]\)\.t/,
    /\.(t|translate)\(\s*["'`]([^"'`]*)["'`]/
  ];

  // We need to check the full document text up to the current line
  const document = vscode.window.activeTextEditor?.document;
  if (document) {
    const currentLine = document.lineAt(lineNumber).text;
    const documentText = document.getText();
    const textUpToCursor = documentText.substring(0, documentText.indexOf(currentLine) + linePrefix.length);

    for (const pattern of patterns) {
      const matches = textUpToCursor.match(pattern);
      if (matches && matches[1]) {
        return matches[1];
      }
    }
  }

  return '';
}

/**
* Sorts completion items based on matching criteria with the query
* Prioritizes in order:
* 1. Exact matches with query
* 2. Items starting with query
* 3. Alphabetical order
* @param a First completion item to compare
* @param b Second completion item to compare
* @param query The text being typed by user
* @returns -1 if a should be ranked higher, 1 if b should be ranked higher, 0 if equal
*/
function sortCompletionItems(a: vscode.CompletionItem, b: vscode.CompletionItem, query: string): number {
  const aLabel = a.label as string;
  const bLabel = b.label as string;

  const aExact = aLabel === query;
  const bExact = bLabel === query;
  if (aExact && !bExact) { return -1; }
  if (!aExact && bExact) { return 1; }

  const aStarts = aLabel.startsWith(query);
  const bStarts = bLabel.startsWith(query);
  if (aStarts && !bStarts) { return -1; }
  if (!aStarts && bStarts) { return 1; }

  return aLabel.localeCompare(bLabel);
}

/**
 * Registers auto-completion provider in context
 * 
 * @param context
 */
export function registerCompletionProvider(context: vscode.ExtensionContext) {
  const provider = vscode.languages.registerCompletionItemProvider(
    ['javascript', 'typescript', 'javascriptreact', 'typescriptreact', 'vue'],
    {
      async provideCompletionItems(document: vscode.TextDocument, position: vscode.Position) {
        const linePrefix = document.lineAt(position).text.substring(0, position.character);

        if (Date.now() - translationCache.lastUpdate > 300000) {
          await refreshTranslationCache();
        }

        const context = getContext(linePrefix, position.line);

        const isInTranslationFunction = TRANSLATION_PATTERNS.some(pattern =>
          pattern.test(linePrefix)
        );

        if (!isInTranslationFunction) { return undefined; }

        const wordRange = document.getWordRangeAtPosition(position);
        const currentWord = wordRange ? document.getText(wordRange) : '';

        const completionItems = translationCache.keys
          .filter(key => {
            if (!context) { return true; }
            // Check if key is child of context
            return key.startsWith(`${context}.`) && key !== context;
          })
          .map(key => {
            // Remove parent context from suggestion if present
            const displayKey = context ? key.replace(`${context}.`, '') : key;
            const item = new vscode.CompletionItem(displayKey, vscode.CompletionItemKind.Text);
            const value = translationCache.values.get(key);

            const docs = new vscode.MarkdownString();
            docs.appendCodeblock(key, 'typescript');

            item.detail = value;
            item.documentation = docs;
            item.filterText = displayKey.split('.').join(' ');

            item.keepWhitespace = true;
            item.kind = vscode.CompletionItemKind.Text;
            item.range = document.getWordRangeAtPosition(
              position,
              /[\w\-.]+/
            );

            return item;
          });
        completionItems.sort((a, b) => sortCompletionItems(a, b, currentWord));

        return completionItems;
      }
    },
    '"', "'", '`', '.',
    'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
    'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
    'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
    'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
    '_', '-'
  );

  context.subscriptions.push(provider);
}

/**
 * Registers hover handler in context
 * 
 * @param context
 */
export function registerHoverProvider(context: vscode.ExtensionContext) {
  const provider = vscode.languages.registerHoverProvider(
    ['javascript', 'typescript', 'javascriptreact', 'typescriptreact', 'vue'],
    {
      provideHover(document: vscode.TextDocument, position: vscode.Position) {
        const range = document.getWordRangeAtPosition(position, /[\w\-.]+/);
        if (!range) { return; }

        const lineText = document.lineAt(position).text;
        const keyMatch = lineText.match(/t\(\s*["'`]([\w\-.]+)["'`]\)/);
        if (!keyMatch) { return; }

        const key = keyMatch[1];
        const context = getContext(lineText, position.line);
        const fullKey = context ? `${context}.${key}` : key;
        const value = translationCache.values.get(fullKey);

        if (value) {
          return new vscode.Hover([
            new vscode.MarkdownString(`Source translation: \`${value}\``)
          ]);
        }
      }
    }
  );

  context.subscriptions.push(provider);
}
