import type { FunctionComponent } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';

interface Props {
  projectDir: FileSystemDirectoryHandle;
  source: string;
}

const Video: FunctionComponent<Props> = ({ projectDir, source }) => {
  useEffect(() => {
    (async () => {
      const path = new URL(source, 'https://example.com/').pathname.slice(1);
      const splitPath = path.split('/');
      const dirPaths = splitPath.slice(0, -1);
      const fileName = splitPath.at(-1)!;

      let dirHandle = projectDir;
      for (const dirPath of dirPaths) {
        dirHandle = await dirHandle.getDirectoryHandle(dirPath);
      }
      const fileHandle = await dirHandle.getFileHandle(fileName);
      const file = await fileHandle.getFile();
      console.log({ file });
    })();
  }, [projectDir, source]);

  return <div>Video Component</div>;
};

export default Video;
