// Largely adapted from https://w3c.github.io/webcodecs/samples/video-decode-display/demuxer_mp4.js

import {
  createFile,
  ISOFile,
  Log,
  type Movie,
  type Track,
  VisualSampleEntry,
  MultiBufferStream,
  MP4BoxBuffer,
  type Sample,
} from 'mp4box';

Log.setLogLevel(Log.debug);

function createDescription(track: Track, mp4boxFile: ISOFile): Uint8Array {
  const trak = mp4boxFile.getTrackById(track.id);

  for (const entry of trak.mdia.minf.stbl.stsd.entries as VisualSampleEntry[]) {
    const box = entry.avcC || entry.hvcC || entry.vpcC || entry.av1C;

    if (box) {
      const stream = new MultiBufferStream(undefined);
      box.write(stream);
      return new Uint8Array(stream.buffer, 8); // Remove the box header.
    }
  }
  throw new Error('avcC, hvcC, vpcC, or av1C box not found');
}

interface VideoInfo {
  id: number;
  width: number;
  height: number;
  codec: string;
  description: Uint8Array;
  duration: number;
}

export class VideoFrameDecoder {
  #file: File;
  #mp4boxFile = createFile(true);
  #initPromise?: Promise<void>;
  #videoInfo?: VideoInfo;

  constructor(file: File) {
    this.#file = file;
  }

  async #init(): Promise<void> {
    if (this.#initPromise) return this.#initPromise;

    this.#initPromise = (async () => {
      const readyPromise = new Promise<void>((resolve, reject) => {
        this.#mp4boxFile.onError = (error) => {
          reject(error);
        };

        this.#mp4boxFile.onReady = (info: Movie) => {
          const track = info.videoTracks[0];
          this.#videoInfo = {
            id: track.id,
            width: track.video!.width,
            height: track.video!.height,
            codec: track.codec.startsWith('vp08') ? 'vp8' : track.codec,
            description: createDescription(track, this.#mp4boxFile),
            duration: (track.duration / info.timescale) * 1000,
          };
          this.#mp4boxFile.setExtractionOptions(track.id, null, {
            nbSamples: Infinity,
          });
          this.#mp4boxFile.start();
          resolve();
        };
      });

      const fileBuffer = await this.#file.arrayBuffer();
      const boxBuffer = MP4BoxBuffer.fromArrayBuffer(fileBuffer, 0);
      this.#mp4boxFile.appendBuffer(boxBuffer);
      this.#mp4boxFile.flush();
    })();

    return this.#initPromise;
  }

  async getFrameAt(time: number): Promise<ImageBitmap> {
    await this.#init();
    console.log('done!', this.#mp4boxFile);

    const track = this.#mp4boxFile.getTrackById(this.#videoInfo!.id);

    let targetFrameIndex: number = -1;

    for (let i = 0; i < track.samples.length; i++) {
      const sample = track.samples[i];
      const sampleTime = (sample.cts / track.mdia.mdhd.timescale) * 1000;

      if (sampleTime >= time) {
        targetFrameIndex = i;
        break;
      }
    }

    let keyframeIndex = targetFrameIndex;

    while (keyframeIndex > 0 && !track.samples[keyframeIndex].is_sync) {
      keyframeIndex--;
    }

    if (!track.samples[keyframeIndex].is_sync) {
      throw new Error('No keyframe found before target frame');
    }

    const samples: Sample[] = [];

    for (let i = keyframeIndex; i <= targetFrameIndex; i++) {
      samples.push(this.#mp4boxFile.getSample(track, i));
    }

    const encodedChunks: EncodedVideoChunk[] = samples.map((sample) => {
      return new EncodedVideoChunk({
        type: sample.is_sync ? 'key' : 'delta',
        timestamp: (1e6 * sample.cts) / sample.timescale,
        duration: (1e6 * sample.duration) / sample.timescale,
        data: sample.data!,
      });
    });

    let videoFrame: VideoFrame | null = null;

    const decoder = new VideoDecoder({
      output: (chunk) => {
        videoFrame = chunk;
      },
      error: (error) => {
        console.error('Decoder error:', error);
      },
    });

    decoder.configure({
      codec: this.#videoInfo!.codec,
      codedWidth: this.#videoInfo!.width,
      codedHeight: this.#videoInfo!.height,
      description: this.#videoInfo!.description,
    });

    for (const chunk of encodedChunks) {
      decoder.decode(chunk);
    }

    await decoder.flush();

    if (!videoFrame) {
      throw new Error('Failed to decode video frame');
    }

    return createImageBitmap(videoFrame);
  }

  destroy(): void {
    // TODO
  }
}
