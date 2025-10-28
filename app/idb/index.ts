import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

interface Schema extends DBSchema {
  projects: {
    value: FileSystemDirectoryHandle;
    key: string;
  };
}

let dbPromise: Promise<IDBPDatabase<Schema>> | null = null;
let closeTimeout: number | null = null;

async function closeDB() {
  if (!dbPromise) return;
  const dbp = dbPromise;
  dbPromise = null;
  const db = await dbp;
  db.close();
}

function getDB() {
  if (closeTimeout) clearTimeout(closeTimeout);
  closeTimeout = setTimeout(() => {
    closeDB();
  }, 10_000);

  if (!dbPromise) {
    dbPromise = openDB('social-video-editor', 1, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          // Create a store for projects
          db.createObjectStore('projects', { autoIncrement: true });
        }
      },
    });
  }
  return dbPromise;
}

export async function getProjectDir(
  projectId: string
): Promise<FileSystemDirectoryHandle | undefined> {
  const db = await getDB();
  return db.get('projects', projectId);
}

export async function setProjectDir(
  projectId: string,
  dirHandle: FileSystemDirectoryHandle
): Promise<void> {
  const db = await getDB();
  await db.put('projects', dirHandle, projectId);
}

export async function deleteProjectDir(projectId: string): Promise<void> {
  const db = await getDB();
  await db.delete('projects', projectId);
}

export async function getProjectIds(): Promise<string[]> {
  const db = await getDB();
  return db.getAllKeys('projects');
}
