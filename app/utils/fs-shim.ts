/**
 * A partial File System Access API implementation backed by the dev server's fs-shim plugin, for
 * browsers that can't give pages handles to real directories. It's only installed where
 * `showDirectoryPicker` is missing.
 */

const base = '/@fs-shim/';

const mimeTypes: Record<string, string> = {
  avif: 'image/avif',
  css: 'text/css',
  gif: 'image/gif',
  html: 'text/html',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  js: 'text/javascript',
  json: 'application/json',
  md: 'text/markdown',
  mjs: 'text/javascript',
  mov: 'video/quicktime',
  mp3: 'audio/mpeg',
  mp4: 'video/mp4',
  png: 'image/png',
  svg: 'image/svg+xml',
  txt: 'text/plain',
  vtt: 'text/vtt',
  wav: 'audio/wav',
  webm: 'video/webm',
  webp: 'image/webp',
};

async function call(
  action: string,
  params: Record<string, string | number>,
  init?: RequestInit,
) {
  const url = new URL(base + action, location.href);
  for (const [key, value] of Object.entries(params))
    url.searchParams.set(key, String(value));

  const response = await fetch(url, { method: 'POST', ...init });
  if (response.ok) return response;

  const error = await response.json().catch(() => ({}));
  throw new DOMException(
    error.message ?? response.statusText,
    error.name ?? 'UnknownError',
  );
}

async function callJSON<T>(
  action: string,
  params: Record<string, string | number>,
): Promise<T> {
  return (await call(action, params)).json();
}

interface Stat {
  kind: 'file' | 'directory';
  size: number;
  lastModified: number;
}

async function statOrNull(path: string) {
  try {
    return await callJSON<Stat>('stat', { path });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'NotFoundError')
      return null;
    throw err;
  }
}

function joinPath(dir: string, name: string) {
  if (!name || name === '.' || name === '..' || /[/\\]/.test(name))
    throw new TypeError(`Invalid name: ${name}`);
  return dir ? `${dir}/${name}` : name;
}

class ShimHandle {
  readonly kind: 'file' | 'directory';
  readonly name: string;
  /** Path relative to the dev server's fs-shim root. */
  readonly fsShimPath: string;

  constructor(kind: 'file' | 'directory', path: string) {
    this.kind = kind;
    this.fsShimPath = path;
    this.name = path.split('/').at(-1) || 'root';
  }

  async isSameEntry(other: unknown) {
    return (
      other instanceof ShimHandle &&
      other.kind === this.kind &&
      other.fsShimPath === this.fsShimPath
    );
  }

  async queryPermission(): Promise<PermissionState> {
    return 'granted';
  }

  async requestPermission(): Promise<PermissionState> {
    return 'granted';
  }
}

const fileCache = new Map<string, { key: string; file: File }>();

class ShimFileHandle extends ShimHandle {
  declare readonly kind: 'file';

  constructor(path: string) {
    super('file', path);
  }

  async getFile() {
    const stat = await statOrNull(this.fsShimPath);
    if (!stat || stat.kind !== 'file')
      throw new DOMException('File not found', 'NotFoundError');

    const cacheKey = `${stat.size}-${stat.lastModified}`;
    const cached = fileCache.get(this.fsShimPath);
    if (cached?.key === cacheKey) return cached.file;

    const blob = await (
      await call('read', { path: this.fsShimPath }, { method: 'GET' })
    ).blob();
    const extension = this.name.split('.').at(-1)!.toLowerCase();
    const file = new File([blob], this.name, {
      lastModified: stat.lastModified,
      type: mimeTypes[extension] ?? '',
    });
    fileCache.set(this.fsShimPath, { key: cacheKey, file });
    return file;
  }

  async createWritable({ keepExistingData = false } = {}) {
    const { id } = await callJSON<{ id: string }>('writable-open', {
      path: this.fsShimPath,
      keepExistingData: keepExistingData ? 1 : 0,
    });
    return new ShimWritableFileStream(id);
  }
}

type WriteData = BufferSource | Blob | string;
type WriteChunk =
  | WriteData
  | { type: 'write'; data: WriteData; position?: number | null }
  | { type: 'seek'; position: number }
  | { type: 'truncate'; size: number };

function isCommand(chunk: WriteChunk): chunk is Exclude<WriteChunk, WriteData> {
  return (
    typeof chunk === 'object' &&
    !(chunk instanceof Blob) &&
    !ArrayBuffer.isView(chunk) &&
    !(chunk instanceof ArrayBuffer) &&
    'type' in chunk
  );
}

class ShimWritableFileStream extends WritableStream<WriteChunk> {
  constructor(id: string) {
    let position = 0;

    super({
      async write(chunk) {
        if (isCommand(chunk)) {
          if (chunk.type === 'seek') {
            position = chunk.position;
            return;
          }
          if (chunk.type === 'truncate') {
            await call('writable-truncate', { id, size: chunk.size });
            position = Math.min(position, chunk.size);
            return;
          }
          if (chunk.position != null) position = chunk.position;
          chunk = chunk.data;
        }

        const body =
          typeof chunk === 'string' ? new TextEncoder().encode(chunk) : chunk;
        const byteLength = body instanceof Blob ? body.size : body.byteLength;
        await call('writable-write', { id, position }, { body });
        position += byteLength;
      },
      async close() {
        await call('writable-close', { id });
      },
      async abort() {
        await call('writable-abort', { id });
      },
    });
  }

  async write(data: WriteChunk) {
    const writer = this.getWriter();
    try {
      await writer.write(data);
    } finally {
      writer.releaseLock();
    }
  }

  seek(position: number) {
    return this.write({ type: 'seek', position });
  }

  truncate(size: number) {
    return this.write({ type: 'truncate', size });
  }
}

class ShimDirectoryHandle extends ShimHandle {
  declare readonly kind: 'directory';

  constructor(path: string) {
    super('directory', path);
  }

  async #getChild(
    name: string,
    kind: 'file' | 'directory',
    create: boolean,
  ): Promise<string> {
    const path = joinPath(this.fsShimPath, name);
    const stat = await statOrNull(path);

    if (stat) {
      if (stat.kind !== kind)
        throw new DOMException(`${name} is not a ${kind}`, 'TypeMismatchError');
      return path;
    }

    if (!create) throw new DOMException(`${name} not found`, 'NotFoundError');
    await call(kind === 'file' ? 'touch' : 'mkdir', { path });
    return path;
  }

  async getFileHandle(name: string, { create = false } = {}) {
    return new ShimFileHandle(await this.#getChild(name, 'file', create));
  }

  async getDirectoryHandle(name: string, { create = false } = {}) {
    return new ShimDirectoryHandle(
      await this.#getChild(name, 'directory', create),
    );
  }

  async removeEntry(name: string, { recursive = false } = {}) {
    await call('remove', {
      path: joinPath(this.fsShimPath, name),
      recursive: recursive ? 1 : 0,
    });
  }

  async resolve(possibleDescendant: ShimHandle) {
    const prefix = this.fsShimPath ? `${this.fsShimPath}/` : '';
    if (!possibleDescendant.fsShimPath.startsWith(prefix)) return null;
    return possibleDescendant.fsShimPath.slice(prefix.length).split('/');
  }

  async *entries(): AsyncGenerator<
    [string, ShimFileHandle | ShimDirectoryHandle]
  > {
    const list = await callJSON<{ name: string; kind: 'file' | 'directory' }[]>(
      'list',
      { path: this.fsShimPath },
    );
    for (const { name, kind } of list) {
      const path = joinPath(this.fsShimPath, name);
      yield [
        name,
        kind === 'file'
          ? new ShimFileHandle(path)
          : new ShimDirectoryHandle(path),
      ];
    }
  }

  async *keys() {
    for await (const [name] of this.entries()) yield name;
  }

  async *values() {
    for await (const [, handle] of this.entries()) yield handle;
  }

  [Symbol.asyncIterator]() {
    return this.entries();
  }
}

/** Lets the user pick a directory within the fs-shim root, via a modal dialog. */
function showShimDirectoryPicker(): Promise<FileSystemDirectoryHandle> {
  return new Promise((resolve, reject) => {
    const dialog = document.createElement('dialog');
    dialog.style.cssText = 'min-width: 400px; max-height: 80vh;';
    document.body.append(dialog);

    let settled = false;
    const finish = (path: string | null) => {
      settled = true;
      dialog.close();
      dialog.remove();
      if (path === null)
        reject(new DOMException('The user aborted a request.', 'AbortError'));
      else
        resolve(
          new ShimDirectoryHandle(path) as unknown as FileSystemDirectoryHandle,
        );
    };

    dialog.addEventListener('close', () => {
      if (!settled) finish(null);
    });

    const show = async (path: string) => {
      const list = await callJSON<{ name: string; kind: string }[]>('list', {
        path,
      });
      const dirs = list
        .filter(
          (entry) => entry.kind === 'directory' && !entry.name.startsWith('.'),
        )
        .map((entry) => entry.name)
        .sort();

      dialog.replaceChildren();

      const heading = document.createElement('p');
      heading.textContent = `/${path}`;
      dialog.append(heading);

      const ul = document.createElement('ul');
      if (path) dirs.unshift('..');
      for (const name of dirs) {
        const li = document.createElement('li');
        const button = document.createElement('button');
        button.textContent = name;
        button.onclick = () =>
          show(
            name === '..'
              ? path.split('/').slice(0, -1).join('/')
              : joinPath(path, name),
          );
        li.append(button);
        ul.append(li);
      }
      dialog.append(ul);

      const select = document.createElement('button');
      select.textContent = 'Select this directory';
      select.onclick = () => finish(path);
      const cancel = document.createElement('button');
      cancel.textContent = 'Cancel';
      cancel.onclick = () => finish(null);
      dialog.append(select, ' ', cancel);
    };

    show('').then(
      () => dialog.showModal(),
      (err) => {
        settled = true;
        dialog.remove();
        reject(err);
      },
    );
  });
}

export function installFSShim() {
  if ('showDirectoryPicker' in self) return;
  (self as any).showDirectoryPicker = showShimDirectoryPicker;
}

/** Converts a directory handle into something that can be stored in IDB. */
export function toStorableHandle(handle: FileSystemDirectoryHandle) {
  if (handle instanceof ShimDirectoryHandle)
    return { fsShimPath: handle.fsShimPath };
  return handle;
}

/** Reverses `toStorableHandle`. */
export function fromStorableHandle(
  value: FileSystemDirectoryHandle | { fsShimPath: string } | undefined,
) {
  if (value && 'fsShimPath' in value)
    return new ShimDirectoryHandle(
      value.fsShimPath,
    ) as unknown as FileSystemDirectoryHandle;
  return value;
}
