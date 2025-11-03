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
  source: string;
  start: Signal<number | string>;
  videoStart: Signal<number | string | undefined>;
  time: Signal<number>;
}

const Video: FunctionComponent<Props> = ({
  projectDir,
  source,
  time,
  videoStart,
  start,
}) => {
  const localTime = useOptimComputed(() => time.value - parseTime(start.value));

  const videoTime = useOptimComputed(
    () => localTime.value + parseTime(videoStart.value || 0)
  );
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoFileDecoder = useSignal<VideoFrameDecoder | null>(null);

  const canvasContextRef = useRef<CanvasRenderingContext2D | null>(null);

  useLayoutEffect(() => {
    const p = (async () => {
      const file = await getFile(projectDir, source);

      const videoDecoder = new VideoFrameDecoder(file);
      await videoDecoder.ready;
      videoFileDecoder.value = videoDecoder;
    })();

    waitUntil(p);
  }, [projectDir, source]);

  useSignalLayoutEffect(() => {
    const videoDecoder = videoFileDecoder.value;
    if (!videoDecoder) return;

    const frameTime = videoTime.value;
    const canvas = canvasRef.current!;

    if (!canvasContextRef.current) {
      const ctx = canvas.getContext('2d')!;
      canvasContextRef.current = ctx;
      canvas.width = videoDecoder.videoData!.width;
      canvas.height = videoDecoder.videoData!.height;
    }

    const ctx = canvasContextRef.current!;
    let aborted = false;

    const p = (async () => {
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
