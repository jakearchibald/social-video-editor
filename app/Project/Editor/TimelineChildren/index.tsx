import type { FunctionComponent } from 'preact';
import type { DeepSignal } from 'deepsignal';
import { Signal, useComputed } from '@preact/signals';
import type { ChildrenTimelineItem } from '../../../../project-schema/schema';
import Container from '../timeline-items/Container';
import { getStartTime, getEndTime } from '../../../utils/timeline-item';
import Support from '../timeline-items/Support';

const keyMap = new WeakMap<object, string>();

interface Props {
  time: Signal<number>;
  childrenTimeline?: DeepSignal<ChildrenTimelineItem[]>;
  projectDir: FileSystemDirectoryHandle;
  parentStart: number;
  parentEnd: number;
}

const TimelineChildren: FunctionComponent<Props> = ({
  childrenTimeline,
  time,
  projectDir,
  parentStart,
  parentEnd,
}) => {
  const activeTimelineItems = useComputed(() => {
    if (!childrenTimeline) return [];

    return childrenTimeline.filter((item) => {
      if (item.disabled) return false;
      const start = getStartTime(item, parentStart);
      const end = getEndTime(item, parentStart, parentEnd);
      return time.value >= start && time.value < end;
    });
  });

  const timelineChildren = useComputed(() =>
    activeTimelineItems.value.map((item) => {
      if (!keyMap.has(item)) {
        keyMap.set(item, String(Math.random()));
      }

      const key = keyMap.get(item)!;

      if (item.type === 'container') {
        return (
          <Container
            key={key}
            projectDir={projectDir}
            time={time}
            config={item}
            parentStart={parentStart}
            parentEnd={parentEnd}
          />
        );
      }
      if (item.type === 'support') {
        return <Support key={key} config={item} time={time} />;
      }
      throw new Error(`Unknown timeline item type: ${(item as any).type}`);
    })
  );

  return timelineChildren;
};

export default TimelineChildren;
