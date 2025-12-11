import type { FunctionComponent } from 'preact';
import type { DeepSignal } from 'deepsignal';
import { Signal, useComputed } from '@preact/signals';
import type { ChildrenTimelineItem } from '../../../../project-schema/schema';
import Video from '../timeline-items/Video';
import Container from '../timeline-items/Container';
import Demo from '../timeline-items/Demo';
import Code from '../timeline-items/Code';
import Title from '../timeline-items/Title';
import Image from '../timeline-items/Image';
import { getStartTime, getEndTime } from '../../../utils/timeline-item';
import Subtitles from '../timeline-items/Subtitles';
import Support from '../timeline-items/Support';
import Mouse from '../timeline-items/Mouse';

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

      if (item.type === 'video') {
        return (
          <Video
            key={key}
            projectDir={projectDir}
            time={time}
            config={item}
            parentStart={parentStart}
            parentEnd={parentEnd}
          />
        );
      }
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
      if (item.type === 'demo') {
        return (
          <Demo
            key={key}
            config={item}
            projectDir={projectDir}
            time={time}
            parentStart={parentStart}
          />
        );
      }
      if (item.type === 'code') {
        return (
          <Code
            key={key}
            config={item}
            projectDir={projectDir}
            time={time}
            parentStart={parentStart}
          />
        );
      }
      if (item.type === 'title') {
        return <Title key={key} config={item} time={time} />;
      }
      if (item.type === 'image') {
        return (
          <Image key={key} config={item} projectDir={projectDir} time={time} />
        );
      }
      if (item.type === 'subtitles') {
        return (
          <Subtitles
            key={key}
            config={item}
            projectDir={projectDir}
            time={time}
            parentStart={parentStart}
          />
        );
      }
      if (item.type === 'support') {
        return <Support key={key} config={item} time={time} />;
      }
      if (item.type === 'mouse') {
        return <Mouse key={key} config={item} time={time} />;
      }
      throw new Error(`Unknown timeline item type: ${(item as any).type}`);
    })
  );

  return timelineChildren;
};

export default TimelineChildren;
