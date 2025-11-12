import type { FunctionComponent } from 'preact';
import type { DeepSignal } from 'deepsignal';
import { Signal } from '@preact/signals';
import type { ChildrenTimelineItem } from '../../../../project-schema/schema';
import { parseTime } from '../../../utils/time';
import useOptimComputed from '../../../utils/useOptimComputed';
import Video from '../timeline-items/Video';
import Container from '../timeline-items/Container';
import Demo from '../timeline-items/Demo';
import Code from '../timeline-items/Code';
import Title from '../timeline-items/Title';

export function getTimelineDuration(timeline: ChildrenTimelineItem[]): number {
  return Math.max(
    ...timeline
      .filter((item) => !item.disabled)
      .map((item) => {
        const start = parseTime(item.start);
        const duration = parseTime(item.duration);
        return start + duration;
      })
  );
}

const keyMap = new WeakMap<object, string>();

interface Props {
  time: Signal<number>;
  childrenTimeline?: DeepSignal<ChildrenTimelineItem[]>;
  projectDir: FileSystemDirectoryHandle;
}

const TimelineChildren: FunctionComponent<Props> = ({
  childrenTimeline,
  time,
  projectDir,
}) => {
  const activeTimelineItems = useOptimComputed(() => {
    if (!childrenTimeline) return [];

    return childrenTimeline.filter((item) => {
      if (item.disabled) return false;
      const start = parseTime(item.start);
      const duration = parseTime(item.duration);
      const end = start + duration;
      return time.value >= start && time.value < end;
    });
  });

  const timelineChildren = useOptimComputed(() =>
    activeTimelineItems.value.map((item) => {
      if (!keyMap.has(item)) {
        keyMap.set(item, String(Math.random()));
      }

      const key = keyMap.get(item)!;

      if (item.type === 'video') {
        return (
          <Video key={key} projectDir={projectDir} time={time} config={item} />
        );
      }
      if (item.type === 'container') {
        return (
          <Container
            key={key}
            projectDir={projectDir}
            time={time}
            config={item}
          />
        );
      }
      if (item.type === 'demo') {
        return (
          <Demo key={key} config={item} projectDir={projectDir} time={time} />
        );
      }
      if (item.type === 'code') {
        return (
          <Code key={key} config={item} projectDir={projectDir} time={time} />
        );
      }
      if (item.type === 'title') {
        return <Title key={key} config={item} time={time} />;
      }
      throw new Error(`Unknown timeline item type: ${(item as any).type}`);
    })
  );

  return timelineChildren;
};

export default TimelineChildren;
