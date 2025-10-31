import type { FunctionComponent } from 'preact';
import { useSignal } from '@preact/signals';
import { useCallback, useLayoutEffect, useMemo, useRef } from 'preact/hooks';
import {
  Output,
  Mp4OutputFormat,
  StreamTarget,
  CanvasSource,
  BufferSource,
  AudioBufferSource,
} from 'mediabunny';

import type { Project as ProjectSchema } from '../../../project-schema/schema';
import IframeContent from './IframeContent';
import { parseTime } from '../../utils/time';
import useThrottledSignal from '../../utils/useThrottledSignal';
import type { DeepSignal } from 'deepsignal';
import useOptimComputed from '../../utils/useOptimComputed';
import Container from './timeline-items/Container';
import useSignalLayoutEffect from '../../utils/useSignalLayoutEffect';
import { wait } from '../../utils/waitUntil';
import { AudioTimeline } from '../../utils/AudioTimeline';

import styles from './styles.module.css';

interface Props {
  project: DeepSignal<ProjectSchema>;
  projectDir: FileSystemDirectoryHandle;
}

const Editor: FunctionComponent<Props> = ({ project, projectDir }) => {
  const outputting = useSignal(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const outputRef = useRef<HTMLDivElement>(null);
  const audioTimeline = useRef<AudioTimeline>(
    useMemo(() => new AudioTimeline(projectDir), [projectDir])
  );
  const width = useOptimComputed(() => project.width);
  const height = useOptimComputed(() => project.height);
  const time = useSignal(0);
  const clampedTime = useOptimComputed(
    () => Math.floor(time.value / (1000 / project.fps)) * (1000 / project.fps)
  );
  const throttledTime = useThrottledSignal(clampedTime, 50);
  const activeTime = useOptimComputed(() =>
    outputting.value ? clampedTime.value : throttledTime.value
  );

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

  const duration = useOptimComputed(() => {
    const lastEndTime = Math.max(
      ...project.childrenTimeline.map((item) => {
        const start = parseTime(item.start);
        const duration = parseTime(item.duration);
        return start + duration;
      })
    );

    // The very last time will always be blank, so step back one frame
    const previousFrame = lastEndTime - 1000 / project.fps;

    return Math.max(0, previousFrame);
  });

  const outputCanvasRef = useRef<HTMLCanvasElement>(null);
  const outputCanvasContextRef = useRef<CanvasRenderingContext2D | null>(null);

  useSignalLayoutEffect(() => {
    activeTime.valueOf();

    const outputCanvas = outputCanvasRef.current!;

    if (!outputCanvasContextRef.current) {
      outputCanvasContextRef.current = outputCanvas.getContext('2d')!;
    }

    const context = outputCanvasContextRef.current!;
    const outputDiv = outputRef.current!;

    let aborted = false;

    if (!outputting.value) {
      audioTimeline.current.play(activeTime.value, 150).catch((err) => {
        if (err instanceof Error && err.name === 'AbortError') return;
        throw err;
      });
    }

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

  const output = useCallback(async () => {
    outputting.value = true;

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
        <canvas
          layoutsubtree
          ref={outputCanvasRef}
          width={width}
          height={height}
        >
          <div class={styles.output} ref={outputRef}>
            <IframeContent width={width} height={height}>
              <Container
                projectDir={projectDir}
                childrenTimeline={project.$childrenTimeline!}
                time={activeTime}
              />
            </IframeContent>
          </div>
        </canvas>
      </div>
      <input
        type="range"
        min="0"
        max={duration}
        step="any"
        value={time.value}
        disabled={outputting}
        onInput={(e) => {
          time.value = (e.target as HTMLInputElement).valueAsNumber;
        }}
      />
      <div>
        <button onClick={output}>Output video</button>
      </div>
    </div>
  );
};

export default Editor;
