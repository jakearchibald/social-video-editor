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
  file: Blob;
  start: Signal<number>;
  time: Signal<number>;
  initialPlaybackRate?: Signal<number>;
  videoStart?: Signal<number | undefined>;
  timeline?: VideoClipTimelineItem[];
  posterImage?: { file: File; duration: number };
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
  const canvasContextRef = useRef<CanvasRenderingContext2D | null>(null);
  const decoder = useRef<Promise<VideoFrameDecoder> | null>(null);
  const posterImageRef = useRef<ImageBitmap | null>(null);

  useSignalLayoutEffect(() => {
    const frameTime = videoTime.value;
    const canvas = canvasRef.current!;
    const currentTime = time.value;
    const startTime = start.value;
    let aborted = false;

    const p = (async () => {
      // Check if we should render the poster image
      const posterEnd = posterImage ? startTime + posterImage.duration : 0;

      if (posterImage && currentTime < posterEnd) {
        // Load poster image if not already loaded
        if (!posterImageRef.current) {
          const bitmap = await createImageBitmap(posterImage.file);
          posterImageRef.current = bitmap;
        }

        const bitmap = posterImageRef.current;

        if (!canvasContextRef.current) {
          const ctx = canvas.getContext('2d')!;
          canvasContextRef.current = ctx;
          canvas.width = bitmap.width;
          canvas.height = bitmap.height;
        }

        const ctx = canvasContextRef.current!;
        if (aborted) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(bitmap, 0, 0);
        return;
      }

      // Render video frame
      if (!decoder.current) {
        const p = (async () => {
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
        ctx.clearRect(0, 0, canvas.width, canvas.height);
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

export default BaseVideo;
