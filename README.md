<center>
<img src="https://danishshakeel.me/wp-content/uploads/2024/12/512x512.png" alt="Localization Manager is a VS Code extension that provides intelligent autocompletion for translation" height="64" width="64">

# Localization Manager
![VS Code CI](https://github.com/danish17/localization-manager-vscode/actions/workflows/ci.yml/badge.svg)
## VS Code extension that provides intelligent autocompletion for translation keys and previews of translations in your code.

<img src="https://github.com/amannn/next-intl/raw/main/media/logo-dark-mode.svg" height="48">
</center>

## Features
- Smart Autocompletion: Get suggestions for translation keys while typing `t("")`
- Context-Aware: Automatically detects translation context from `useTranslation()` calls
- Translation Preview: Hover over translation keys to see their values
- Dynamic Updates: Automatically refreshes when translation files change
- Support for Multiple Formats: Works with nested JSON structures and arrays

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

