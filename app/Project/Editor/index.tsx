import type { FunctionComponent } from 'preact';
import { Signal, useSignal } from '@preact/signals';

import type { Project as ProjectSchema } from '../../../project-schema/schema';
import IframeContent from './IframeContent';
import { parseTime } from '../../utils/time';
import Video from './timeline-items/Video';
import useThrottledSignal from '../../utils/useThrottledSignal';
import type { DeepSignal } from 'deepsignal';
import useOptimComputed from '../../utils/useOptimComputed';

import styles from './styles.module.css';
import { useLayoutEffect, useRef } from 'preact/hooks';
import Container from './timeline-items/Container';

interface Props {
  project: DeepSignal<ProjectSchema>;
  projectDir: FileSystemDirectoryHandle;
}

const Editor: FunctionComponent<Props> = ({ project, projectDir }) => {
  const stageRef = useRef<HTMLDivElement>(null);
  const width = useOptimComputed(() => project.width);
  const height = useOptimComputed(() => project.height);
  const time = useSignal(0);
  const throttledTime = useThrottledSignal(time, 50);
  // TODO: later, this will be non-throttled for live playback
  const activeTime = useOptimComputed(() => throttledTime.value);
  const stageSize = useSignal<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });
  const stateStyle = useOptimComputed(() => {
    const projectWidth = project.width;
    const projectHeight = project.height;
    const scaleX = stageSize.value.width / projectWidth;
    const scaleY = stageSize.value.height / projectHeight;
    const scale = Math.min(scaleX, scaleY);
    const x = (stageSize.value.width - projectWidth * scale) / 2;
    const y = (stageSize.value.height - projectHeight * scale) / 2;
    return `--scale: ${scale}; --x: ${x}px; --y: ${y}px;`;
  });

  useLayoutEffect(() => {
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      const width = entry.contentRect.width;
      const height = entry.contentRect.height;
      stageSize.value = { width, height };
    });

    if (stageRef.current) {
      observer.observe(stageRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, []);

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

  return (
    <div class={styles.editor}>
      <div class={styles.stage} ref={stageRef} style={stateStyle}>
        <IframeContent width={width} height={height}>
          <Container
            projectDir={projectDir}
            timeline={project.$timeline!}
            time={activeTime}
          />
        </IframeContent>
      </div>
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
    </div>
  );
};

export default Editor;
