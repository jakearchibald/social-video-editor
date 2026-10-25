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
import type { AudioTimelineItem } from '../../../../utils/AudioTimeline';
import type { VideoClip } from '../../../../../project-schema/timeline-items/video';
import type { DeepSignal } from 'deepsignal';
import BaseVideo from '../../BaseVideo';
import { getDuration, getStartTime } from '../../../../utils/timeline-item';
import { OutputtingContext } from '../../../../utils/outputting-context';

export function getAudioTimelineItems(
  item: VideoClip,
  parentStart: number,
  parentEnd: number,
): AudioTimelineItem[] {
  if (item.disabled) return [];

  const source =
    item.audioSource === null ? null : item.audioSource || item.source;

  if (!source) return [];

  const audioDelay = parseTime(item.audioDelay || 0);

  return [
    {
      start: getStartTime(item, parentStart),
      audioStart:
        ('audioStart' in item
          ? parseTime(item.audioStart || 0)
          : parseTime(item.videoStart || 0)) + audioDelay,
      duration: getDuration(item, parentStart, parentEnd),
      source,
    },
  ];
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
      posterImage={posterImageProp.value}
    />
  );
};

export default Video;
