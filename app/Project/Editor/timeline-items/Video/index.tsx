import type { FunctionComponent } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { VideoFrameDecoder } from '../../../../utils/video-decoder';

interface Props {
  projectDir: FileSystemDirectoryHandle;
  source: string;
}

const Video: FunctionComponent<Props> = ({ projectDir, source }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoDecoderRef = useRef<VideoFrameDecoder | null>(null);

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
      videoDecoderRef.current = decoder;

      // Get the first frame and draw it
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('bitmaprenderer');
      if (!ctx) {
        console.error('bitmaprenderer not supported');
        return;
      }

      try {
        const bitmap = await decoder.getFrameAt(26_000);
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        ctx.transferFromImageBitmap(bitmap);
      } catch (error) {
        console.error('Failed to decode frame:', error);
      }
    })();

    return () => {
      videoDecoderRef.current?.destroy();
    };
  }, [projectDir, source]);

  return <canvas ref={canvasRef} />;
};

export default Video;
