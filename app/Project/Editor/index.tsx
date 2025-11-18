import type { FunctionComponent } from 'preact';
import { useSignal, useSignalEffect } from '@preact/signals';
import { useSignalRef } from '@preact/signals/utils';
import { useCallback, useLayoutEffect, useMemo, useRef } from 'preact/hooks';
import type { DeepSignal } from 'deepsignal';
import {
  Output,
  Mp4OutputFormat,
  StreamTarget,
  CanvasSource,
  AudioBufferSource,
} from 'mediabunny';

import type { Project as ProjectSchema } from '../../../project-schema/schema';
import { formatTime } from '../../utils/time';
import useThrottledSignal from '../../utils/useThrottledSignal';
import useOptimComputed from '../../utils/useOptimComputed';
import useSignalLayoutEffect from '../../utils/useSignalLayoutEffect';
import { wait } from '../../utils/waitUntil';
import { AudioTimeline } from '../../utils/AudioTimeline';
import TimelineChildren, { getTimelineDuration } from './TimelineChildren';
import IframeContent from './IframeContent';
import SafeArea from './SafeArea';

import styles from './styles.module.css';

const initialTime = Number(sessionStorage.getItem('time') || 0);

interface Props {
  project: DeepSignal<ProjectSchema>;
  projectDir: FileSystemDirectoryHandle;
}

const Editor: FunctionComponent<Props> = ({ project, projectDir }) => {
  const outputting = useSignal(false);
  const framePreviewSetting = useSignal(false);
  const throttleFramesDuringScrubbing = useSignal(true);
  const showSafeArea = useSignal(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const outputRef = useSignalRef<HTMLDivElement | null>(null);
  const audioTimeline = useRef<AudioTimeline>(
    useMemo(() => new AudioTimeline(projectDir), [projectDir])
  );
  const width = useOptimComputed(() => project.width);
  const height = useOptimComputed(() => project.height);
  const time = useSignal(initialTime);
  const clampedTime = useOptimComputed(
    () => Math.floor(time.value / (1000 / project.fps)) * (1000 / project.fps)
  );
  const throttledTime = useThrottledSignal(clampedTime, 50);
  const activeTime = useOptimComputed(() =>
    outputting.value || !throttleFramesDuringScrubbing.value
      ? clampedTime.value
      : throttledTime.value
  );
  const timeStr = useOptimComputed(() => {
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

  const stageStyle = useOptimComputed(() => {
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

  useSignalLayoutEffect(() => {
    audioTimeline.current.buildTimeline(project);
  });

  useSignalEffect(() => {
    sessionStorage.setItem('time', time.value.toString());
  });

  const duration = useOptimComputed(() => {
    const lastEndTime = getTimelineDuration(project.childrenTimeline);

    // The very last time will always be blank, so step back one frame
    const previousFrame = lastEndTime - 1000 / project.fps;

    return Math.max(0, previousFrame);
  });

  const outputCanvasRef = useSignalRef<HTMLCanvasElement | null>(null);
  const outputCanvasContext = useOptimComputed(
    () => outputCanvasRef.value?.getContext('2d')!
  );

  useSignalLayoutEffect(() => {
    activeTime.valueOf();

    const outputCanvas = outputCanvasRef.current;

    if (!outputCanvas) return;

    const context = outputCanvasContext.value!;
    const outputDiv = outputRef.current!;

    let aborted = false;

    (async () => {
      await wait();
      if (aborted) return;
      context.clearRect(0, 0, width.value, height.value);
      context.drawElementImage(outputDiv, 0, 0, width.value, height.value);
    })();

    return () => {
      aborted = true;
    };
  });

  useSignalLayoutEffect(() => {
    if (!outputting.value) {
      audioTimeline.current.play(activeTime.value, 100).catch((err) => {
        if (err instanceof Error && err.name === 'AbortError') return;
        throw err;
      });
    }
  });

  const output = useCallback(async () => {
    outputting.value = true;

    await 0;

    const outputCanvas = outputCanvasRef.current!;
    const file = await projectDir.getFileHandle('output.mp4', { create: true });
    const fileStream = await file.createWritable();
    const videoOutput = new Output({
      format: new Mp4OutputFormat(),
      target: new StreamTarget(fileStream),
    });
    const canvasSource = new CanvasSource(outputCanvas, {
      codec: 'avc',
      bitrateMode: 'variable',
      bitrate: 35_000_000,
      hardwareAcceleration: 'prefer-software',
    });
    const audioBufferSource = new AudioBufferSource({
      codec: 'pcm-s16',
    });
    videoOutput.addVideoTrack(canvasSource, {
      frameRate: project.fps,
    });
    videoOutput.addAudioTrack(audioBufferSource);

    await videoOutput.start();

    audioBufferSource.add(
      await audioTimeline.current.toBuffer(
        project.audioSampleRate,
        0,
        duration.value
      )
    );

    for (
      let timeValue = 0;
      timeValue <= duration.value;
      timeValue += 1000 / project.fps
    ) {
      time.value = timeValue;
      await 0;
      await wait();
      await 0;
      await canvasSource.add(timeValue / 1000, 1 / project.fps);
    }
    outputting.value = false;

    await videoOutput.finalize();
  }, []);

  return (
    <div class={styles.editor}>
      <div class={styles.stage} ref={stageRef} style={stageStyle}>
        {framePreviewSetting.value || outputting.value ? (
          <canvas
            layoutsubtree
            ref={outputCanvasRef}
            width={width}
            height={height}
          >
            <div class={styles.output} ref={outputRef}>
              <IframeContent width={width} height={height}>
                <TimelineChildren
                  projectDir={projectDir}
                  time={time}
                  childrenTimeline={project.childrenTimeline}
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
          min="0"
          max={duration}
          step={1000 / project.fps}
          value={time.value}
          disabled={outputting}
          onInput={(e) => {
            time.value = (e.target as HTMLInputElement).valueAsNumber;
          }}
        />
        <div>{timeStr}</div>
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
