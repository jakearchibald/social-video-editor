import type { FunctionComponent } from 'preact';
import { Signal, useSignal } from '@preact/signals';

import type { Project as ProjectSchema } from '../../../project-schema/schema';
import IframeContent from './IframeContent';
import { parseTime } from '../../utils/time';
import Video from './timeline-items/Video';
import useThrottledSignal from '../../utils/useThrottledSignal';
import type { DeepSignal } from 'deepsignal';
import useOptimComputed from '../../utils/useOptimComputed';

interface Props {
  project: DeepSignal<ProjectSchema>;
  projectDir: FileSystemDirectoryHandle;
}

const Editor: FunctionComponent<Props> = ({ project, projectDir }) => {
  const width = useOptimComputed(() => project.width);
  const height = useOptimComputed(() => project.height);
  const time = useSignal(0);
  const throttledTime = useThrottledSignal(time, 50);
  // TODO: later, this will be non-throttled for live playback
  const activeTime = useOptimComputed(() => throttledTime.value);

  const duration = useOptimComputed(() => {
    const lastEndTime = Math.max(
      ...project.timeline.map((item) => {
        const start = parseTime(item.start);
        const duration = parseTime(item.duration);
        return start + duration;
      })
    );

    // The very last time will always be blank, so step back one frame
    const previousFrame = lastEndTime - 1000 / project.fps;

    return Math.max(0, previousFrame);
  });

  const activeTimelineItems = useOptimComputed(() => {
    return project.timeline.filter((item) => {
      const start = parseTime(item.start);
      const duration = parseTime(item.duration);
      const end = start + duration;
      return activeTime.value >= start && activeTime.value < end;
    });
  });
  const iframeChildren = useOptimComputed(() =>
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
