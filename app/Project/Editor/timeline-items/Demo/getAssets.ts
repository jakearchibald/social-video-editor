import { getDirectory } from '../../../../utils/file';

export async function getAssets(
  projectDir: FileSystemDirectoryHandle,
  path: string
): Promise<Record<string, string>> {
  const dir = await getDirectory(projectDir, path);
  const assets: Record<string, string> = {};

  async function walkDirectory(
    dirHandle: FileSystemDirectoryHandle,
    path = ''
  ): Promise<void> {
    for await (const entry of dirHandle.values()) {
      const entryPath = path ? `${path}/${entry.name}` : entry.name;

      if (entry.kind === 'file') {
        const file = await entry.getFile();
        const objectUrl = URL.createObjectURL(file);
        assets[entryPath] = objectUrl;
      } else if (entry.kind === 'directory') {
        await walkDirectory(entry, entryPath);
      }
    }
  }

  await walkDirectory(dir);
  return assets;
}
