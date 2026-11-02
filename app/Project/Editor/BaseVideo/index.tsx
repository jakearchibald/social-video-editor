import type { FunctionComponent } from 'preact';
import { type Signal, useComputed } from '@preact/signals';
import { useRef } from 'preact/hooks';
import { VideoFrameDecoder } from '../../../utils/video-decoder';
import useSignalLayoutEffect from '../../../utils/useSignalLayoutEffect';
import styles from './styles.module.css';
import { waitUntil } from '../../../utils/waitUntil';
import type { VideoClipTimelineItem } from '../../../../project-schema/timeline-items/video';
import { getMediaTime, getTimeSegments } from '../../../utils/time-segments';
import { wrapLoopTime } from '../../../utils/loop';

interface Props {
  file: Signal<Blob>;
  start: Signal<number>;
  time: Signal<number>;
  initialPlaybackRate?: Signal<number>;
  videoStart?: Signal<number | undefined>;
  timeline?: VideoClipTimelineItem[];
  /** Times within the video file, in ms. `end` defaults to the end of the file. */
  loop?: Signal<{ start: number; end?: number } | undefined>;
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
  loop,
  posterImage,
}) => {
  const timeSegments = useComputed(() =>
    getTimeSegments(
      start.value,
      videoStart?.value || 0,
      initialPlaybackRate?.value ?? 1,
      timeline
        ?.filter((item) => item.type === 'time-change')
        .map((item) => ({
          start: item.start,
          playbackRate: item.playbackRate,
          mediaTime: item.videoTime,
        })),
    ),
  );

  const videoTime = useComputed(() =>
    getMediaTime(timeSegments.value, time.value),
  );

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const decoders = useRef(new Map<Blob, Promise<VideoFrameDecoder>>());
  const posterImageRef = useRef<ImageBitmap | null>(null);

  useSignalLayoutEffect(() => {
    const frameTime = videoTime.value;
    const videoFile = file.value;
    const canvas = canvasRef.current!;
    const currentTime = time.value;
    const startTime = start.value;
    const loopValue = loop?.value;
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
      const { width, height } = videoDecoder.videoData!;

      try {
        const frame = await videoDecoder.getFrameAt(at);
        if (!frame || aborted) return;
        draw(frame.canvas, width, height);
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        throw err;
      }
    };

    const p = (async () => {
      const posterEnd = posterImage ? startTime + posterImage.duration : 0;

      if (!posterImage || currentTime >= posterEnd) {
        if (!loopValue) {
          await drawVideoFrame(frameTime);
          return;
        }

        const videoDecoder = await getDecoder();
        const loopEnd = loopValue.end ?? videoDecoder.videoData!.duration;
        await drawVideoFrame(wrapLoopTime(frameTime, loopValue.start, loopEnd));
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
