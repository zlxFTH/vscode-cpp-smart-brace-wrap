'use strict';

// Indentation determines the block to wrap. The bounded lexer and statement
// reader keep literals, comments and attached control clauses intact.
const MAX_LENGTH = 2 * 1024 * 1024;
const MAX_DEPTH = 128;
const PAIRS = { '(': ')', '[': ']', '{': '}' };

function logicalLineEnd(text, start) {
  let i = start;
  for (;;) {
    const newline = text.indexOf('\n', i);
    if (newline < 0) return text.length;
    const before = newline - (text[newline - 1] === '\r' ? 1 : 0);
    if (text[before - 1] !== '\\') return before;
    i = newline + 1;
  }
}

function tokenize(text) {
  const tokens = [];
  let i = 0;
  while (i < text.length) {
    const start = i;
    const ch = text[i];
    if (/\s/.test(ch)) { i++; continue; }
    if (ch === '#' && /^[ \t]*$/.test(text.slice(text.lastIndexOf('\n', i - 1) + 1, i))) {
      do {
        const newline = text.indexOf('\n', i);
        i = newline < 0 ? text.length : newline + 1;
      } while (i < text.length && /\\\r?\n$/.test(text.slice(start, i)));
      tokens.push({ kind: 'directive', value: '#', start, end: i });
      continue;
    }
    if (text.startsWith('//', i)) {
      i = logicalLineEnd(text, i + 2);
      tokens.push({ kind: 'lineComment', start, end: i });
      continue;
    }
    if (text.startsWith('/*', i)) {
      const close = text.indexOf('*/', i + 2);
      i = close < 0 ? text.length : close + 2;
      tokens.push({ kind: 'comment', start, end: i, closed: close >= 0 });
      continue;
    }
    // Raw strings can contain quotes, braces, newlines and semicolons.
    const raw = /^(?:u8|u|U|L)?R"([^\s()\\]{0,16})\(/.exec(text.slice(i, i + 24));
    if (raw) {
      const terminator = ')' + raw[1] + '"';
      const close = text.indexOf(terminator, i + raw[0].length);
      i = close < 0 ? text.length : close + terminator.length;
      tokens.push({ kind: 'literal', value: 'literal', start, end: i, closed: close >= 0 });
      continue;
    }
    // Numeric digit separators are not character literals: 1'000, 0xAB'CD.
    if (/\d/.test(ch) || (ch === '.' && /\d/.test(text[i + 1] || ''))) {
      i++;
      while (i < text.length && /[\w.']/.test(text[i])) i++;
      tokens.push({ kind: 'number', value: text.slice(start, i), start, end: i });
      continue;
    }
    if (ch === '"' || ch === "'") {
      const quote = ch;
      let closed = false;
      i++;
      while (i < text.length) {
        if (text[i] === '\\') { i += 2; continue; }
        if (text[i++] === quote) { closed = true; break; }
        if (text[i - 1] === '\n') break;
      }
      i = Math.min(i, text.length);
      tokens.push({ kind: 'literal', value: 'literal', start, end: i, closed });
      continue;
    }
    if (/[A-Za-z_$\u0080-\uffff]/.test(ch)) {
      i++;
      while (i < text.length && /[\w$\u0080-\uffff]/.test(text[i])) i++;
      tokens.push({ kind: 'word', value: text.slice(start, i), start, end: i });
      continue;
    }
    i += text.startsWith('::', i) ? 2 : 1;
    tokens.push({ kind: 'punctuation', value: text.slice(start, i), start, end: i });
  }
  return tokens;
}

function balanced(tokens, start) {
  const stack = [];
  for (let i = start; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.kind === 'directive' || token.closed === false) return null;
    const value = token.value;
    if (PAIRS[value]) {
      stack.push(PAIRS[value]);
      if (stack.length > MAX_DEPTH) return null;
    } else if (value === ')' || value === ']' || value === '}') {
      if (stack.pop() !== value) return null;
      if (stack.length === 0) return i + 1;
    }
  }
  return null;
}

function conditionEnd(tokens, start) {
  let i = start + 1;
  if (tokens[start].value === 'if' && tokens[i]?.value === 'constexpr') i++;
  return tokens[i]?.value === '(' ? balanced(tokens, i) : null;
}

function statementEnd(tokens, start, depth = 0) {
  if (depth > MAX_DEPTH || !tokens[start] || tokens[start].kind === 'directive') return null;
  let i = start;
  // Attributes on a statement must not hide an if/else or a loop from dispatch.
  while (tokens[i]?.value === '[' && tokens[i + 1]?.value === '[') {
    i = balanced(tokens, i);
    if (i === null) return null;
  }
  const value = tokens[i]?.value;
  if (!value || ['}', 'else', 'catch', 'case', 'default'].includes(value)) return null;
  if (value === '{') return balanced(tokens, i);
  if (['if', 'for', 'while', 'switch'].includes(value)) {
    const body = conditionEnd(tokens, i);
    if (body === null) return null;
    const end = statementEnd(tokens, body, depth + 1);
    if (end === null) return null;
    if (value === 'if' && tokens[end]?.value === 'else') {
      return statementEnd(tokens, end + 1, depth + 1);
    }
    return end;
  }
  if (value === 'do') {
    const bodyEnd = statementEnd(tokens, i + 1, depth + 1);
    if (bodyEnd === null || tokens[bodyEnd]?.value !== 'while') return null;
    const end = conditionEnd(tokens, bodyEnd);
    return end !== null && tokens[end]?.value === ';' ? end + 1 : null;
  }
  if (value === 'try') {
    if (tokens[i + 1]?.value !== '{') return null;
    let end = balanced(tokens, i + 1);
    if (end === null || tokens[end]?.value !== 'catch') return null;
    do {
      if (tokens[end + 1]?.value !== '(') return null;
      const body = balanced(tokens, end + 1);
      if (body === null || tokens[body]?.value !== '{') return null;
      end = balanced(tokens, body);
      if (end === null) return null;
    } while (tokens[end]?.value === 'catch');
    return end;
  }
  if (tokens[i]?.kind === 'word' && tokens[i + 1]?.value === ':') {
    return statementEnd(tokens, i + 2, depth + 1);
  }
  for (; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.kind === 'directive' || token.closed === false) return null;
    if (token.value === ';') return i + 1;
    if (token.value === '}' || token.value === ')' || token.value === ']') return null;
    if (PAIRS[token.value]) {
      const end = balanced(tokens, i);
      if (end === null) return null;
      i = end - 1;
    }
  }
  return null;
}

function lineStart(text, offset) {
  return text.lastIndexOf('\n', offset - 1) + 1;
}

function indentation(text, offset) {
  return /^[ \t]*/.exec(text.slice(lineStart(text, offset)))[0];
}

function width(indent, tabSize) {
  let column = 0;
  for (const ch of indent) column += ch === '\t' ? tabSize - column % tabSize : 1;
  return column;
}

// Find the draft's indentation block before looking for a terminating semicolon.
// Otherwise a missing semicolon could make the reader consume an outer statement.
function indentedEnd(text, bodyStart, headerWidth, tabSize, allTokens) {
  let start = lineStart(text, bodyStart);
  let end = start;
  let tokenIndex = 0;
  let coveredUntil = 0;
  const delimiters = [];
  while (start < text.length) {
    const newline = text.indexOf('\n', start);
    const nextLine = newline < 0 ? text.length : newline + 1;
    const contentEnd = newline < 0 ? text.length : newline - (text[newline - 1] === '\r' ? 1 : 0);
    const line = text.slice(start, contentEnd);
    while (allTokens[tokenIndex]?.start < start) {
      const token = allTokens[tokenIndex++];
      if (['literal', 'comment', 'lineComment'].includes(token.kind)) {
        coveredUntil = Math.max(coveredUntil, token.end);
      }
      if (token.start >= bodyStart) {
        if (PAIRS[token.value]) delimiters.push(PAIRS[token.value]);
        else if ([')', ']', '}'].includes(token.value)) delimiters.pop();
      }
    }
    // Multiline calls, literals and comments can contain dedented lines. Their
    // closing delimiters still belong to the statement being wrapped.
    const continuation = coveredUntil > start || delimiters.length > 0;
    if (line.trim()) {
      if (!continuation && width(/^[ \t]*/.exec(line)[0], tabSize) <= headerWidth) break;
      end = contentEnd;
    }
    start = nextLine;
  }
  return end;
}

function canWrapBlock(tokens) {
  if (!tokens.length || ['}', 'else', 'catch', 'case', 'default'].includes(tokens[0].value)) return false;
  const stack = [];
  for (const token of tokens) {
    if (token.kind === 'directive' || token.closed === false) return false;
    if (PAIRS[token.value]) {
      stack.push(PAIRS[token.value]);
      if (stack.length > MAX_DEPTH) return false;
    } else if ([')', ']', '}'].includes(token.value) && stack.pop() !== token.value) {
      return false;
    }
  }
  return stack.length === 0;
}

function headerStart(tokens, index) {
  if (['else', 'do'].includes(tokens[index]?.value)) return index;
  if (tokens[index]?.value !== ')') return null;
  let depth = 0;
  for (let i = index; i >= 0; i--) {
    if (tokens[i].value === ')') depth++;
    if (tokens[i].value === '(' && --depth === 0) {
      let keyword = i - 1;
      if (tokens[keyword]?.value === 'constexpr') keyword--;
      return ['if', 'for', 'while'].includes(tokens[keyword]?.value) ? keyword : null;
    }
    if (tokens[i].kind === 'directive') return null;
  }
  return null;
}

function findWrapPlan(text, offset, { tabSize = 4 } = {}) {
  if (text.length > MAX_LENGTH || !Number.isInteger(offset) || offset <= 0 || offset > text.length) return null;
  const newline = text.indexOf('\n', offset);
  const restOfLine = text.slice(offset, newline < 0 ? text.length : newline);
  if (!/^[ \t\r]*$/.test(restOfLine)) return null;

  const allTokens = tokenize(text);
  // Never interpret source-looking text inside a comment, literal or directive.
  if (allTokens.some(t => t.start < offset &&
      (t.end > offset || (t.end === offset && (t.kind === 'lineComment' || t.closed === false))) &&
      ['lineComment', 'comment', 'literal', 'directive'].includes(t.kind))) return null;
  const tokens = allTokens.filter(t => t.kind !== 'lineComment' && t.kind !== 'comment');
  const bodyIndex = tokens.findIndex(t => t.start >= offset);
  if (bodyIndex <= 0 || tokens[bodyIndex].value === '{' || tokens[bodyIndex].kind === 'directive') return null;
  const headerIndex = headerStart(tokens, bodyIndex - 1);
  if (headerIndex === null) return null;
  const bodyStart = tokens[bodyIndex].start;
  if (lineStart(text, bodyStart) <= lineStart(text, offset)) return null;
  const indent = indentation(text, tokens[headerIndex].start);
  if (width(indentation(text, bodyStart), tabSize) <= width(indent, tabSize)) return null;
  // A directive hidden among otherwise-skipped comments still prevents wrapping.
  if (tokens.slice(headerIndex, bodyIndex).some(t => t.kind === 'directive')) return null;
  const blockEnd = indentedEnd(text, bodyStart, width(indent, tabSize), tabSize, allTokens);
  let blockTokenEnd = bodyIndex;
  while (blockTokenEnd < tokens.length && tokens[blockTokenEnd].start < blockEnd) blockTokenEnd++;
  const bodyTokens = tokens.slice(bodyIndex, blockTokenEnd);
  if (!canWrapBlock(bodyTokens)) return null;
  // Keep comments intact; never put the closing brace inside an open comment,
  // literal or preprocessor directive, or split a token at the block boundary.
  if (allTokens.some(t => t.start >= offset && t.start < blockEnd &&
      (t.kind === 'directive' || t.closed === false || t.end > blockEnd))) return null;
  // An outer else/catch sharing the body's line cannot be moved inside braces.
  // Other statements at the same deeper indentation are intentionally included.
  const complete = statementEnd(bodyTokens, 0);
  if (complete !== null && ['else', 'catch'].includes(bodyTokens[complete]?.value)) return null;
  const bodyEnd = bodyTokens[bodyTokens.length - 1].end;
  const end = blockEnd;
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const opening = /[ \t]/.test(text[offset - 1]) ? '{' : ' {';
  const replacement = opening + text.slice(offset, end) + eol + indent + '}';
  return { start: offset, end, replacement, caret: opening.length + bodyEnd - offset };
}

module.exports = { findWrapPlan };
