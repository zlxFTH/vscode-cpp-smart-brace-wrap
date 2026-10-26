'use strict';

const vscode = require('vscode');
const { findWrapPlan } = require('./parser');
const SUPPORTED_LANGUAGES = new Set(['c', 'cpp', 'cuda-cpp']);

function activate(context) {
  context.subscriptions.push(vscode.commands.registerCommand(
    'cppSmartBraceWrap.openBrace',
    async () => {
      const editor = vscode.window.activeTextEditor;
      const typeNormally = () => vscode.commands.executeCommand('default:type', { text: '{' });
      if (!editor || !SUPPORTED_LANGUAGES.has(editor.document.languageId) ||
          !vscode.workspace.getConfiguration('cppSmartBraceWrap', editor.document.uri).get('enabled', true) ||
          editor.selections.length !== 1 || !editor.selection.isEmpty) {
        return typeNormally();
      }

      const document = editor.document;
      const offset = document.offsetAt(editor.selection.active);
      const plan = findWrapPlan(document.getText(), offset, {
        tabSize: typeof editor.options.tabSize === 'number' ? editor.options.tabSize : 4
      });
      if (!plan) return typeNormally();

      // appendText escapes $, } and backslashes in the user's source.
      // keepWhitespace preserves the existing body indentation exactly.
      const snippet = new vscode.SnippetString()
        .appendText(plan.replacement.slice(0, plan.caret))
        .appendTabstop(0)
        .appendText(plan.replacement.slice(plan.caret));
      return editor.insertSnippet(snippet,
        new vscode.Range(document.positionAt(plan.start), document.positionAt(plan.end)),
        { keepWhitespace: true, undoStopBefore: true, undoStopAfter: true });
    }
  ));
}

module.exports = { activate };
