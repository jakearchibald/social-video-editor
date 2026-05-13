import type { FunctionComponent } from 'preact';
import { useSignal, useSignalEffect, useComputed } from '@preact/signals';
import { useSignalRef } from '@preact/signals/utils';
import { useCallback, useLayoutEffect, useRef } from 'preact/hooks';
import type { DeepSignal } from 'deepsignal';
import {
  Output,
  Mp4OutputFormat,
  StreamTarget,
  CanvasSource,
  BufferTarget,
} from 'mediabunny';

import type { Project as ProjectSchema } from '../../../project-schema/schema';
import { formatTime, parseTime } from '../../utils/time';
import useThrottledSignal from '../../utils/useThrottledSignal';
import useSignalLayoutEffect from '../../utils/useSignalLayoutEffect';
import { wait } from '../../utils/waitUntil';
import TimelineChildren from './TimelineChildren';
import IframeContent from './IframeContent';
import SafeArea from './SafeArea';

import styles from './styles.module.css';

const forceDuration = 0;
const forceStart = 0;

const initialTimeMs = Number(sessionStorage.getItem('time') || 0);

interface Props {
  project: DeepSignal<ProjectSchema>;
  projectDir: FileSystemDirectoryHandle;
}

const Editor: FunctionComponent<Props> = ({ project, projectDir }) => {
  const outputting = useSignal(false);
  const framePreviewSetting = useSignal(true);
  const throttleFramesDuringScrubbing = useSignal(true);
  const showSafeArea = useSignal(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const outputRef = useSignalRef<HTMLDivElement | null>(null);
  const width = useComputed(() => project.width);
  const height = useComputed(() => project.height);
  const frame = useSignal(Math.round(initialTimeMs / (1000 / project.fps)));
  const time = useComputed(() => frame.value * (1000 / project.fps));
  const throttledFrame = useThrottledSignal(frame, 50);
  const activeTime = useComputed(() => {
    const activeFrame =
      outputting.value || !throttleFramesDuringScrubbing.value
        ? frame.value
        : throttledFrame.value;
    return activeFrame * (1000 / project.fps);
  });
  const timeStr = useComputed(() => {
    return formatTime(activeTime.value, {
      forceMinutes: true,
      forceSeconds: true,
      milliDecimalPlaces: 3,
    });
  });

  const stageSize = useSignal<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });

  const stageStyle = useComputed(() => {
    const projectWidth = project.width;
    const projectHeight = project.height;
    const scaleX = stageSize.value.width / projectWidth;
    const scaleY = stageSize.value.height / projectHeight;
    const scale = Math.min(scaleX, scaleY);
    const x = (stageSize.value.width - projectWidth * scale) / 2;
    const y = (stageSize.value.height - projectHeight * scale) / 2;
    return `--scale: ${scale}; --x: ${x}px; --y: ${y}px;`;
  });

  // Maintain the stage size on resize
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

  useSignalEffect(() => {
    sessionStorage.setItem('time', time.value.toString());
  });

  const start = useComputed(() => {
    if (forceStart) return parseTime(forceStart);
    if (project.start) return parseTime(project.start);
    return 0;
  });

  const duration = useComputed(() => {
    if (forceDuration) return forceDuration;
    return parseTime(project.end);
  });

  const outputCanvasRef = useSignalRef<HTMLCanvasElement | null>(null);
  const outputCanvasContext = useComputed(
    () => outputCanvasRef.value?.getContext('2d')!,
  );
  const outputCanvasPromise = useRef<Promise<void> | null>(null);

  // Draw to canvas, if it's there
  useSignalLayoutEffect(() => {
    activeTime.valueOf();

    const outputCanvas = outputCanvasRef.current;

    if (!outputCanvas) return;

    const context = outputCanvasContext.value!;
    const outputDiv = outputRef.current!;

    let aborted = false;

    outputCanvasPromise.current = (async () => {
      await wait();
      if (aborted) return;
      if ('requestPaint' in outputCanvas) {
        outputCanvas.requestPaint();
        await new Promise<void>((r) =>
          outputCanvas.addEventListener('paint', () => r(), { once: true }),
        );
        if (aborted) return;
      }
      context.clearRect(0, 0, width.value, height.value);
      context.drawElementImage(outputDiv, 0, 0, width.value, height.value);
    })();

    return () => {
      aborted = true;
    };
  });

  const output = useCallback(async () => {
    outputting.value = true;

    await 0;

    const outputCanvas = outputCanvasRef.current!;
    const videoOutput = new Output({
      format: new Mp4OutputFormat(),
      target: new BufferTarget(),
    });
    const canvasSource = new CanvasSource(outputCanvas, {
      codec: 'av1',
      bitrateMode: 'variable',
      bitrate: 35_000_000,
      hardwareAcceleration: 'prefer-software',
    });
    videoOutput.addVideoTrack(canvasSource, {
      frameRate: project.fps,
    });

    await videoOutput.start();

    const outputStart = start.value;

    const startFrame = Math.round(outputStart / (1000 / project.fps));
    const endFrame = Math.round(duration.value / (1000 / project.fps)) - 1;

    for (let frameValue = startFrame; frameValue <= endFrame; frameValue++) {
      frame.value = frameValue;
      await 0;
      await wait();
      await 0;
      await outputCanvasPromise.current;
      await canvasSource.add(
        (frameValue - startFrame) / project.fps,
        1 / project.fps,
      );
    }

    await videoOutput.finalize();
    outputting.value = false;

    const url = URL.createObjectURL(
      new Blob([videoOutput.target.buffer!], { type: 'video/mp4' }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = 'output.mp4';
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  return (
    <div class={styles.editor}>
      <div class={styles.stage} ref={stageRef} style={stageStyle}>
        {framePreviewSetting.value || outputting.value ? (
          <canvas
            layoutsubtree
            ref={outputCanvasRef}
            width={width.value}
            height={height.value}
          >
            <div class={styles.output} ref={outputRef}>
              <IframeContent width={width} height={height}>
                <TimelineChildren
                  projectDir={projectDir}
                  time={time}
                  childrenTimeline={project.childrenTimeline}
                  parentStart={0}
                  parentEnd={duration.value}
                />
              </IframeContent>
            </div>
          </canvas>
        ) : (
          <div class={styles.output}>
            <IframeContent width={width} height={height}>
              <TimelineChildren
                projectDir={projectDir}
                time={time}
                childrenTimeline={project.childrenTimeline}
                parentStart={0}
                parentEnd={duration.value}
              />
            </IframeContent>
          </div>
        )}
        {showSafeArea.value && (
          <SafeArea width={width.value} height={height.value} />
        )}
      </div>
      <div class={styles.rangeContainer}>
        <input
          type="range"
          min={Math.round(start.value / (1000 / project.fps))}
          max={Math.round(duration.value / (1000 / project.fps)) - 1}
          step={1}
          value={frame.value}
          disabled={outputting}
          onInput={(e) => {
            frame.value = (e.target as HTMLInputElement).valueAsNumber;
          }}
        />
        <div>{timeStr}</div>
        <button
          onClick={() => {
            navigator.clipboard.writeText(timeStr.value);
          }}
        >
          Copy
        </button>
      </div>
      <div>
        <button onClick={output}>Output video</button>{' '}
        <label>
          <input
            type="checkbox"
            checked={framePreviewSetting}
            onChange={(e) =>
              (framePreviewSetting.value = (
                e.target as HTMLInputElement
              ).checked)
            }
          />{' '}
          Frame preview
        </label>{' '}
        <label>
          <input
            type="checkbox"
            checked={throttleFramesDuringScrubbing}
            onChange={(e) =>
              (throttleFramesDuringScrubbing.value = (
                e.target as HTMLInputElement
              ).checked)
            }
          />{' '}
          Throttle frames during scrubbing
        </label>{' '}
        <label>
          <input
            type="checkbox"
            checked={showSafeArea}
            onChange={(e) =>
              (showSafeArea.value = (e.target as HTMLInputElement).checked)
            }
          />{' '}
          Show safe area
        </label>{' '}
      </div>
    </div>
  );
};

export default Editor;
