'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { findWrapPlan } = require('../src/parser');

function wrap(marked) {
  const offset = marked.indexOf('|');
  assert.notEqual(offset, -1);
  const text = marked.slice(0, offset) + marked.slice(offset + 1);
  const plan = findWrapPlan(text, offset);
  if (!plan) return null;
  const changed = text.slice(0, plan.start) + plan.replacement + text.slice(plan.end);
  const caret = plan.start + plan.caret;
  return changed.slice(0, caret) + '|' + changed.slice(caret);
}

const cases = [
  ['screenshot', 'while (t--) |\n    sol();', 'while (t--) {\n    sol();|\n}'],
  ['space after condition', 'while (t--)|\n    sol();', 'while (t--) {\n    sol();|\n}'],
  ['only the next statement', 'while (t--) |\n    sol();\nother();', 'while (t--) {\n    sol();|\n}\nother();'],
  ['tabs', '\twhile (t--) |\n\t\tsol();', '\twhile (t--) {\n\t\tsol();|\n\t}'],
  ['CRLF', 'while (t--) |\r\n    sol();\r\nnext();', 'while (t--) {\r\n    sol();|\r\n}\r\nnext();'],
  ['condition semicolons', 'for (int i = 0; i < n; ++i) |\n    f(i);', 'for (int i = 0; i < n; ++i) {\n    f(i);|\n}'],
  ['multiline call', 'if (ok) |\n    f(\n        1,\n        2);\nnext();', 'if (ok) {\n    f(\n        1,\n        2);|\n}\nnext();'],
  ['nested for', 'while (ok) |\n    for (int i = 0; i < 10; i++)\n        f(i);\nnext();', 'while (ok) {\n    for (int i = 0; i < 10; i++)\n        f(i);|\n}\nnext();'],
  ['complete if/else body', 'while (ok) |\n    if (a)\n        f();\n    else\n        g();\nnext();', 'while (ok) {\n    if (a)\n        f();\n    else\n        g();|\n}\nnext();'],
  ['if constexpr', 'if constexpr (ok<T>()) |\n    f();', 'if constexpr (ok<T>()) {\n    f();|\n}'],
  ['else header', 'if (a) f();\nelse |\n    g();', 'if (a) f();\nelse {\n    g();|\n}'],
  ['do header', 'do |\n    f();\nwhile (ok);', 'do {\n    f();|\n}\nwhile (ok);'],
  ['do/while body', 'if (a) |\n    do\n        f();\n    while (ok);\nnext();', 'if (a) {\n    do\n        f();\n    while (ok);|\n}\nnext();'],
  ['lambda statement', 'while (ok) |\n    f([] { g(); return 2; });\nnext();', 'while (ok) {\n    f([] { g(); return 2; });|\n}\nnext();'],
  ['quoted punctuation', 'while (ok) |\n    f("; } $0 \\\"", \'}\');', 'while (ok) {\n    f("; } $0 \\\"", \'}\');|\n}'],
  ['raw string', 'while (ok) |\n    f(R"tag(\"; } {)tag");\nnext();', 'while (ok) {\n    f(R"tag(\"; } {)tag");|\n}\nnext();'],
  ['digit separators', "while (ok) |\n    f(1'000, 0xAB'CD);", "while (ok) {\n    f(1'000, 0xAB'CD);|\n}"],
  ['C compound literal', 'if (ok) |\n    f((struct Point){.x = 1, .y = 2});\nnext();', 'if (ok) {\n    f((struct Point){.x = 1, .y = 2});|\n}\nnext();'],
  ['CUDA kernel launch', 'while (ok) |\n    kernel<<<dim3(2, 3), dim3(32, 4), 0, stream>>>(data, count);\nnext();', 'while (ok) {\n    kernel<<<dim3(2, 3), dim3(32, 4), 0, stream>>>(data, count);|\n}\nnext();'],
  ['trailing line comment', 'while (ok) |\n    f(); // keep me\nnext();', 'while (ok) {\n    f();| // keep me\n}\nnext();'],
  ['continued trailing comment', 'while (ok) |\n    f(); // keep \\\n    this too\nnext();', 'while (ok) {\n    f();| // keep \\\n    this too\n}\nnext();'],
  ['body comments', 'while (ok) |\n    // ; }\n    f(/* ; } */ 1);', 'while (ok) {\n    // ; }\n    f(/* ; } */ 1);|\n}'],
  ['trailing multiline comment', 'while (ok) |\n    f(); /* line\n       two */\nnext();', 'while (ok) {\n    f();| /* line\n       two */\n}\nnext();'],
  ['multiline header', 'while (ok &&\n       more()) |\n    f();', 'while (ok &&\n       more()) {\n    f();|\n}'],
  ['attribute on nested if', 'while (ok) |\n    [[likely]] if (a) f();\n    else g();', 'while (ok) {\n    [[likely]] if (a) f();\n    else g();|\n}'],
  ['nested compound body', 'while (ok) |\n    for (;;) {\n        f();\n    }\nnext();', 'while (ok) {\n    for (;;) {\n        f();\n    }|\n}\nnext();'],
  ['try/catch as body', 'while (ok) |\n    try { f(); } catch (...) { g(); }\nnext();', 'while (ok) {\n    try { f(); } catch (...) { g(); }|\n}\nnext();'],
  ['body label', 'while (ok) |\n    retry: if (a) f(); else g();', 'while (ok) {\n    retry: if (a) f(); else g();|\n}']
];

for (const [name, before, after] of cases) {
  test(name, () => assert.equal(wrap(before), after));
}

const declines = [
  ['no body', 'while (ok) |'],
  ['same indentation', 'while (ok) |\nf();'],
  ['already a block', 'while (ok) |\n    { f(); }'],
  ['function definition', 'void f() |\n    g();'],
  ['function call', 'f() |\n    g();'],
  ['same line body', 'while (ok) |f();'],
  ['cursor inside condition', 'while (|ok)\n    f();'],
  ['comment header', '// while (ok) |\n    f();'],
  ['continued comment header', '// comment \\\nwhile (ok) |\n    f();'],
  ['block comment header', '/* while (ok) |\n    f(); */'],
  ['raw string header', 'auto s = R"(while (ok) |\n    f();)";'],
  ['macro header', '#define REPEAT while (ok) |\n    f();'],
  ['continued macro', '#define REPEAT \\\n    while (ok) |\n        f();'],
  ['directive between header and body', 'while (ok) |\n#if X\n    f();\n#endif'],
  ['directive inside body', 'while (ok) |\n    f(\n#if X\n      1\n#endif\n    );'],
  ['incomplete call', 'while (ok) |\n    f('],
  ['incomplete literal', 'while (ok) |\n    f("oops);'],
  ['incomplete block comment', 'while (ok) |\n    f(); /* oops'],
  ['two statements on one line', 'while (ok) |\n    f(); g();'],
  ['inline outer else', 'if (ok) |\n    f(); else g();'],
  ['mismatched delimiters', 'while (ok) |\n    f(];']
];

for (const [name, before] of declines) {
  test('preserve normal typing: ' + name, () => assert.equal(wrap(before), null));
}

test('bounded work on oversized files', () => {
  assert.equal(findWrapPlan('while (ok) \n    f();\n' + ' '.repeat(2 * 1024 * 1024), 11), null);
});
