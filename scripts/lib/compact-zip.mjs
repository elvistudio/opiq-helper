import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { inflateRawSync } from 'node:zlib';

const endOfCentralDirectorySignature = 0x06054b50;
const centralDirectorySignature = 0x02014b50;
const localFileHeaderSignature = 0x04034b50;

const crcTable = Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit += 1) {
    crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return crc >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function findEndOfCentralDirectory(buffer) {
  const minimumOffset = Math.max(0, buffer.length - 65_557);
  for (let offset = buffer.length - 22; offset >= minimumOffset; offset -= 1) {
    if (buffer.readUInt32LE(offset) === endOfCentralDirectorySignature) return offset;
  }
  throw new Error('ZIP end-of-central-directory record was not found.');
}

function validateMemberName(name) {
  if (!name || path.posix.isAbsolute(name) || name.includes('\\')) {
    throw new Error(`ZIP member has an unsafe name: ${name || '<empty>'}`);
  }
  if (name.split('/').some((part) => part === '..')) {
    throw new Error(`ZIP member points outside the archive root: ${name}`);
  }
}

export async function readCompactZip(filePath) {
  const buffer = await readFile(filePath);
  const endOffset = findEndOfCentralDirectory(buffer);
  const diskNumber = buffer.readUInt16LE(endOffset + 4);
  const centralDirectoryDisk = buffer.readUInt16LE(endOffset + 6);
  const entriesOnDisk = buffer.readUInt16LE(endOffset + 8);
  const entryCount = buffer.readUInt16LE(endOffset + 10);
  const centralDirectorySize = buffer.readUInt32LE(endOffset + 12);
  const centralDirectoryOffset = buffer.readUInt32LE(endOffset + 16);

  if (diskNumber !== 0 || centralDirectoryDisk !== 0 || entriesOnDisk !== entryCount) {
    throw new Error('Multi-disk ZIP archives are not supported.');
  }
  if (entryCount === 0xffff || centralDirectorySize === 0xffffffff || centralDirectoryOffset === 0xffffffff) {
    throw new Error('ZIP64 archives are not supported.');
  }
  if (centralDirectoryOffset + centralDirectorySize > endOffset) {
    throw new Error('ZIP central directory points outside the archive.');
  }

  const entries = new Map();
  const memberMetadata = new Map();
  let cursor = centralDirectoryOffset;
  for (let index = 0; index < entryCount; index += 1) {
    if (cursor + 46 > buffer.length || buffer.readUInt32LE(cursor) !== centralDirectorySignature) {
      throw new Error(`ZIP central-directory entry ${index + 1} is invalid.`);
    }

    const flags = buffer.readUInt16LE(cursor + 8);
    const compressionMethod = buffer.readUInt16LE(cursor + 10);
    const expectedCrc = buffer.readUInt32LE(cursor + 16);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const uncompressedSize = buffer.readUInt32LE(cursor + 24);
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const localHeaderOffset = buffer.readUInt32LE(cursor + 42);
    const nameStart = cursor + 46;
    const nameEnd = nameStart + nameLength;

    if (nameEnd + extraLength + commentLength > buffer.length) {
      throw new Error(`ZIP central-directory entry ${index + 1} is truncated.`);
    }
    if (flags & 0x1) throw new Error('Encrypted ZIP members are not supported.');
    if (![0, 8].includes(compressionMethod)) {
      throw new Error(`Unsupported ZIP compression method ${compressionMethod}.`);
    }

    const name = buffer.toString('utf8', nameStart, nameEnd);
    validateMemberName(name);
    if (entries.has(name)) throw new Error(`ZIP contains duplicate member name: ${name}`);

    if (
      localHeaderOffset + 30 > buffer.length
      || buffer.readUInt32LE(localHeaderOffset) !== localFileHeaderSignature
    ) {
      throw new Error(`ZIP member ${name} has an invalid local header.`);
    }

    const localNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28);
    const localNameStart = localHeaderOffset + 30;
    const localNameEnd = localNameStart + localNameLength;
    const dataStart = localNameEnd + localExtraLength;
    const dataEnd = dataStart + compressedSize;
    if (dataEnd > buffer.length) throw new Error(`ZIP member ${name} is truncated.`);

    const localName = buffer.toString('utf8', localNameStart, localNameEnd);
    if (localName !== name) throw new Error(`ZIP member name mismatch for ${name}.`);

    const compressed = buffer.subarray(dataStart, dataEnd);
    const contents = compressionMethod === 0 ? Buffer.from(compressed) : inflateRawSync(compressed);
    if (contents.length !== uncompressedSize) {
      throw new Error(`ZIP member ${name} has an invalid uncompressed size.`);
    }
    if (crc32(contents) !== expectedCrc) {
      throw new Error(`ZIP member ${name} failed its CRC-32 check.`);
    }

    entries.set(name, contents);
    memberMetadata.set(name, {
      compression_method: compressionMethod,
      compressed_size: compressedSize,
      uncompressed_size: uncompressedSize,
      crc32: expectedCrc.toString(16).padStart(8, '0'),
    });
    cursor = nameEnd + extraLength + commentLength;
  }

  if (cursor !== centralDirectoryOffset + centralDirectorySize) {
    throw new Error('ZIP central-directory size does not match its entries.');
  }

  return { entries, entryCount, memberMetadata };
}

export function requireZipMember(archive, name) {
  const member = archive.entries.get(name);
  if (!member) throw new Error(`ZIP is missing required member ${name}.`);
  return member;
}

export function readZipText(archive, name) {
  return requireZipMember(archive, name).toString('utf8');
}
