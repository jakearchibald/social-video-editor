import type { FunctionComponent } from 'preact';
import { useSignal, useSignalEffect, type Signal } from '@preact/signals';
import { useEffect, useRef } from 'preact/hooks';
import { VideoFrameDecoder } from '../../../../utils/video-decoder';
import { parseTime } from '../../../../utils/time';
import useOptimComputed from '../../../../utils/useOptimComputed';

import styles from './styles.module.css';

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
  const videoDecoder = useSignal<VideoFrameDecoder | null>(null);
  const canvasContextRef = useRef<CanvasRenderingContext2D | null>(null);

  useEffect(() => {
    (async () => {
      const path = new URL(source, 'https://example.com/').pathname.slice(1);
      const splitPath = path.split('/');
      const dirPaths = splitPath.slice(0, -1);
      const fileName = splitPath.at(-1)!;

      let dirHandle = projectDir;
      for (const dirPath of dirPaths) {
        dirHandle = await dirHandle.getDirectoryHandle(dirPath);
      }
      const fileHandle = await dirHandle.getFileHandle(fileName);
      const file = await fileHandle.getFile();

      const decoder = new VideoFrameDecoder(file);
      await decoder.ready;
      videoDecoder.value = decoder;
    })();
  }, [projectDir, source]);

  useSignalEffect(() => {
    const decoder = videoDecoder.value;
    if (!decoder) return;

    const frameTime = videoTime.value;
    const canvas = canvasRef.current!;

    if (!canvasContextRef.current) {
      const ctx = canvas.getContext('2d')!;
      canvasContextRef.current = ctx;
      canvas.width = decoder.videoData!.width;
      canvas.height = decoder.videoData!.height;
    }

    const ctx = canvasContextRef.current;
    let aborted = false;

    (async () => {
      try {
        const frame = await decoder.getFrameAt(frameTime);
        if (!frame) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(frame.canvas, 0, 0);
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        throw err;
      }
    })();

    return () => {
      aborted = true;
    };
  });

  console.log('render');

  return <canvas ref={canvasRef} class={styles.canvas} />;
};

export default Video;
