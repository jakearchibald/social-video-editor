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
  /** Playback rate, where 1 is normal. Defaults to 1 */
  playbackRate?: number;
}

interface ScheduleItem {
  buffer: AudioBuffer;
  /** Offset in ms from the start of the play range to when the buffer starts playing */
  delay: number;
  /** Offset in seconds into the buffer to start playing from */
  offset: number;
  /** How long to play for, in ms, from the point playback starts */
  duration: number;
  volume?: number;
  playbackRate: number;
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
      // Audio can't be played at a stopped or reversed rate
      if ((item.playbackRate ?? 1) <= 0) return false;
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
          const playbackRate = item.playbackRate ?? 1;
          // Converts a time relative to the play range into a time within the audio file
          const toAudioTime = (time: number) =>
            item.audioStart + (start + time - item.start) * playbackRate;
          // The range, relative to the play range, during which this item plays
          const playFrom = Math.max(0, item.start - start);
          const playUntil = Math.min(
            duration,
            item.start + item.duration - start
          );
          const audioFrom = toAudioTime(playFrom);

          const iterator = decoder.getFrames(
            Math.max(0, audioFrom),
            toAudioTime(playUntil)
          );

          while (true) {
            const { value: wrappedBuffer, done } = await iterator.next();
            if (done) break;

            // Buffers may extend beyond either end of the item, as they're
            // only decoded in whole chunks.
            const bufferDelay =
              (wrappedBuffer.timestamp * 1000 - audioFrom) / playbackRate +
              playFrom;
            const delay = Math.max(bufferDelay, playFrom);
            const playDuration = playUntil - delay;
            if (playDuration <= 0) continue;

            schedule.push({
              buffer: wrappedBuffer.buffer,
              delay,
              offset: ((delay - bufferDelay) * playbackRate) / 1000,
              duration: playDuration,
              volume: item.volume,
              playbackRate,
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
      source.playbackRate.value = item.playbackRate;

      if (item.volume !== undefined && item.volume !== 1) {
        const gain = ctx.createGain();
        gain.gain.value = item.volume;
        source.connect(gain);
        gain.connect(ctx.destination);
      } else {
        source.connect(ctx.destination);
      }

      source.start(
        currentTime + item.delay / 1000,
        item.offset,
        // Duration is in buffer time, so it's affected by playback rate
        (item.duration * item.playbackRate) / 1000
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
