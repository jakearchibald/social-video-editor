import type { FunctionComponent } from 'preact';
import { useSignal } from '@preact/signals';

import type { Project } from '../../project-schema/schema';
import { useEffect } from 'preact/hooks';

interface Props {
  projectDir: FileSystemDirectoryHandle;
}

const Editor: FunctionComponent<Props> = ({ projectDir }) => {
  const project = useSignal<null | Project>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const fileHandle = await projectDir.getFileHandle('index.json');
        const file = await fileHandle.getFile();
        const text = await file.text();
        const proj = JSON.parse(text) as Project;
        if (cancelled) return;
        project.value = proj;
      } catch (err) {
        console.error('Error loading project:', err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [projectDir]);

  if (!project) return <p>Loading project…</p>;

  return <p>Editor TODO</p>;
};

export default Editor;
