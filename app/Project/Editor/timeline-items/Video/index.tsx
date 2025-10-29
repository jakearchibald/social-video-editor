import type { FunctionComponent } from 'preact';
import {
  useComputed,
  useSignal,
  useSignalEffect,
  type Signal,
} from '@preact/signals';
import { useEffect, useRef } from 'preact/hooks';
import { VideoFrameDecoder } from '../../../../utils/video-decoder';
import useThrottledSignal from '../../../../utils/useThrottledSignal';

interface Props {
  projectDir: FileSystemDirectoryHandle;
  source: string;
  start: number;
  videoStart: number;
  time: Signal<number>;
}

const Video: FunctionComponent<Props> = ({
  projectDir,
  source,
  time,
  videoStart,
  start,
}) => {
  const localTime = useComputed(() => time.value - start);
  const debouncedTime = useThrottledSignal(time, 50);
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

    const frameTime = debouncedTime.value;

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
      const sample = await decoder.getSampleAt(frameTime);
      if (!sample) return;
      if (!aborted) sample.draw(ctx, 0, 0);
      sample.close();
    })();

    return () => {
      aborted = true;
    };
  });

  console.log('render');

  return <canvas ref={canvasRef} />;
};

export default Video;
