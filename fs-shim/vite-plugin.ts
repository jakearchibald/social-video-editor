import type { Plugin } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createReadStream, createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { pipeline } from 'node:stream/promises';

/**
 * Serves a directory on disk to the app's File System Access shim, for browsers that can't give
 * pages access to real directories. Insecure, and only intended for local dev use.
 */
export default function fsShim({
  root = process.env.FS_SHIM_ROOT ?? path.join(os.homedir(), 'dev', 'videos'),
  base = '/@fs-shim/',
} = {}): Plugin {
  const writables = new Map<string, { target: string; temp: string }>();

  function resolvePath(relative: string | null) {
    const resolved = path.resolve(root, relative ?? '');
    if (resolved !== root && !resolved.startsWith(root + path.sep))
      throw new HttpError(403, 'SecurityError', 'Path is outside the root');
    return resolved;
  }

  async function statOrNull(filePath: string) {
    try {
      return await fs.stat(filePath);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw err;
    }
  }

  async function handle(
    action: string,
    params: URLSearchParams,
    req: IncomingMessage,
    res: ServerResponse,
  ) {
    switch (action) {
      case 'stat': {
        const stats = await statOrNull(resolvePath(params.get('path')));
        if (!stats) throw new HttpError(404, 'NotFoundError', 'Not found');
        return json(res, {
          kind: stats.isDirectory() ? 'directory' : 'file',
          size: stats.size,
          lastModified: stats.mtimeMs,
        });
      }
      case 'list': {
        const entries = await fs.readdir(resolvePath(params.get('path')), {
          withFileTypes: true,
        });
        return json(
          res,
          entries
            .filter((entry) => entry.isDirectory() || entry.isFile())
            .map((entry) => ({
              name: entry.name,
              kind: entry.isDirectory() ? 'directory' : 'file',
            })),
        );
      }
      case 'read': {
        const filePath = resolvePath(params.get('path'));
        const stats = await statOrNull(filePath);
        if (!stats?.isFile())
          throw new HttpError(404, 'NotFoundError', 'Not found');
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Length', stats.size);
        res.setHeader('Cache-Control', 'no-store');
        await pipeline(createReadStream(filePath), res);
        return;
      }
      case 'mkdir': {
        await fs.mkdir(resolvePath(params.get('path')), { recursive: true });
        return json(res, {});
      }
      case 'touch': {
        const filePath = resolvePath(params.get('path'));
        if (!(await statOrNull(filePath))) await fs.writeFile(filePath, '');
        return json(res, {});
      }
      case 'remove': {
        const filePath = resolvePath(params.get('path'));
        const stats = await statOrNull(filePath);
        if (!stats) throw new HttpError(404, 'NotFoundError', 'Not found');
        if (stats.isDirectory()) {
          if (params.get('recursive') === '1') {
            await fs.rm(filePath, { recursive: true });
          } else if ((await fs.readdir(filePath)).length) {
            throw new HttpError(
              400,
              'InvalidModificationError',
              'Directory is not empty',
            );
          } else {
            await fs.rmdir(filePath);
          }
        } else {
          await fs.unlink(filePath);
        }
        return json(res, {});
      }
      case 'writable-open': {
        const target = resolvePath(params.get('path'));
        const id = randomUUID();
        const temp = `${target}.${id}.fsshim-swap`;
        if (params.get('keepExistingData') === '1')
          await fs.copyFile(target, temp);
        else await fs.writeFile(temp, '');
        writables.set(id, { target, temp });
        return json(res, { id });
      }
      case 'writable-write': {
        const writable = getWritable(params.get('id'));
        await pipeline(
          req,
          createWriteStream(writable.temp, {
            flags: 'r+',
            start: Number(params.get('position')),
          }),
        );
        return json(res, {});
      }
      case 'writable-truncate': {
        const writable = getWritable(params.get('id'));
        await fs.truncate(writable.temp, Number(params.get('size')));
        return json(res, {});
      }
      case 'writable-close': {
        const id = params.get('id')!;
        const writable = getWritable(id);
        writables.delete(id);
        await fs.rename(writable.temp, writable.target);
        return json(res, {});
      }
      case 'writable-abort': {
        const id = params.get('id')!;
        const writable = getWritable(id);
        writables.delete(id);
        await fs.rm(writable.temp, { force: true });
        return json(res, {});
      }
    }
    throw new HttpError(404, 'NotFoundError', `Unknown action ${action}`);
  }

  function getWritable(id: string | null) {
    const writable = id && writables.get(id);
    if (!writable)
      throw new HttpError(400, 'InvalidStateError', 'Writable is closed');
    return writable;
  }

  return {
    name: 'fs-shim',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url!, 'http://localhost');
        if (!url.pathname.startsWith(base)) return next();

        if (!isLocalSameOriginRequest(req)) {
          res.statusCode = 403;
          json(res, { name: 'SecurityError', message: 'Forbidden' });
          return;
        }

        try {
          await handle(
            url.pathname.slice(base.length),
            url.searchParams,
            req,
            res,
          );
        } catch (err) {
          const httpError =
            err instanceof HttpError
              ? err
              : new HttpError(500, 'UnknownError', String(err));
          if (res.headersSent) {
            res.destroy();
            return;
          }
          res.statusCode = httpError.status;
          json(res, { name: httpError.name, message: httpError.message });
        }
      });
    },
  };
}

class HttpError extends Error {
  status: number;

  constructor(status: number, name: string, message: string) {
    super(message);
    this.status = status;
    this.name = name;
  }
}

const loopbackAddresses = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
const loopbackHostnames = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * Whether the request comes from a page served by this dev server on this machine. Rejects other
 * machines, DNS rebinding, and requests made by other sites open in the browser.
 */
function isLocalSameOriginRequest(req: IncomingMessage) {
  if (!loopbackAddresses.has(req.socket.remoteAddress ?? '')) return false;

  const host = req.headers.host;
  if (!host) return false;
  const { hostname } = new URL(`http://${host}`);
  if (!loopbackHostnames.has(hostname)) return false;

  const fetchSite = req.headers['sec-fetch-site'];
  if (fetchSite && fetchSite !== 'same-origin') return false;

  const origin = req.headers.origin;
  if (origin && new URL(origin).host !== host) return false;

  return true;
}

function json(res: ServerResponse, value: unknown) {
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(value));
}
