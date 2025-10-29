import type { FunctionComponent } from 'preact';
import {
  useComputed,
  useSignal,
  type ReadonlySignal,
  type Signal,
} from '@preact/signals';

import type { Project as ProjectSchema } from '../../../project-schema/schema';
import IframeContent from './IframeContent';
import { parseTime } from '../../utils/time';
import Video from './timeline-items/Video';

const videoStartTimes = new WeakMap<any, number>();

interface Props {
  project: ProjectSchema;
  projectDir: FileSystemDirectoryHandle;
}

const Editor: FunctionComponent<Props> = ({ project, projectDir }) => {
  const width = useComputed(() => project.width);
  const height = useComputed(() => project.height);

  const duration = useComputed(() => {
    return (
      Math.max(
        ...project.timeline.map((item) => {
          const start = parseTime(item.start);
          const duration = parseTime(item.duration);
          return start + duration;
        })
      ) || 0
    );
  });
  const time = useSignal(0);
  const activeTimelineItems = useComputed(() => {
    return project.timeline.filter((item) => {
      const start = parseTime(item.start);
      const duration = parseTime(item.duration);
      const end = start + duration;
      return time.value >= start && time.value < end;
    });
  });
  const iframeChildren = useComputed(() =>
    activeTimelineItems.value.map((item) => {
      // TODO: add keys to JSX
      if (item.type === 'video') {
        if (!videoStartTimes.has(item)) {
          videoStartTimes.set(item, parseTime(item.videoStart || '0'));
        }

        const start = parseTime(item.start);
        const videoStart = videoStartTimes.get(item)!;

        return (
          <Video
            projectDir={projectDir}
            source={item.source}
            time={time}
            start={start}
            videoStart={videoStart}
          />
        );
      }
      throw new Error(`Unknown timeline item type: ${(item as any).type}`);
    })
  );

  return (
    <div>
      <input
        type="range"
        min="0"
        max={duration}
        step="any"
        value={time.value}
        onInput={(e) => {
          time.value = (e.target as HTMLInputElement).valueAsNumber;
        }}
      />
      <IframeContent width={width} height={height}>
        {iframeChildren}
      </IframeContent>
    </div>
  );
};

export default Editor;
