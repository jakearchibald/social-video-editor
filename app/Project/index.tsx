import type { FunctionComponent } from 'preact';
import { useSignal } from '@preact/signals';

import type { Project as ProjectSchema } from '../../project-schema/schema';
import { useEffect } from 'preact/hooks';
import Editor from './Editor';
import { deepSignal, type DeepSignal } from 'deepsignal';

interface Props {
  projectDir: FileSystemDirectoryHandle;
}

const Project: FunctionComponent<Props> = ({ projectDir }) => {
  const project = useSignal<null | DeepSignal<ProjectSchema>>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const fileHandle = await projectDir.getFileHandle('index.json');
        const file = await fileHandle.getFile();
        const text = await file.text();
        const proj = JSON.parse(text) as ProjectSchema;
        if (cancelled) return;
        project.value = deepSignal(proj);
      } catch (err) {
        console.error('Error loading project:', err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [projectDir]);

  if (!project.value) return <p>Loading project…</p>;

  return <Editor project={project.value} projectDir={projectDir} />;
};

export default Project;
