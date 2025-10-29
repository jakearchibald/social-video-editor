import {
  BlobSource,
  Input,
  MP4,
  VideoSample,
  VideoSampleSink,
} from 'mediabunny';

interface VideoData {
  width: number;
  height: number;
}

export class VideoFrameDecoder {
  #input!: Input;
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

  async getSampleAt(time: number): Promise<VideoSample | null> {
    await this.ready;
    return this.#videoSink!.getSample(time / 1000);
  }
}
