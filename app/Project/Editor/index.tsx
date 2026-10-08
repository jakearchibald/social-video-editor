import type { FunctionComponent } from 'preact';
import { useSignal, useSignalEffect, useComputed } from '@preact/signals';
import { useSignalRef } from '@preact/signals/utils';
import { useCallback, useLayoutEffect, useMemo, useRef } from 'preact/hooks';
import type { DeepSignal } from 'deepsignal';
import {
  Output,
  Mp4OutputFormat,
  StreamTarget,
  CanvasSource,
} from 'mediabunny';

import type { Project as ProjectSchema } from '../../../project-schema/schema';
import { formatTime, parseTime } from '../../utils/time';
import useThrottledSignal from '../../utils/useThrottledSignal';
import useSignalLayoutEffect from '../../utils/useSignalLayoutEffect';
import { wait } from '../../utils/waitUntil';
import { AudioTimeline } from '../../utils/AudioTimeline';
import { muxVideoChunks, type VideoChunk } from '../../utils/mux-video-chunks';
import {
  getChunkFileName,
  openVideoChunkDir,
} from '../../utils/video-chunk-dir';
import TimelineChildren from './TimelineChildren';
import IframeContent from './IframeContent';
import SafeArea from './SafeArea';

import styles from './styles.module.css';

const forceDuration = 0;
const forceStart = 0;
// Otherwise, the output is captured using drawWindow, which needs a patched Firefox build.
const supportsDrawElementImage =
  'drawElementImage' in CanvasRenderingContext2D.prototype;
const videoEncodingConfig = supportsDrawElementImage
  ? ({
      codec: 'av1',
      bitrateMode: 'variable',
      bitrate: 35_000_000,
      hardwareAcceleration: 'prefer-software',
    } as const)
  : // Firefox's AV1 encoder is slow, so use hardware H.264 with a very high bitrate instead
    ({
      codec: 'avc',
      bitrateMode: 'variable',
      bitrate: 100_000_000,
      hardwareAcceleration: 'prefer-hardware',
    } as const);
// The video is encoded in chunks of this length (in ms), which are muxed together at the end. This
// keeps each encoder session short, working around browser crashes during long encodes. Chunks are
// kept on disk, so a crashed output can pick up where it left off.
const chunkDuration = 5_000;
const chunkDirName = 'output-chunks';

const initialTimeMs = Number(sessionStorage.getItem('time') || 0);

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
    useMemo(() => new AudioTimeline(projectDir), [projectDir]),
  );
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

  useSignalLayoutEffect(() => {
    console.log('building audio');
    audioTimeline.current.buildTimeline(project);
  });

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
      if (supportsDrawElementImage) {
        context.drawElementImage(outputDiv, 0, 0, width.value, height.value);
      } else {
        const iframe = outputDiv.querySelector('iframe')!;
        context.drawWindow(
          iframe.contentWindow!,
          0,
          0,
          width.value,
          height.value,
          'rgba(0, 0, 0, 0)',
        );
      }
    })();

    return () => {
      aborted = true;
    };
  });

  // Play a clip of the audio while scrubbing
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
    const frameDuration = 1000 / project.fps;
    const outputStart = start.value;
    const startFrame = Math.round(outputStart / frameDuration);
    const endFrame = Math.round(duration.value / frameDuration);
    const framesPerChunk = Math.max(
      1,
      Math.round(chunkDuration / frameDuration),
    );
    const chunkFrameCounts: number[] = [];

    for (
      let chunkStart = startFrame;
      chunkStart < endFrame;
      chunkStart += framesPerChunk
    )
      chunkFrameCounts.push(Math.min(framesPerChunk, endFrame - chunkStart));

    const { dir: chunkDir, completeChunks } = await openVideoChunkDir({
      parentDir: projectDir,
      dirName: chunkDirName,
      // Any project change could affect any frame, so all chunks are discarded when it changes
      fingerprint: {
        project,
        startFrame,
        endFrame,
        framesPerChunk,
        videoEncodingConfig,
      },
      chunkFrameCounts,
    });

    const chunkFileHandles = [...completeChunks];

    if (completeChunks.length) {
      console.log(
        `reusing ${completeChunks.length} chunk(s) from a previous output`,
      );
    }

    let lastPauseAt = performance.now();

    for (
      let chunkIndex = completeChunks.length;
      chunkIndex < chunkFrameCounts.length;
      chunkIndex++
    ) {
      const chunkStartFrame = startFrame + chunkIndex * framesPerChunk;
      const chunkEndFrame = chunkStartFrame + chunkFrameCounts[chunkIndex];
      const chunkFileHandle = await chunkDir.getFileHandle(
        getChunkFileName(chunkIndex),
        { create: true },
      );
      chunkFileHandles.push(chunkFileHandle);

      const chunkOutput = new Output({
        format: new Mp4OutputFormat(),
        target: new StreamTarget(await chunkFileHandle.createWritable()),
      });
      const canvasSource = new CanvasSource(outputCanvas, videoEncodingConfig);
      chunkOutput.addVideoTrack(canvasSource, {
        frameRate: project.fps,
      });

      await chunkOutput.start();

      for (
        let frameValue = chunkStartFrame;
        frameValue < chunkEndFrame;
        frameValue++
      ) {
        frame.value = frameValue;
        await 0;
        await wait();
        await 0;
        await outputCanvasPromise.current;
        await canvasSource.add(
          (frameValue - chunkStartFrame) / project.fps,
          1 / project.fps,
        );
        if (
          supportsDrawElementImage &&
          performance.now() - lastPauseAt >= 30_000
        ) {
          // Works around a crash bug. I should try to remove this at some point.
          await new Promise((resolve) => setTimeout(resolve, 5_000));
          lastPauseAt = performance.now();
        }
      }

      canvasSource.close();
      await chunkOutput.finalize();
      console.log(
        `encoded ${chunkEndFrame - startFrame}/${endFrame - startFrame} frames`,
      );
      // Give the browser a moment to tear the encoder down before starting the next one.
      // await new Promise((resolve) => setTimeout(resolve, 500));
    }

    const chunks: VideoChunk[] = await Promise.all(
      chunkFileHandles.map(async (handle, index) => ({
        file: await handle.getFile(),
        timeOffset: (index * framesPerChunk) / project.fps,
      })),
    );

    const file = await projectDir.getFileHandle('output.mp4', { create: true });

    await muxVideoChunks({
      chunks,
      videoCodec: videoEncodingConfig.codec,
      frameRate: project.fps,
      audioBuffer: await audioTimeline.current.toBuffer(
        project.audioSampleRate,
        outputStart,
        duration.value - outputStart,
      ),
      audioEncodingConfig: { codec: 'pcm-s16' },
      target: new StreamTarget(await file.createWritable()),
    });

    await projectDir.removeEntry(chunkDirName, { recursive: true });
    outputting.value = false;
  }, []);

  return (
    <div class={styles.editor}>
      <div class={styles.stage} ref={stageRef} style={stageStyle}>
        {(framePreviewSetting.value || outputting.value) &&
        supportsDrawElementImage ? (
          <canvas
            content="drawable"
            ref={outputCanvasRef}
            width={width.value}
            height={height.value}
          >
            <div class={styles.output} ref={outputRef} drawable>
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
        )}
        {(framePreviewSetting.value || outputting.value) &&
          !supportsDrawElementImage && (
            // Covers the output, which needs to be rendered for drawWindow to capture it
            <canvas
              ref={outputCanvasRef}
              width={width.value}
              height={height.value}
            />
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
