import type { FunctionComponent } from 'preact';
import { Signal, useComputed, useSignal } from '@preact/signals';

import type { Project as ProjectSchema } from '../../../project-schema/schema';
import IframeContent from './IframeContent';
import { parseTime } from '../../utils/time';
import Video from './timeline-items/Video';
import useThrottledSignal from '../../utils/useThrottledSignal';
import type { DeepSignal } from 'deepsignal';

interface Props {
  project: DeepSignal<ProjectSchema>;
  projectDir: FileSystemDirectoryHandle;
}

const Editor: FunctionComponent<Props> = ({ project, projectDir }) => {
  const width = useComputed(() => project.width);
  const height = useComputed(() => project.height);
  const time = useSignal(0);
  const throttledTime = useThrottledSignal(time, 50);
  // TODO: later, this will be non-throttled for live playback
  const activeTime = useComputed(() => throttledTime.value);

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

  const activeTimelineItems = useComputed(() => {
    return project.timeline.filter((item) => {
      const start = parseTime(item.start);
      const duration = parseTime(item.duration);
      const end = start + duration;
      return activeTime.value >= start && activeTime.value < end;
    });
  });
  const iframeChildren = useComputed(() =>
    activeTimelineItems.value.map((item) => {
      // TODO: add keys to JSX
      if (item.type === 'video') {
        return (
          <Video
            projectDir={projectDir}
            source={item.source}
            time={throttledTime}
            start={item.$start!}
            videoStart={item.$videoStart || new Signal(0)}
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
