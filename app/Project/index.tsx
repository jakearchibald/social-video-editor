import type { FunctionComponent } from 'preact';
import { Signal, useSignal } from '@preact/signals';

import type { Project as ProjectSchema } from '../../project-schema/schema';
import { useEffect } from 'preact/hooks';
import Editor from './Editor';

interface Props {
  projectDir: FileSystemDirectoryHandle;
}

const Project: FunctionComponent<Props> = ({ projectDir }) => {
  const project = useSignal<null | ProjectSchema>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const fileHandle = await projectDir.getFileHandle('index.json');
        const file = await fileHandle.getFile();
        const text = await file.text();
        const proj = JSON.parse(text) as ProjectSchema;
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

  if (!project.value) return <p>Loading project…</p>;

  return (
    <Editor
      project={project as Signal<ProjectSchema>}
      projectDir={projectDir}
    />
  );
};

export default Project;
