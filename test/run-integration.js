'use strict';

const path = require('node:path');
const { runTests } = require('@vscode/test-electron');

const root = path.resolve(__dirname, '..');
runTests({
  // Without an override, vscode-test downloads an isolated copy for this OS.
  // Keep the test runner independent of any user's VS Code installation.
  ...(process.env.VSCODE_EXECUTABLE_PATH
    ? { vscodeExecutablePath: process.env.VSCODE_EXECUTABLE_PATH }
    : { version: process.env.VSCODE_TEST_VERSION || 'stable' }),
  extensionDevelopmentPath: root,
  extensionTestsPath: path.join(__dirname, 'integration.js'),
  launchArgs: [
    '--user-data-dir=' + path.join(root, '.test-profile'),
    '--extensions-dir=' + path.join(root, '.test-extensions'),
    '--skip-welcome', '--skip-release-notes', '--disable-workspace-trust',
    '--disable-extensions', '--new-window'
  ]
}).catch(error => { console.error(error); process.exitCode = 1; });
