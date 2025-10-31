import {
  BlobSource,
  CanvasSink,
  Input,
  MP4,
  type WrappedCanvas,
} from 'mediabunny';

interface VideoData {
  width: number;
  height: number;
}

export class VideoFrameDecoder {
  #input!: Input;
  ready: Promise<void>;
  #canvasSink?: CanvasSink;
  #videoData?: VideoData;
  #iterator?: AsyncGenerator<WrappedCanvas, void, unknown>;
  #nowNext: [WrappedCanvas | null, WrappedCanvas | null] = [null, null];

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
      this.#canvasSink = new CanvasSink(track!, { poolSize: 2 });
    })();
  }

  get videoData(): VideoData | undefined {
    return this.#videoData;
  }

  #getSampleController: AbortController | null = null;
  #fetchForwardPromise: Promise<void> | null = null;

  async getFrameAt(time: number): Promise<WrappedCanvas | null> {
    const frameTime = time / 1000;

    if (this.#getSampleController) {
      this.#getSampleController.abort();
    }
    this.#getSampleController = new AbortController();
    const signal = this.#getSampleController.signal;

    await this.ready;
    await this.#fetchForwardPromise;
    signal?.throwIfAborted();

    if (this.#iterator) {
      // Try to optimise by decoding forward if possible

      // Requested frame is same as current frame?
      if (
        this.#nowNext[0] &&
        frameTime >= this.#nowNext[0].timestamp &&
        frameTime < this.#nowNext[0].timestamp + this.#nowNext[0].duration
      ) {
        return this.#nowNext[0];
      }

      // Requested frame is next frame?
      if (
        this.#nowNext[1] &&
        frameTime >= this.#nowNext[1].timestamp &&
        frameTime < this.#nowNext[1].timestamp + this.#nowNext[1].duration
      ) {
        // Request next frame and shift the stored frames
        this.#fetchForwardPromise = (async () => {
          const nextFrame = await this.#iterator!.next();
          this.#nowNext[0] = this.#nowNext[1];
          this.#nowNext[1] = nextFrame.value || null;
        })();

        return this.#nowNext[1];
      }

      // Nah, we have to seek
      this.#iterator.return();
    }

    this.#iterator = this.#canvasSink!.canvases(frameTime);
    this.#nowNext = [null, null];
    const frame = await this.#iterator.next();
    signal?.throwIfAborted();

    this.#nowNext[0] = frame.value || null;

    this.#fetchForwardPromise = (async () => {
      for (let i = 1; i < 2; i++) {
        const nextFrame = await this.#iterator!.next();
        this.#nowNext[i] = nextFrame.value || null;
      }
    })();

    return frame.value || null;
  }
}
