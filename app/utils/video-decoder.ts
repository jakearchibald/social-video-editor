import { BlobSource, Input, MP4, VideoSampleSink } from 'mediabunny';

interface VideoData {
  width: number;
  height: number;
}

export class VideoFrameDecoder {
  #input: Input;
  ready: Promise<void>;
  #videoSink?: VideoSampleSink;
  #videoData?: VideoData;

  constructor(file: File) {
    this.#input = new Input({
      source: new BlobSource(file),
      formats: [MP4],
    });

    this.ready = (async () => {
      const track = await this.#input.getPrimaryVideoTrack();
      this.#videoData = {
        width: track?.displayWidth || 0,
        height: track?.displayHeight || 0,
      };
      this.#videoSink = new VideoSampleSink(track!);
    })();
  }

  get videoData(): VideoData | undefined {
    return this.#videoData;
  }

  async drawFrameAt(
    time: number,
    ctx: CanvasRenderingContext2D
  ): Promise<void> {
    await this.ready;
    const sample = await this.#videoSink!.getSample(time);
    sample!.draw(ctx, 0, 0);
  }

  destroy(): void {
    // TODO
  }
}
