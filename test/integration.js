'use strict';

const assert = require('node:assert/strict');
const vscode = require('vscode');

async function run() {
  const extension = vscode.extensions.getExtension('local-tools.cpp-smart-brace-wrap');
  assert.ok(extension, 'extension is discoverable');
  await extension.activate();
  let passed = 0;
  async function check(name, language, before, after, { undo = false, selection = false } = {}) {
    const offset = before.indexOf('|');
    const original = before.replace('|', '');
    const document = await vscode.workspace.openTextDocument({ language, content: original });
    const editor = await vscode.window.showTextDocument(document);
    editor.options = { insertSpaces: true, tabSize: 4 };
    const at = document.positionAt(offset);
    editor.selection = new vscode.Selection(at, selection ? document.positionAt(offset + 3) : at);
    await vscode.commands.executeCommand('cppSmartBraceWrap.openBrace');
    const expectedOffset = after.indexOf('|');
    assert.equal(document.getText(), after.replace('|', ''), name + ': content');
    assert.equal(document.offsetAt(editor.selection.active), expectedOffset, name + ': caret');
    if (undo) {
      await vscode.commands.executeCommand('undo');
      assert.equal(document.getText(), original, name + ': single undo');
      assert.equal(document.offsetAt(editor.selection.active), offset, name + ': undo caret');
    }
    // Untitled test buffers only; never save or touch a user's editor buffers.
    await vscode.commands.executeCommand('workbench.action.revertAndCloseActiveEditor');
    console.log('PASS ' + name);
    passed++;
  }

  await check('screenshot behavior', 'cpp', 'while (t--) |\n    sol();', 'while (t--) {\n    sol();|\n}', { undo: true });
  await check('nested control statement', 'cpp', 'while (ok) |\n    if (a) f();\n    else g();\nnext();', 'while (ok) {\n    if (a) f();\n    else g();|\n}\nnext();');
  await check('indented code', 'cpp', 'void f() {\n    while (t--) |\n        sol();\n}', 'void f() {\n    while (t--) {\n        sol();|\n    }\n}');
  await check('literal snippet characters', 'cpp', 'while (ok) |\n    f("$0 \\\\ }");', 'while (ok) {\n    f("$0 \\\\ }");|\n}');
  await check('trailing comment', 'cpp', 'while (ok) |\n    sol(); // note\nnext();', 'while (ok) {\n    sol();| // note\n}\nnext();');
  await check('ordinary C++ brace', 'cpp', 'void f() |', 'void f() {|}');
  await check('C while and single undo', 'c', 'while (t--) |\n    sol();', 'while (t--) {\n    sol();|\n}', { undo: true });
  await check('C compound literal', 'c', 'if (ok) |\n    f((struct Point){.x = 1, .y = 2});', 'if (ok) {\n    f((struct Point){.x = 1, .y = 2});|\n}');
  await check('CUDA kernel launch and single undo', 'cuda-cpp', 'while (ok) |\n    kernel<<<blocks, threads>>>(data, count);\nnext();', 'while (ok) {\n    kernel<<<blocks, threads>>>(data, count);|\n}\nnext();', { undo: true });
  await check('JavaScript fallback', 'javascript', 'while (t--) |\n    sol();', 'while (t--) {|}\n    sol();');
  const configuration = vscode.workspace.getConfiguration('cppSmartBraceWrap');
  await configuration.update('enabled', false, vscode.ConfigurationTarget.Global);
  try {
    await check('disabled fallback', 'cpp', 'while (t--) |\n    sol();', 'while (t--) {|}\n    sol();');
    await check('C disabled fallback', 'c', 'while (t--) |\n    sol();', 'while (t--) {|}\n    sol();');
    await check('CUDA disabled fallback', 'cuda-cpp', 'while (t--) |\n    sol();', 'while (t--) {|}\n    sol();');
  } finally {
    await configuration.update('enabled', undefined, vscode.ConfigurationTarget.Global);
  }

  const document = await vscode.workspace.openTextDocument({ language: 'cpp', content: 'a();\nb();' });
  const editor = await vscode.window.showTextDocument(document);
  editor.selections = [new vscode.Selection(0, 4, 0, 4), new vscode.Selection(1, 4, 1, 4)];
  await vscode.commands.executeCommand('cppSmartBraceWrap.openBrace');
  assert.equal(document.getText(), 'a();{}\nb();{}', 'multicursor uses native typing');
  await vscode.commands.executeCommand('workbench.action.revertAndCloseActiveEditor');
  console.log(`PASS multicursor fallback\n${passed + 1} integration checks passed`);
}

module.exports = { run };
