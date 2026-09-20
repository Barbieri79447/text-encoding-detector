/**
 * Encoding values returned by detectEncoding.
 */
export const Encoding = Object.freeze({
  ASCII: 'ascii',
  UTF8: 'utf-8',
  UTF16LE: 'utf-16le',
  UTF16BE: 'utf-16be',
  LATIN1: 'latin1'
});

/**
 * Detect the text encoding of a Uint8Array buffer.
 *
 * The detector first looks for a byte order mark. If none is present it samples
 * the buffer for byte patterns that are impossible in UTF-8 but common in
 * Latin-1, and distinguishes ASCII from UTF-8 by checking for multi-byte
 * sequences. UTF-16 without a BOM is detected only when null bytes are present
 * in a pattern consistent with one of the two byte orders.
 *
 * @param {Uint8Array} bytes
 * @returns {string} One of the Encoding values.
 */
export function detectEncoding(bytes) {
  if (!(bytes instanceof Uint8Array)) {
    throw new TypeError('detectEncoding expects a Uint8Array');
  }

  if (bytes.length === 0) {
    return Encoding.ASCII;
  }

  // BOM checks first; BOMs are authoritative.
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return Encoding.UTF8;
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return Encoding.UTF16LE;
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return Encoding.UTF16BE;
  }

  // UTF-16 without BOM: look for even/odd null byte patterns.
  const utf16 = detectUtf16WithoutBom(bytes);
  if (utf16 !== null) {
    return utf16;
  }

  // Try to validate as UTF-8. If valid and contains a multi-byte sequence,
  // it is UTF-8; if valid with only single-byte characters, it is ASCII.
  const utf8Result = validateUtf8(bytes);
  if (utf8Result.valid) {
    return utf8Result.hasMultibyte ? Encoding.UTF8 : Encoding.ASCII;
  }

  // Not valid UTF-8 and no UTF-16 signature: treat as Latin-1.
  return Encoding.LATIN1;
}

/**
 * Detect UTF-16LE/BE without BOM by scanning for null bytes.
 *
 * The heuristic requires at least one null byte. It then decides byte order
 * based on whether nulls are predominantly at even or odd offsets. If the
 * evidence is ambiguous, UTF-16LE is chosen because it is the more common
 * byte order on consumer hardware.
 *
 * @param {Uint8Array} bytes
 * @returns {string|null}
 */
function detectUtf16WithoutBom(bytes) {
  if (bytes.length < 2) {
    return null;
  }

  let evenNulls = 0;
  let oddNulls = 0;

  for (let i = 0; i < bytes.length; i += 1) {
    if (bytes[i] === 0) {
      if (i % 2 === 0) {
        evenNulls += 1;
      } else {
        oddNulls += 1;
      }
    }
  }

  if (evenNulls === 0 && oddNulls === 0) {
    return null;
  }

  // A UTF-16LE encoded ASCII character has nulls at odd offsets.
  // A UTF-16BE encoded ASCII character has nulls at even offsets.
  if (oddNulls > evenNulls) {
    return Encoding.UTF16LE;
  }
  if (evenNulls > oddNulls) {
    return Encoding.UTF16BE;
  }

  // Tie: prefer UTF-16LE, the common case.
  return Encoding.UTF16LE;
}

/**
 * Validate a byte array as UTF-8.
 *
 * The implementation follows RFC 3629 strictly: overlong forms, surrogate
 * code points, and values above U+10FFFF are rejected. Short sequences at
 * the end of the buffer are also rejected.
 *
 * @param {Uint8Array} bytes
 * @returns {{valid: boolean, hasMultibyte: boolean}}
 */
function validateUtf8(bytes) {
  let hasMultibyte = false;
  let i = 0;

  while (i < bytes.length) {
    const b = bytes[i];

    if (b <= 0x7f) {
      i += 1;
      continue;
    }

    hasMultibyte = true;

    let length;
    let minCodePoint;
    if (b >= 0xc2 && b <= 0xdf) {
      length = 2;
      minCodePoint = 0x80;
    } else if (b >= 0xe0 && b <= 0xef) {
      length = 3;
      minCodePoint = 0x800;
    } else if (b >= 0xf0 && b <= 0xf4) {
      length = 4;
      minCodePoint = 0x10000;
    } else {
      return { valid: false, hasMultibyte };
    }

    if (i + length > bytes.length) {
      return { valid: false, hasMultibyte };
    }

    // Continuation bytes must match 10xxxxxx.
    for (let j = 1; j < length; j += 1) {
      if ((bytes[i + j] & 0xc0) !== 0x80) {
        return { valid: false, hasMultibyte };
      }
    }

    // Reject overlong encodings and surrogate code points.
    const codePoint = decodeUtf8CodePoint(bytes, i, length);
    if (codePoint < minCodePoint) {
      return { valid: false, hasMultibyte };
    }
    if (codePoint >= 0xd800 && codePoint <= 0xdfff) {
      return { valid: false, hasMultibyte };
    }
    if (codePoint > 0x10ffff) {
      return { valid: false, hasMultibyte };
    }

    i += length;
  }

  return { valid: true, hasMultibyte };
}

/**
 * Decode a UTF-8 code point from a validated multi-byte sequence.
 *
 * @param {Uint8Array} bytes
 * @param {number} start Index of the leading byte.
 * @param {number} length Total length of the sequence.
 * @returns {number}
 */
function decodeUtf8CodePoint(bytes, start, length) {
  if (length === 2) {
    return ((bytes[start] & 0x1f) << 6) | (bytes[start + 1] & 0x3f);
  }
  if (length === 3) {
    return ((bytes[start] & 0x0f) << 12) | ((bytes[start + 1] & 0x3f) << 6) | (bytes[start + 2] & 0x3f);
  }
  return (
    ((bytes[start] & 0x07) << 18) |
    ((bytes[start + 1] & 0x3f) << 12) |
    ((bytes[start + 2] & 0x3f) << 6) |
    (bytes[start + 3] & 0x3f)
  );
}
