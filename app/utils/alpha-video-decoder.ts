import {
  CustomVideoDecoder,
  EncodedPacket,
  VideoSample,
  type VideoCodec,
} from 'mediabunny';

const maxQueueSize = 4;

/**
 * Decodes video with separately-encoded alpha (such as VP9 with alpha in WebM) by merging the
 * decoded color and alpha frames on the CPU. Mediabunny merges them with WebGL instead, which is
 * very slow in Firefox, as each frame is copied between the CPU and GPU several times.
 */
export class CPUAlphaVideoDecoder extends CustomVideoDecoder {
  #colorDecoder!: VideoDecoder;
  #alphaDecoder!: VideoDecoder;
  #colorFrames: VideoFrame[] = [];
  #alphaFrames: VideoFrame[] = [];
  /** Whether each packet passed to the decoder had alpha data, in decode order. */
  #packetHasAlpha: boolean[] = [];
  #error: unknown = null;
  /** Merges and emits frames one at a time, keeping them in order. */
  #emitting = Promise.resolve();
  #merger = new AlphaMerger();

  static supports(codec: VideoCodec) {
    return codec === 'vp8' || codec === 'vp9' || codec === 'av1';
  }

  init() {
    const onError = (error: unknown) => {
      this.#error = error;
    };
    this.#colorDecoder = new VideoDecoder({
      output: (frame) => {
        this.#colorFrames.push(frame);
        this.#emitReady();
      },
      error: onError,
    });
    this.#alphaDecoder = new VideoDecoder({
      output: (frame) => {
        this.#alphaFrames.push(frame);
        this.#emitReady();
      },
      error: onError,
    });
    // In the patched Firefox build, this produces I420 frames in CPU memory, which merge cheaply
    const config: VideoDecoderConfig = {
      ...this.config,
      hardwareAcceleration: 'prefer-software',
    };
    this.#colorDecoder.configure(config);
    this.#alphaDecoder.configure(config);
  }

  async decode(packet: EncodedPacket) {
    if (this.#error) throw this.#error;

    this.#colorDecoder.decode(packet.toEncodedVideoChunk());
    const hasAlpha = !!packet.sideData.alpha;
    this.#packetHasAlpha.push(hasAlpha);
    if (hasAlpha) this.#alphaDecoder.decode(packet.alphaToEncodedVideoChunk());

    while (
      this.#colorDecoder.decodeQueueSize > maxQueueSize ||
      this.#alphaDecoder.decodeQueueSize > maxQueueSize
    ) {
      await Promise.race([
        new Promise((r) =>
          this.#colorDecoder.addEventListener('dequeue', r, { once: true }),
        ),
        new Promise((r) =>
          this.#alphaDecoder.addEventListener('dequeue', r, { once: true }),
        ),
      ]);
    }
  }

  async flush() {
    await Promise.all([this.#colorDecoder.flush(), this.#alphaDecoder.flush()]);
    this.#emitReady();
    await this.#emitting;
    for (const frame of [...this.#colorFrames, ...this.#alphaFrames])
      frame.close();
    this.#colorFrames.length = 0;
    this.#alphaFrames.length = 0;
    this.#packetHasAlpha.length = 0;
  }

  close() {
    for (const decoder of [this.#colorDecoder, this.#alphaDecoder])
      if (decoder.state !== 'closed') decoder.close();
    for (const frame of [...this.#colorFrames, ...this.#alphaFrames])
      frame.close();
  }

  /** Queues frames for emitting once their color and alpha (if any) are both decoded. */
  #emitReady() {
    while (this.#colorFrames.length) {
      const hasAlpha = this.#packetHasAlpha[0];
      if (hasAlpha && !this.#alphaFrames.length) return;

      this.#packetHasAlpha.shift();
      const color = this.#colorFrames.shift()!;
      const alpha = hasAlpha ? this.#alphaFrames.shift()! : null;

      this.#emitting = this.#emitting.then(async () => {
        try {
          const frame = alpha ? await this.#merger.merge(color, alpha) : color;
          this.onSample(new VideoSample(frame));
        } catch (error) {
          this.#error = error;
        } finally {
          if (alpha) {
            color.close();
            alpha.close();
          }
        }
      });
    }
  }
}

class AlphaMerger {
  #buffer = new Uint8Array(0);

  #getBuffer(size: number) {
    if (this.#buffer.length < size) this.#buffer = new Uint8Array(size);
    return this.#buffer;
  }

  merge(color: VideoFrame, alpha: VideoFrame) {
    if (color.format === 'I420' && alpha.format === 'I420')
      return this.#mergeI420(color, alpha);
    return this.#mergeRGBA(color, alpha);
  }

  /**
   * Converts the color frame to RGBA, and takes alpha from the alpha frame's luma plane. Firefox
   * ignores the alpha plane when drawing I420A frames, so they can't be used instead.
   */
  async #mergeI420(color: VideoFrame, alpha: VideoFrame) {
    const { width, height } = color.visibleRect!;
    const chromaWidth = Math.ceil(width / 2);
    const chromaSize = chromaWidth * Math.ceil(height / 2);
    const lumaSize = width * height;
    const size = lumaSize * 4;
    // RGBA, then the alpha frame's luma plane, then its chroma planes, which are ignored
    const buffer = this.#getBuffer(size + lumaSize + chromaSize * 2);
    const lumaOffset = size;
    const chromaOffset = lumaOffset + lumaSize;

    await Promise.all([
      color.copyTo(buffer, { format: 'RGBA' }),
      alpha.copyTo(buffer, {
        layout: [
          { offset: lumaOffset, stride: width },
          { offset: chromaOffset, stride: chromaWidth },
          { offset: chromaOffset + chromaSize, stride: chromaWidth },
        ],
      }),
    ]);

    const lut = alpha.colorSpace.fullRange ? fullRangeLut : limitedRangeLut;
    for (let i = 0; i < lumaSize; i++)
      buffer[i * 4 + 3] = lut[buffer[lumaOffset + i]];

    return createRGBAFrame(buffer.subarray(0, size), color);
  }

  /**
   * For frames that aren't in CPU memory as I420 (such as hardware decoded frames in Firefox on
   * macOS). The alpha frame's red channel is used as alpha, as Mediabunny does.
   */
  async #mergeRGBA(color: VideoFrame, alpha: VideoFrame) {
    const { width, height } = color.visibleRect!;
    const size = width * height * 4;
    const buffer = this.#getBuffer(size * 2);
    const alphaBuffer = buffer.subarray(size);

    await Promise.all([
      color.copyTo(buffer, { format: 'RGBA' }),
      alpha.copyTo(alphaBuffer, { format: 'RGBA' }),
    ]);
    for (let i = 3; i < size; i += 4) buffer[i] = alphaBuffer[i - 3];

    return createRGBAFrame(buffer.subarray(0, size), color);
  }
}

function createRGBAFrame(data: Uint8Array, color: VideoFrame) {
  const { width, height } = color.visibleRect!;
  return new VideoFrame(data, {
    format: 'RGBA',
    codedWidth: width,
    codedHeight: height,
    displayWidth: color.displayWidth,
    displayHeight: color.displayHeight,
    timestamp: color.timestamp,
    duration: color.duration ?? undefined,
  });
}

/** Maps luma to alpha, expanding limited range as the conversion to RGB would. */
const limitedRangeLut = Uint8ClampedArray.from({ length: 256 }, (_, y) =>
  Math.round(((y - 16) * 255) / 219),
);
const fullRangeLut = Uint8Array.from({ length: 256 }, (_, y) => y);
