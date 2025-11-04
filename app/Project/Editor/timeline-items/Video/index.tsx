import type { FunctionComponent } from 'preact';
import { useSignal, type Signal } from '@preact/signals';
import { useLayoutEffect, useRef } from 'preact/hooks';
import { VideoFrameDecoder } from '../../../../utils/video-decoder';
import { parseTime } from '../../../../utils/time';
import useOptimComputed from '../../../../utils/useOptimComputed';
import useSignalLayoutEffect from '../../../../utils/useSignalLayoutEffect';
import styles from './styles.module.css';
import { waitUntil } from '../../../../utils/waitUntil';
import { getFile } from '../../../../utils/file';
import type { AudioTimelineItem } from '../../../../utils/AudioTimeline';
import type { VideoClip } from '../../../../../project-schema/timeline-items/video';
import type { DeepSignal } from 'deepsignal';

export function getAudioTimelineItems(item: VideoClip): AudioTimelineItem[] {
  const source = item.audioSource || item.source;

  if (!source) return [];

  return [
    {
      start: parseTime(item.start),
      audioStart: parseTime(item.videoStart || 0),
      duration: parseTime(item.duration),
      source,
    },
  ];
}

interface Props {
  projectDir: FileSystemDirectoryHandle;
  time: Signal<number>;
  config: DeepSignal<VideoClip>;
}

const Video: FunctionComponent<Props> = ({ projectDir, time, config }) => {
  const localTime = useOptimComputed(
    () => time.value - parseTime(config.start)
  );

  const videoTime = useOptimComputed(
    () => localTime.value + parseTime(config.videoStart || 0)
  );
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasContextRef = useRef<CanvasRenderingContext2D | null>(null);
  const decoder = useRef<Promise<VideoFrameDecoder> | null>(null);

  useSignalLayoutEffect(() => {
    const frameTime = videoTime.value;
    const canvas = canvasRef.current!;
    let aborted = false;

    const p = (async () => {
      if (!decoder.current) {
        const p = (async () => {
          const file = await getFile(projectDir, config.source);
          const videoDecoder = new VideoFrameDecoder(file);
          await videoDecoder.ready;
          return videoDecoder;
        })();
        decoder.current = p;
      }

      const videoDecoder = (await decoder.current)!;

      if (!canvasContextRef.current) {
        const ctx = canvas.getContext('2d')!;
        canvasContextRef.current = ctx;
        canvas.width = videoDecoder.videoData!.width;
        canvas.height = videoDecoder.videoData!.height;
      }

      const ctx = canvasContextRef.current!;
      try {
        const frame = await videoDecoder.getFrameAt(frameTime);

        if (!frame || aborted) return;
        ctx.drawImage(frame.canvas, 0, 0);
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        throw err;
      }
    })();

    waitUntil(p);

    return () => {
      aborted = true;
    };
  });

  console.log('render');

  return <canvas ref={canvasRef} class={styles.canvas} />;
};

export default Video;
