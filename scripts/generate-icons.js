import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Calculates CRC32 checksum for PNG chunks.
 * @param {Buffer} buf
 * @returns {number}
 */
function crc32(buf) {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }
  return (crc ^ -1) >>> 0;
}

/**
 * Creates a PNG chunk with length, type, data, and CRC.
 * @param {string} type
 * @param {Buffer} data
 * @returns {Buffer}
 */
function createChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);

  const crcPayload = Buffer.concat([typeBuf, data]);
  const crcVal = crc32(crcPayload);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crcVal, 0);

  return Buffer.concat([lenBuf, crcPayload, crcBuf]);
}

/**
 * Generates an RGBA PNG buffer representing a radar/eye icon.
 * @param {number} size
 * @returns {Buffer}
 */
function generatePng(size) {
  const header = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(size, 0);
  ihdrData.writeUInt32BE(size, 4);
  ihdrData.writeUInt8(8, 8);
  ihdrData.writeUInt8(6, 9);
  ihdrData.writeUInt8(0, 10);
  ihdrData.writeUInt8(0, 11);
  ihdrData.writeUInt8(0, 12);
  const ihdrChunk = createChunk('IHDR', ihdrData);

  const rawRows = [];
  const center = size / 2;
  const radius = size * 0.42;
  const innerRadius = size * 0.22;

  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 4);
    row[0] = 0;
    for (let x = 0; x < size; x++) {
      const dx = x + 0.5 - center;
      const dy = y + 0.5 - center;
      const dist = Math.hypot(dx, dy);
      const pixelOffset = 1 + x * 4;

      if (dist <= innerRadius) {
        row[pixelOffset] = 255;
        row[pixelOffset + 1] = 87;
        row[pixelOffset + 2] = 34;
        row[pixelOffset + 3] = 255;
        continue;
      }

      if (dist <= radius) {
        row[pixelOffset] = 37;
        row[pixelOffset + 1] = 99;
        row[pixelOffset + 2] = 235;
        row[pixelOffset + 3] = 255;
        continue;
      }

      row[pixelOffset] = 0;
      row[pixelOffset + 1] = 0;
      row[pixelOffset + 2] = 0;
      row[pixelOffset + 3] = 0;
    }
    rawRows.push(row);
  }

  const rawData = Buffer.concat(rawRows);
  const compressed = zlib.deflateSync(rawData);
  const idatChunk = createChunk('IDAT', compressed);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([header, ihdrChunk, idatChunk, iendChunk]);
}

/**
 * Entry point to write icon files.
 */
function main() {
  const iconsDir = path.resolve(__dirname, '../icons');
  const sizes = [16, 48, 128];

  for (const size of sizes) {
    const outPath = path.join(iconsDir, `icon${size}.png`);
    const pngBuf = generatePng(size);
    fs.writeFileSync(outPath, pngBuf);
  }
}

main();
