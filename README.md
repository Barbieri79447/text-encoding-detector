# text-encoding-detector

Detects the character encoding of a byte buffer among UTF-8, UTF-16LE, UTF-16BE, Latin-1, and ASCII.

## Usage

```js
import { detectEncoding, Encoding } from 'text-encoding-detector';

const bytes = new Uint8Array([0x48, 0x69]); // 'Hi'
const encoding = detectEncoding(bytes);

if (encoding === Encoding.ASCII) {
  console.log('Buffer is ASCII');
}
```

The package exports two names: `detectEncoding` and `Encoding`.

## Why this library exists

Reading a file as text requires knowing its encoding, but many files do not carry that information. This library makes a practical guess from the bytes themselves. The trade-off is that detection without a BOM is a heuristic, not a proof. UTF-8 is validated strictly; invalid UTF-8 falls back to Latin-1 because that is the most common single-byte legacy encoding on the web. UTF-16 without a BOM is detected only when null bytes reveal a consistent byte order.

## Edge cases

A buffer containing only ASCII bytes is reported as ASCII, not UTF-8. A buffer that is valid UTF-8 but contains only single-byte characters is also ASCII. A buffer with an equal number of even and odd null bytes and no BOM is reported as UTF-16LE, because that byte order is more common. Empty input is reported as ASCII.

## Design notes

The window stores values eagerly rather than keeping running aggregates. Running
sums drift with floating point over long streams, and recomputing from a small
buffer is cheap enough that the drift is not worth the speed.

