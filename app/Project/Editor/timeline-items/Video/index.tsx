import type { FunctionComponent } from 'preact';
import {
  useSignal,
  type Signal,
  useComputed,
  useSignalEffect,
} from '@preact/signals';
import { useContext, useLayoutEffect } from 'preact/hooks';
import { parseTime } from '../../../../utils/time';
import { waitUntil } from '../../../../utils/waitUntil';
import { getFile } from '../../../../utils/file';
import type {
  AudioLoop,
  AudioTimelineItem,
} from '../../../../utils/AudioTimeline';
import type { VideoClip } from '../../../../../project-schema/timeline-items/video';
import type { DeepSignal } from 'deepsignal';
import BaseVideo from '../../BaseVideo';
import { getDuration, getStartTime } from '../../../../utils/timeline-item';
import { OutputtingContext } from '../../../../utils/outputting-context';
import {
  clipTimeSegments,
  getTimeSegments,
} from '../../../../utils/time-segments';
import { getVolumeKeyframes } from '../../../../utils/volume-keyframes';

export function getAudioTimelineItems(
  item: VideoClip,
  parentStart: number,
  parentEnd: number,
): AudioTimelineItem[] {
  if (item.disabled) return [];

  const source =
    item.audioSource === null ? null : item.audioSource || item.source;

  if (!source) return [];

  const start = getStartTime(item, parentStart);
  const duration = getDuration(item, parentStart, parentEnd);
  const videoStart = parseTime(item.videoStart || 0);
  // The audio is kept in sync with the video, with a fixed offset
  const audioOffset =
    ('audioStart' in item ? parseTime(item.audioStart || 0) : videoStart) -
    videoStart +
    parseTime(item.audioDelay || 0);

  const segments = getTimeSegments(
    start,
    videoStart,
    item.playbackRate ?? 1,
    item.timeline
      ?.filter((change) => change.type === 'time-change')
      .map((change) => ({
        start: change.start,
        playbackRate: change.playbackRate,
        mediaTime: change.videoTime,
      })),
  );
  const volume = getVolumeKeyframes(
    item.volume ?? 1,
    item.timeline?.filter((change) => change.type === 'volume-change'),
  );

  // Loop times are within the video file, so they're offset for the audio. The default end is
  // the end of the video file, so the audio stays in sync even if it's a different length.
  const loop: AudioLoop | undefined = item.loop
    ? {
        start: parseTime(item.loopStart || 0) + audioOffset,
        end:
          item.loopEnd === undefined
            ? undefined
            : parseTime(item.loopEnd) + audioOffset,
        durationSource: item.source,
        durationOffset: audioOffset,
      }
    : undefined;

  return clipTimeSegments(segments, start, start + duration).map(
    (segment) => ({
      start: segment.start,
      audioStart: segment.mediaStart + audioOffset,
      duration: segment.duration,
      playbackRate: segment.playbackRate,
      source,
      volume,
      loop,
    }),
  );
}

/** How long, in ms, a frame needs to be stable before it's shown from the full quality source. */
const proxySettleTime = 1000;

interface Props {
  projectDir: FileSystemDirectoryHandle;
  time: Signal<number>;
  config: DeepSignal<VideoClip>;
  parentStart: number;
  parentEnd: number;
}

const Video: FunctionComponent<Props> = ({
  projectDir,
  time,
  config,
  parentStart,
}) => {
  const outputting = useContext(OutputtingContext);
  const file = useSignal<File | null>(null);
  const proxyFile = useSignal<File | null>(null);
  const posterImageFile = useSignal<File | null>(null);
  /** The most recent time that's been stable for proxySettleTime. */
  const settledTime = useSignal<number | null>(null);
  const activeFile = useComputed(() => {
    if (!proxyFile.value) return file.value;
    if (outputting.value || settledTime.value === time.value) return file.value;
    return proxyFile.value;
  });
  const startValue = useComputed(() => getStartTime(config, parentStart));
  const videoStartValue = useComputed(() => parseTime(config.videoStart || 0));
  const initialPlaybackRate = useComputed(() => config.playbackRate ?? 1);
  const loopProp = useComputed(() => {
    if (!config.loop) return undefined;
    return {
      start: parseTime(config.loopStart || 0),
      end:
        config.loopEnd === undefined ? undefined : parseTime(config.loopEnd),
    };
  });
  const posterImageProp = useComputed(() => {
    const posterImage = config.posterImage;
    if (!posterImage) return undefined;

    const duration =
      posterImage.duration === undefined ? 1 : parseTime(posterImage.duration);

    if ('frameTime' in posterImage) {
      return { frameTime: parseTime(posterImage.frameTime), duration };
    }

    if (!posterImageFile.value) return undefined;
    return { file: posterImageFile.value, duration };
  });

  useLayoutEffect(() => {
    const videoP = (async () => {
      file.value = await getFile(projectDir, config.source);
    })();

    const proxyP = (async () => {
      if (!config.proxySource) return;
      proxyFile.value = await getFile(projectDir, config.proxySource);
    })();

    const posterP = (async () => {
      const posterImage = config.posterImage;
      if (!posterImage || !('source' in posterImage)) return;
      posterImageFile.value = await getFile(projectDir, posterImage.source);
    })();

    waitUntil(videoP);
    waitUntil(proxyP);
    waitUntil(posterP);
  }, []);

  useSignalEffect(() => {
    const currentTime = time.value;
    if (!proxyFile.value || outputting.value) return;
    const timeout = setTimeout(() => {
      settledTime.value = currentTime;
    }, proxySettleTime);
    return () => clearTimeout(timeout);
  });

  if (!file.value) return null;
  if (config.proxySource && !proxyFile.value) return null;

  return (
    <BaseVideo
      file={activeFile as Signal<File>}
      start={startValue}
      time={time}
      videoStart={videoStartValue}
      timeline={config.timeline}
      initialPlaybackRate={initialPlaybackRate}
      loop={loopProp}
      posterImage={posterImageProp.value}
    />
  );
};

export default Video;
