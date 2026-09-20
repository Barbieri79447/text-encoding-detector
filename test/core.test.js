import { test } from 'node:test';
import assert from 'node:assert/strict';

import { detectEncoding, Encoding } from '../src/index.js';

function bytesFromArray(arr) {
  return new Uint8Array(arr);
}

function utf16le(str) {
  const units = [];
  for (const ch of str) {
    const code = ch.codePointAt(0);
    if (code <= 0xffff) {
      units.push(code & 0xff, code >> 8);
    } else {
      const adjusted = code - 0x10000;
      const high = 0xd800 + (adjusted >> 10);
      const low = 0xdc00 + (adjusted & 0x3ff);
      units.push(high & 0xff, high >> 8, low & 0xff, low >> 8);
    }
  }
  return bytesFromArray(units);
}

function utf16be(str) {
  const units = [];
  for (const ch of str) {
    const code = ch.codePointAt(0);
    if (code <= 0xffff) {
      units.push(code >> 8, code & 0xff);
    } else {
      const adjusted = code - 0x10000;
      const high = 0xd800 + (adjusted >> 10);
      const low = 0xdc00 + (adjusted & 0x3ff);
      units.push(high >> 8, high & 0xff, low >> 8, low & 0xff);
    }
  }
  return bytesFromArray(units);
}

function utf8(str) {
  return bytesFromArray([...new TextEncoder().encode(str)]);
}

function latin1(str) {
  const bytes = [];
  for (let i = 0; i < str.length; i += 1) {
    const code = str.charCodeAt(i);
    if (code > 0xff) {
      throw new Error('latin1 test helper only supports code points <= 0xff');
    }
    bytes.push(code);
  }
  return bytesFromArray(bytes);
}

test('empty buffer is ASCII', () => {
  assert.equal(detectEncoding(new Uint8Array(0)), Encoding.ASCII);
});

test('plain ASCII text', () => {
  const bytes = utf8('Hello, world!');
  assert.equal(detectEncoding(bytes), Encoding.ASCII);
});

test('UTF-8 BOM is detected', () => {
  const bytes = bytesFromArray([0xef, 0xbb, 0xbf, 0x68, 0x69]);
  assert.equal(detectEncoding(bytes), Encoding.UTF8);
});

test('UTF-8 without BOM but with multi-byte characters', () => {
  const bytes = utf8('café');
  assert.equal(detectEncoding(bytes), Encoding.UTF8);
});

test('UTF-16LE BOM is detected', () => {
  const bytes = bytesFromArray([0xff, 0xfe, 0x68, 0x00, 0x69, 0x00]);
  assert.equal(detectEncoding(bytes), Encoding.UTF16LE);
});

test('UTF-16BE BOM is detected', () => {
  const bytes = bytesFromArray([0xfe, 0xff, 0x00, 0x68, 0x00, 0x69]);
  assert.equal(detectEncoding(bytes), Encoding.UTF16BE);
});

test('UTF-16LE without BOM but with null bytes at odd offsets', () => {
  const bytes = utf16le('hi');
  assert.equal(detectEncoding(bytes), Encoding.UTF16LE);
});

test('UTF-16BE without BOM but with null bytes at even offsets', () => {
  const bytes = utf16be('hi');
  assert.equal(detectEncoding(bytes), Encoding.UTF16BE);
});

test('Latin-1 with invalid UTF-8 byte 0xE9', () => {
  const bytes = latin1('café');
  assert.equal(detectEncoding(bytes), Encoding.LATIN1);
});

test('Latin-1 with 0x80 invalid UTF-8 start byte', () => {
  const bytes = bytesFromArray([0x48, 0x80, 0x6c]);
  assert.equal(detectEncoding(bytes), Encoding.LATIN1);
});

test('rejects overlong UTF-8 sequence as Latin-1', () => {
  const bytes = bytesFromArray([0xc0, 0xaf]);
  assert.equal(detectEncoding(bytes), Encoding.LATIN1);
});

test('rejects surrogate code point encoded in UTF-8 as Latin-1', () => {
  const bytes = bytesFromArray([0xed, 0xa0, 0x80]);
  assert.equal(detectEncoding(bytes), Encoding.LATIN1);
});

test('rejects code point above U+10FFFF as Latin-1', () => {
  const bytes = bytesFromArray([0xf4, 0x90, 0x80, 0x80]);
  assert.equal(detectEncoding(bytes), Encoding.LATIN1);
});

test('rejects truncated UTF-8 sequence as Latin-1', () => {
  const bytes = bytesFromArray([0xe2, 0x82]);
  assert.equal(detectEncoding(bytes), Encoding.LATIN1);
});

test('UTF-16LE with non-ASCII characters', () => {
  const bytes = utf16le('h€llo');
  assert.equal(detectEncoding(bytes), Encoding.UTF16LE);
});

test('UTF-16BE with non-ASCII characters', () => {
  const bytes = utf16be('h€llo');
  assert.equal(detectEncoding(bytes), Encoding.UTF16BE);
});

test('throws TypeError for non-Uint8Array input', () => {
  assert.throws(() => detectEncoding('not bytes'), TypeError);
  assert.throws(() => detectEncoding([0x68, 0x69]), TypeError);
});
