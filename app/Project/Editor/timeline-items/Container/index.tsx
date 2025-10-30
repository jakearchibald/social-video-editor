import type { FunctionComponent } from 'preact';
import type { DeepSignal } from 'deepsignal';
import { Signal } from '@preact/signals';
import type { TimelineItem } from '../../../../../project-schema/schema';
import { parseTime } from '../../../../utils/time';
import useOptimComputed from '../../../../utils/useOptimComputed';
import Video from '../Video';

import styles from './styles.module.css';

interface Props {
  time: Signal<number>;
  timeline: Signal<DeepSignal<TimelineItem[]>>;
  projectDir: FileSystemDirectoryHandle;
}

const Container: FunctionComponent<Props> = ({
  timeline,
  time,
  projectDir,
}) => {
  const activeTimelineItems = useOptimComputed(() => {
    return timeline.value.filter((item) => {
      const start = parseTime(item.start);
      const duration = parseTime(item.duration);
      const end = start + duration;
      return time.value >= start && time.value < end;
    });
  });

  const timelineChildren = useOptimComputed(() =>
    activeTimelineItems.value.map((item) => {
      // TODO: add keys to JSX
      if (item.type === 'video') {
        return (
          <Video
            projectDir={projectDir}
            source={item.source}
            time={time}
            start={item.$start!}
            videoStart={item.$videoStart || new Signal(0)}
          />
        );
      }
      throw new Error(`Unknown timeline item type: ${(item as any).type}`);
    })
  );

  console.log('container render');
  return <div class={styles.container}>{timelineChildren}</div>;
};

export default Container;
