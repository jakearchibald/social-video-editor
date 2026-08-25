import { BlobSource, Input, MP4 } from 'mediabunny';

import { getEmptyDirectory, ignoreNotFound } from './file';

const fingerprintFileName = 'fingerprint.txt';

interface Options {
  parentDir: FileSystemDirectoryHandle;
  /** Name of the directory the chunks live in. It's created if it doesn't exist. */
  dirName: string;
  /**
   * Describes what's being encoded. Chunks from a previous run are only reused if this matches,
   * otherwise they might not belong to the video being output.
   */
  fingerprint: unknown;
  /** How many frames each chunk of the video should contain, in order. */
  chunkFrameCounts: number[];
}

interface VideoChunkDir {
  dir: FileSystemDirectoryHandle;
  /** Chunks from a previous run that can be reused, starting at the first chunk. */
  completeChunks: FileSystemFileHandle[];
}

export function getChunkFileName(index: number) {
  return `chunk-${index}.mp4`;
}

/**
 * Opens the directory that encoded video chunks are written to, keeping the chunks a previous run
 * of the same output got through before it crashed, and discarding everything else.
 */
export async function openVideoChunkDir({
  parentDir,
  dirName,
  fingerprint,
  chunkFrameCounts,
}: Options): Promise<VideoChunkDir> {
  const fingerprintHash = await hash(JSON.stringify(fingerprint));
  const existingDir = await ignoreNotFound(
    parentDir.getDirectoryHandle(dirName)
  );

  if (
    !existingDir ||
    (await readTextFile(existingDir, fingerprintFileName)) !== fingerprintHash
  ) {
    const dir = await getEmptyDirectory(parentDir, dirName);
    await writeTextFile(dir, fingerprintFileName, fingerprintHash);
    return { dir, completeChunks: [] };
  }

  const completeChunks: FileSystemFileHandle[] = [];

  for (const [index, frameCount] of chunkFrameCounts.entries()) {
    const handle = await ignoreNotFound(
      existingDir.getFileHandle(getChunkFileName(index))
    );
    if (!handle) break;
    // The previous run may have crashed part-way through writing this chunk
    if (!(await hasFrames(await handle.getFile(), frameCount))) break;
    completeChunks.push(handle);
  }

  return { dir: existingDir, completeChunks };
}

/** Whether the file is an MP4 whose video track holds exactly `frameCount` frames. */
async function hasFrames(file: File, frameCount: number) {
  if (file.size === 0) return false;

  const input = new Input({ formats: [MP4], source: new BlobSource(file) });

  try {
    const track = await input.getPrimaryVideoTrack();
    if (!track) return false;
    const { packetCount } = await track.computePacketStats();
    return packetCount === frameCount;
  } catch {
    // An MP4 that was never finalised won't parse
    return false;
  } finally {
    input.dispose();
  }
}

async function hash(value: string) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value)
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function readTextFile(dir: FileSystemDirectoryHandle, name: string) {
  const handle = await ignoreNotFound(dir.getFileHandle(name));
  if (!handle) return null;
  return (await handle.getFile()).text();
}

async function writeTextFile(
  dir: FileSystemDirectoryHandle,
  name: string,
  content: string
) {
  const handle = await dir.getFileHandle(name, { create: true });
  const writable = await handle.createWritable();
  await writable.write(content);
  await writable.close();
}
