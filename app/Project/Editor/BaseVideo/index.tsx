import type { FunctionComponent } from 'preact';
import { type Signal } from '@preact/signals';
import { useRef } from 'preact/hooks';
import { VideoFrameDecoder } from '../../../utils/video-decoder';
import useOptimComputed from '../../../utils/useOptimComputed';
import useSignalLayoutEffect from '../../../utils/useSignalLayoutEffect';
import styles from './styles.module.css';
import { waitUntil } from '../../../utils/waitUntil';

interface Props {
  file: File;
  start: Signal<number>;
  time: Signal<number>;
  videoStart: Signal<number | undefined>;
}

const BaseVideo: FunctionComponent<Props> = ({
  file,
  start,
  time,
  videoStart,
}) => {
  const localTime = useOptimComputed(() => time.value - start.value);

  const videoTime = useOptimComputed(
    () => localTime.value + (videoStart.value || 0)
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

export default BaseVideo;
