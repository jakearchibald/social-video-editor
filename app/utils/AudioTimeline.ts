import type {
  ChildrenTimelineItem,
  Project,
} from '../../project-schema/schema';
import { getAudioTimelineItems as getAudioItemTimelineItems } from '../Project/Editor/timeline-items/Audio';
import { getAudioTimelineItems as getVideoAudioTimelineItems } from '../Project/Editor/timeline-items/Video';
import { AudioFileDecoder } from './audio-decoder';
import { getFile } from './file';
import { parseTime } from './time';
import { getEndTime, getStartTime } from './timeline-item';

export interface AudioTimelineItem {
  start: number;
  audioStart: number;
  duration: number;
  source: string;
  /** 0-1 volume. Defaults to 1 */
  volume?: number;
}

interface ScheduleItem {
  buffer: AudioBuffer;
  /** Offset in ms from the start of the play range to the start of the buffer */
  delay: number;
  /** How long to play for, in ms, from the point playback starts */
  duration: number;
  volume?: number;
}

const audioFileDecoders = new WeakMap<object, Promise<AudioFileDecoder>>();

export class AudioTimeline {
  #items: AudioTimelineItem[] = [];
  #projectDir: FileSystemDirectoryHandle;
  #audioContext?: AudioContext;
  #playAbortController?: AbortController;

  constructor(projectDir: FileSystemDirectoryHandle) {
    this.#projectDir = projectDir;
  }

  #scanTimeline(
    timeline: ChildrenTimelineItem[],
    parentStart: number,
    parentEnd: number
  ) {
    for (const item of timeline) {
      if (item.disabled) continue;

      if (item.type === 'video') {
        this.#items.push(
          ...getVideoAudioTimelineItems(item, parentStart, parentEnd)
        );
      }
      if (item.type === 'audio') {
        this.#items.push(
          ...getAudioItemTimelineItems(item, parentStart, parentEnd)
        );
      }
      if ('childrenTimeline' in item && item.childrenTimeline) {
        this.#scanTimeline(
          item.childrenTimeline,
          getStartTime(item, parentStart),
          getEndTime(item, parentStart, parentEnd)
        );
      }
    }
  }

  buildTimeline(config: Project) {
    this.#items = [];
    const end = parseTime(config.end);
    this.#scanTimeline(config.childrenTimeline, 0, end);
  }

  #getItems(start: number, duration: number): AudioTimelineItem[] {
    const end = start + duration;
    return this.#items.filter((item) => {
      const itemEnd = item.start + item.duration;
      // Item overlaps if it starts before the range ends and ends after the range starts
      return item.start < end && itemEnd > start;
    });
  }

  async #createDecoder(source: string): Promise<AudioFileDecoder> {
    const file = await getFile(this.#projectDir, source);
    const decoder = new AudioFileDecoder(file);
    return decoder;
  }

  async #getToPlay(start: number, duration: number): Promise<ScheduleItem[]> {
    const items = this.#getItems(start, duration);
    const decoders = await Promise.all(
      items.map(async (item) => {
        if (!audioFileDecoders.has(item)) {
          const decoderPromise = this.#createDecoder(item.source);
          audioFileDecoders.set(item, decoderPromise);
        }
        return audioFileDecoders.get(item)!;
      })
    );

    return (
      await Promise.all(
        items.map(async (item, index) => {
          const decoder = await decoders[index];
          const schedule: ScheduleItem[] = [];
          const localAudioTime = start - item.start + item.audioStart;
          // The item may end before the range does, in which case the audio is
          // cut off there. Otherwise it plays until the audio itself runs out.
          const playUntil = Math.min(
            duration,
            item.start + item.duration - start
          );

          const iterator = decoder.getFrames(
            Math.max(0, start - item.start + item.audioStart),
            Math.min(localAudioTime + duration, item.audioStart + item.duration)
          );

          while (true) {
            const { value: wrappedBuffer, done } = await iterator.next();
            if (done) break;

            const delay = wrappedBuffer.timestamp * 1000 - localAudioTime;
            // Buffers may extend beyond the end of the item, as they're only
            // decoded in whole chunks.
            const playDuration = playUntil - Math.max(delay, 0);
            if (playDuration <= 0) continue;

            schedule.push({
              buffer: wrappedBuffer.buffer,
              delay,
              duration: playDuration,
              volume: item.volume,
            });
          }

          return schedule;
        })
      )
    ).flat();
  }

  stop() {
    this.#playAbortController?.abort();
    this.#playAbortController = undefined;
  }

  async #enqueue(
    ctx: AudioContext | OfflineAudioContext,
    start: number,
    duration: number,
    { signal }: { signal?: AbortSignal } = {}
  ) {
    const toPlay = await this.#getToPlay(start, duration);

    signal?.throwIfAborted();

    const currentTime = ctx.currentTime;

    for (const item of toPlay) {
      const source = ctx.createBufferSource();
      source.buffer = item.buffer;

      if (item.volume !== undefined && item.volume !== 1) {
        const gain = ctx.createGain();
        gain.gain.value = item.volume;
        source.connect(gain);
        gain.connect(ctx.destination);
      } else {
        source.connect(ctx.destination);
      }

      source.start(
        item.delay > 0 ? currentTime + item.delay / 1000 : 0,
        item.delay < 0 ? item.delay / -1000 : 0,
        item.duration / 1000
      );

      signal?.addEventListener('abort', () => {
        source.stop();
      });
    }
  }

  async play(start: number, duration: number) {
    this.stop();
    this.#playAbortController = new AbortController();
    const signal = this.#playAbortController.signal;

    if (!this.#audioContext) {
      this.#audioContext = new AudioContext();
    }

    const ctx = this.#audioContext;

    await this.#enqueue(ctx, start, duration, { signal });
  }

  async toBuffer(sampleRate: number, start: number, duration: number) {
    const ctx = new OfflineAudioContext({
      numberOfChannels: 2,
      length: Math.ceil((duration / 1000) * sampleRate),
      sampleRate,
    });

    await this.#enqueue(ctx, start, duration);

    const renderedBuffer = await ctx.startRendering();
    return renderedBuffer;
  }
}
