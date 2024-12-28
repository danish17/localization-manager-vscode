<h1 align="center">
<img src="https://danishshakeel.me/wp-content/uploads/2024/12/512x512.png" alt="Localization Manager is a VS Code extension that provides intelligent autocompletion for translation" height="64" width="64">
<br>
Localization Manager
<br>
<img src="https://github.com/danish17/localization-manager-vscode/actions/workflows/ci.yml/badge.svg?branch=main">
</h1>

<p align="center">
VS Code extension that provides intelligent autocompletion for translation keys and previews of translations in your code.
<br>
[View on VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=danishshakeel.l10n-manager)
</p> 

<p align="center">
<strong>Supports</strong>
<br>
<img src="https://github.com/amannn/next-intl/raw/main/media/logo.png" height="32">
</p>

<p align="center">
<img src="https://github.com/user-attachments/assets/d1040fe8-5ed6-43bc-84e5-a506593f6135" alt="Localization Manager VS Code Extension" />
</p>

## Features
- 🔍 Smart Autocompletion: Get suggestions for translation keys while typing t("")
- 🧠 Context-Aware: Automatically detects translation context from useTranslation() calls
- 👁️ Translation Preview: Hover over translation keys to see their values
- 🔄 Dynamic Updates: Automatically refreshes when translation files change
- 📦 Support for Multiple Formats: Works with nested JSON structures and arrays

## Installation

1. Open VS Code
2. Press `Ctrl+P` / `Cmd+P`
3. Type `ext install l10n-manager`

For development, please check [Visual Studio Code: Testing Extensions](https://code.visualstudio.com/api/working-with-extensions/testing-extension)

## Configuration
### Add your translation files through the command palette:

1. Press `Ctrl+Shift+P` / `Cmd+Shift+P`
2. Type `L10n: Set Source Files`
3. Select your source translation JSON files or directories

