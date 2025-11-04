import type { FunctionComponent } from 'preact';
import IframeContent from '../IframeContent';
import TimelineChildren from '../TimelineChildren';
import { computed, type Signal } from '@preact/signals';
import type { DeepSignal } from 'deepsignal';
import type { ChildrenTimelineItem } from '../../../../project-schema/schema';
import styles from './styles.module.css';
import { useMemo } from 'preact/hooks';

interface Props {
  time: Signal<number>;
  fps: number;
  width: Signal<number>;
  height: Signal<number>;
  projectDir: FileSystemDirectoryHandle;
  childrenTimeline: DeepSignal<ChildrenTimelineItem[]>;
  blurLevels: Signal<number>;
}

const Blurrer: FunctionComponent<Props> = ({
  time,
  fps,
  blurLevels,
  width,
  height,
  projectDir,
  childrenTimeline,
}) => {
  const timeSignals = useMemo(() => {
    const delta = 1000 / fps / 2 / blurLevels.value;

    return Array.from({ length: blurLevels.value }).map((_, i) => {
      return computed(() => time.value + i * delta);
    });
  }, [blurLevels.value, fps]);

  return (
    <div
      class={styles.container}
      style={blurLevels.value > 1 ? { isolation: 'isolate' } : {}}
    >
      {Array.from({ length: blurLevels.value }).map((_, i) => (
        <div style={{ opacity: 1 / blurLevels.value }}>
          <IframeContent width={width} height={height}>
            <TimelineChildren
              projectDir={projectDir}
              time={timeSignals[i]}
              childrenTimeline={childrenTimeline}
            />
          </IframeContent>
        </div>
      ))}
    </div>
  );
};

export default Blurrer;
