import type {
  ChildrenTimelineItem,
  Project,
} from '../../project-schema/schema';
import { getAudioTimelineItems as getAudioItemTimelineItems } from '../Project/Editor/timeline-items/Audio';
import { getAudioTimelineItems as getVideoAudioTimelineItems } from '../Project/Editor/timeline-items/Video';
import { ALL_FORMATS, BlobSource, Input } from 'mediabunny';
import { AudioFileDecoder } from './audio-decoder';
import { getFile } from './file';
import { parseTime } from './time';
import { getEndTime, getStartTime } from './timeline-item';
import { getVolume, type VolumeKeyframe } from './volume-keyframes';
import { wrapLoopTime } from './loop';

export interface AudioTimelineItem {
  start: number;
  audioStart: number;
  duration: number;
  source: string;
  /** Volume over time. Defaults to 1 */
  volume?: VolumeKeyframe[];
  /** Playback rate, where 1 is normal. Defaults to 1 */
  playbackRate?: number;
  loop?: AudioLoop;
}

export interface AudioLoop {
  /** Time within the audio file to loop back to, in ms */
  start: number;
  /**
   * Time within the audio file at which to loop, in ms. Defaults to the duration of
   * `durationSource` plus `durationOffset`.
   */
  end?: number;
  /** File used to calculate the default end. Defaults to the audio source. */
  durationSource?: string;
  /** Offset in ms added to the duration to calculate the default end. Defaults to 0. */
  durationOffset?: number;
}

interface ScheduleItem {
  buffer: AudioBuffer;
  /** Offset in ms from the start of the play range to when the buffer starts playing */
  delay: number;
  /** Offset in seconds into the buffer to start playing from */
  offset: number;
  /** How long to play for, in ms, from the point playback starts */
  duration: number;
  volume?: VolumeKeyframe[];
  playbackRate: number;
}

/**
 * Schedule volume keyframes on an AudioParam.
 *
 * @param start Absolute time, in ms, that corresponds to `contextStart`
 * @param contextStart Audio context time, in seconds, that corresponds to `start`
 */
function scheduleVolume(
  param: AudioParam,
  keyframes: VolumeKeyframe[],
  start: number,
  contextStart: number
) {
  param.setValueAtTime(getVolume(keyframes, start), contextStart);
  let prevTime = start;

  for (const keyframe of keyframes) {
    if (keyframe.time <= start) continue;
    const contextTime = contextStart + (keyframe.time - start) / 1000;

    // Keyframes at the same time are an instant change
    if (keyframe.time === prevTime) {
      param.setValueAtTime(keyframe.volume, contextTime);
    } else {
      param.linearRampToValueAtTime(keyframe.volume, contextTime);
    }

    prevTime = keyframe.time;
  }
}

const audioFileDecoders = new WeakMap<object, Promise<AudioFileDecoder>>();

export class AudioTimeline {
  #items: AudioTimelineItem[] = [];
  #projectDir: FileSystemDirectoryHandle;
  #audioContext?: AudioContext;
  #playAbortController?: AbortController;
  /** Duration in ms of each source */
  #durations = new Map<string, Promise<number>>();

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
    this.#durations.clear();
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

  #getDuration(source: string): Promise<number> {
    let duration = this.#durations.get(source);
    if (!duration) {
      duration = (async () => {
        const input = new Input({
          source: new BlobSource(await getFile(this.#projectDir, source)),
          formats: ALL_FORMATS,
        });
        return (await input.computeDuration()) * 1000;
      })();
      this.#durations.set(source, duration);
    }
    return duration;
  }

  async #resolveLoop(
    loop: AudioLoop,
    source: string
  ): Promise<{ start: number; end: number } | undefined> {
    const end =
      loop.end ??
      (await this.#getDuration(loop.durationSource ?? source)) +
        (loop.durationOffset ?? 0);
    if (end <= loop.start) return undefined;
    return { start: loop.start, end };
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
          const loop =
            item.loop && (await this.#resolveLoop(item.loop, item.source));
          // Converts a time relative to the play range into a time within the audio file,
          // ignoring looping
          const toAudioTime = (time: number) =>
            item.audioStart + (start + time - item.start) * playbackRate;
          // The range, relative to the play range, during which this item plays
          const playFrom = Math.max(0, item.start - start);
          const playUntil = Math.min(
            duration,
            item.start + item.duration - start
          );

          // Play in pieces that run continuously through the audio file, as
          // looping jumps back to the loop start.
          let pieceFrom = playFrom;
          let audioFrom = toAudioTime(playFrom);
          if (loop) audioFrom = wrapLoopTime(audioFrom, loop.start, loop.end);

          while (pieceFrom < playUntil) {
            const pieceUntil = loop
              ? Math.min(
                  playUntil,
                  pieceFrom + (loop.end - audioFrom) / playbackRate
                )
              : playUntil;

            const iterator = decoder.getFrames(
              Math.max(0, audioFrom),
              audioFrom + (pieceUntil - pieceFrom) * playbackRate
            );

            while (true) {
              const { value: wrappedBuffer, done } = await iterator.next();
              if (done) break;

              // Buffers may extend beyond either end of the piece, as they're
              // only decoded in whole chunks.
              const bufferDelay =
                (wrappedBuffer.timestamp * 1000 - audioFrom) / playbackRate +
                pieceFrom;
              const delay = Math.max(bufferDelay, pieceFrom);
              const playDuration = pieceUntil - delay;
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

            if (!loop) break;
            pieceFrom = pieceUntil;
            audioFrom = loop.start;
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

      if (item.volume) {
        const gain = ctx.createGain();
        scheduleVolume(gain.gain, item.volume, start, currentTime);
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
