export async function getFile(
  projectDir: FileSystemDirectoryHandle,
  source: string
) {
  const path = new URL(source, 'https://example.com/').pathname.slice(1);
  const splitPath = path.split('/');
  const dirPaths = splitPath.slice(0, -1);
  const fileName = splitPath.at(-1)!;
  const dirHandle = await getDirectory(projectDir, dirPaths.join('/'));
  const fileHandle = await dirHandle.getFileHandle(fileName);
  return fileHandle.getFile();
}

export async function getDirectory(
  projectDir: FileSystemDirectoryHandle,
  source: string
) {
  const path = new URL(source, 'https://example.com/').pathname.slice(1);
  const splitPath = path.split('/');

  let dirHandle = projectDir;
  for (const dirPath of splitPath) {
    dirHandle = await dirHandle.getDirectoryHandle(dirPath);
  }

  return dirHandle;
}

export async function getEmptyDirectory(
  parentDir: FileSystemDirectoryHandle,
  name: string
) {
  await ignoreNotFound(parentDir.removeEntry(name, { recursive: true }));
  return parentDir.getDirectoryHandle(name, { create: true });
}

/** Resolves with null if the file system operation failed because an entry didn't exist. */
export async function ignoreNotFound<T>(promise: Promise<T>): Promise<T | null> {
  try {
    return await promise;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'NotFoundError') return null;
    throw err;
  }
}
