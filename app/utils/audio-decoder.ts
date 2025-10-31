import { BlobSource, Input, MP3, MP4, WAVE, AudioBufferSink } from 'mediabunny';

export class AudioFileDecoder {
  #input!: Input;
  #ready: Promise<void>;
  #bufferSink?: AudioBufferSink;

  constructor(file: File) {
    this.#input = new Input({
      source: new BlobSource(file),
      formats: [MP4, MP3, WAVE],
    });

    this.#ready = (async () => {
      const track = await this.#input.getPrimaryAudioTrack();
      if (!track) return;
      this.#bufferSink = new AudioBufferSink(track);
    })();
  }

  #getSampleController: AbortController | null = null;

  async *getFrames(startTime: number, endTime: number) {
    if (!this.#bufferSink) return;
    if (this.#getSampleController) {
      this.#getSampleController.abort();
    }
    this.#getSampleController = new AbortController();
    const signal = this.#getSampleController.signal;

    const startSec = startTime / 1000;
    const endSec = endTime / 1000;

    await this.#ready;
    signal.throwIfAborted();

    for await (const result of this.#bufferSink.buffers(startSec)) {
      signal.throwIfAborted();
      if (result.timestamp + result.duration >= endSec) break;
      yield result;
    }
  }
}
