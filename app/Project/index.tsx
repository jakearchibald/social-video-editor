import type { FunctionComponent } from 'preact';
import { useSignal } from '@preact/signals';

import type { Project as ProjectSchema } from '../../project-schema/schema';
import { useEffect } from 'preact/hooks';
import Editor from './Editor';
import { deepSignal, type DeepSignal } from 'deepsignal';

interface Props {
  projectDir: FileSystemDirectoryHandle;
}

const demoProject = deepSignal({
  $schema: '../../social-video-editor/project-schema/schema.json',
  appCommit: '',
  width: 1080,
  height: 1920,
  fps: 60,
  end: '00:02.000',
  start: '00:00',
  childrenTimeline: [
    {
      type: 'container',
      enter: {
        type: 'fade',
      },
      exit: {
        type: 'fade',
      },
      start: '00:01.000',
      styles: {
        position: 'absolute',
        inset: '0',
        display: 'grid',
        placeContent: 'center',
      },
      childrenTimeline: [
        {
          type: 'support',
        },
      ],
    },
  ],
} as const);

const Project: FunctionComponent<Props> = ({ projectDir }) => {
  const project = useSignal<null | DeepSignal<ProjectSchema>>(demoProject);

  return <Editor project={project.value} projectDir={projectDir} />;
};

export default Project;
