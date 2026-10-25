import type { FunctionComponent } from 'preact';
import { type Signal, useComputed } from '@preact/signals';
import { useRef } from 'preact/hooks';
import { VideoFrameDecoder } from '../../../utils/video-decoder';
import useSignalLayoutEffect from '../../../utils/useSignalLayoutEffect';
import styles from './styles.module.css';
import { waitUntil } from '../../../utils/waitUntil';
import type { VideoClipTimelineItem } from '../../../../project-schema/timeline-items/video';
import { parseTime } from '../../../utils/time';

interface Props {
  file: Signal<Blob>;
  start: Signal<number>;
  time: Signal<number>;
  initialPlaybackRate?: Signal<number>;
  videoStart?: Signal<number | undefined>;
  timeline?: VideoClipTimelineItem[];
  posterImage?: (
    | { file: File }
    | { frameTime: number }
  ) & { duration: number };
}

const BaseVideo: FunctionComponent<Props> = ({
  file,
  start,
  time,
  videoStart,
  timeline,
  initialPlaybackRate,
  posterImage,
}) => {
  const localTime = useComputed(() => time.value - start.value);

  const videoTime = useComputed(() => {
    const local = localTime.value;
    const currentTime = time.value;
    const baseVideoStart = videoStart?.value || 0;

    // If no timeline or initialPlaybackRate, use simple calculation
    if (!timeline || timeline.length === 0) {
      const rate = initialPlaybackRate?.value ?? 1;
      return baseVideoStart + local * rate;
    }

    // Sort timeline items by start time
    const sortedTimeline = [...timeline].sort((a, b) => {
      const aStart = parseTime(a.start);
      const bStart = parseTime(b.start);
      return aStart - bStart;
    });

    let currentVideoTime = baseVideoStart;
    let currentAbsoluteTime = start.value;
    let currentPlaybackRate = initialPlaybackRate?.value ?? 1;

    // Process each timeline item up to the current time
    for (const item of sortedTimeline) {
      if (item.type !== 'time-change') continue;
      const itemStart = parseTime(item.start);

      if (itemStart > currentTime) break;

      // Add elapsed time at current playback rate
      const elapsed = itemStart - currentAbsoluteTime;
      currentVideoTime += elapsed * currentPlaybackRate;
      currentAbsoluteTime = itemStart;

      // Apply time change
      if (item.videoTime !== undefined) {
        currentVideoTime = parseTime(item.videoTime);
      }

      // Update playback rate
      if (item.playbackRate !== undefined) {
        currentPlaybackRate = item.playbackRate;
      }
    }

    // Add remaining time at current playback rate
    const remainingTime = currentTime - currentAbsoluteTime;
    currentVideoTime += remainingTime * currentPlaybackRate;

    return currentVideoTime;
  });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const decoders = useRef(new Map<Blob, Promise<VideoFrameDecoder>>());
  const posterImageRef = useRef<ImageBitmap | null>(null);

  useSignalLayoutEffect(() => {
    const frameTime = videoTime.value;
    const videoFile = file.value;
    const canvas = canvasRef.current!;
    const currentTime = time.value;
    const startTime = start.value;
    let aborted = false;

    const getDecoder = () => {
      let decoder = decoders.current.get(videoFile);
      if (!decoder) {
        decoder = (async () => {
          const videoDecoder = new VideoFrameDecoder(videoFile);
          await videoDecoder.ready;
          return videoDecoder;
        })();
        decoders.current.set(videoFile, decoder);
      }
      return decoder;
    };

    const draw = (image: CanvasImageSource, width: number, height: number) => {
      // Files can differ in resolution, such as a proxy and its source
      if (canvas.width !== width) canvas.width = width;
      if (canvas.height !== height) canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(image, 0, 0, width, height);
    };

    const drawVideoFrame = async (at: number) => {
      const videoDecoder = await getDecoder();

      try {
        const frame = await videoDecoder.getFrameAt(at);
        if (!frame || aborted) return;
        const { width, height } = videoDecoder.videoData!;
        draw(frame.canvas, width, height);
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        throw err;
      }
    };

    const p = (async () => {
      const posterEnd = posterImage ? startTime + posterImage.duration : 0;

      if (!posterImage || currentTime >= posterEnd) {
        await drawVideoFrame(frameTime);
        return;
      }

      // A poster sourced from a frame of the video itself
      if ('frameTime' in posterImage) {
        await drawVideoFrame(posterImage.frameTime);
        return;
      }

      // A poster sourced from a separate image file
      if (!posterImageRef.current)
        posterImageRef.current = await createImageBitmap(posterImage.file);

      if (aborted) return;
      const bitmap = posterImageRef.current;
      draw(bitmap, bitmap.width, bitmap.height);
    })();

    waitUntil(p);

    return () => {
      aborted = true;
    };
  });

  console.log('render');

  return <canvas ref={canvasRef} class={styles.canvas} />;
};

export default BaseVideo;
