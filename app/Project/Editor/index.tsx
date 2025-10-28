import type { FunctionComponent } from 'preact';
import { useComputed, useSignal, type Signal } from '@preact/signals';

import type { Project as ProjectSchema } from '../../../project-schema/schema';
import IframeContent from './IframeContent';
import { parseTime } from '../../utils/parseTime';
import Video from './timeline-items/Video';

interface Props {
  project: Signal<ProjectSchema>;
  projectDir: FileSystemDirectoryHandle;
}

const Editor: FunctionComponent<Props> = ({ project, projectDir }) => {
  const timelineItemTimes = useComputed(() => {
    return new WeakMap(
      project.value.timeline.map((item) => {
        const start = parseTime(item.start);
        const duration = parseTime(item.duration);
        return [
          item,
          {
            start,
            duration,
            end: start + duration,
          },
        ];
      })
    );
  });
  const width = useComputed(() => project.value.width);
  const height = useComputed(() => project.value.height);
  const duration = useComputed(() => {
    return (
      Math.max(
        ...project.value.timeline.map(
          (item) => timelineItemTimes.value.get(item)!.end
        )
      ) || 0
    );
  });
  const time = useSignal(0);
  const activeTimelineItems = useComputed(() => {
    return project.value.timeline.filter((item) => {
      const times = timelineItemTimes.value.get(item)!;
      return time.value >= times.start && time.value < times.end;
    });
  });
  const iframeChildren = useComputed(() =>
    activeTimelineItems.value.map((item) => {
      if (item.type === 'video') {
        return <Video projectDir={projectDir} source={item.source} />;
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
