import type { FunctionComponent } from 'preact';
import { useSignal, type Signal } from '@preact/signals';
import { useLayoutEffect } from 'preact/hooks';
import { parseTime } from '../../../../utils/time';
import useOptimComputed from '../../../../utils/useOptimComputed';
import { waitUntil } from '../../../../utils/waitUntil';
import { getFile } from '../../../../utils/file';
import type { AudioTimelineItem } from '../../../../utils/AudioTimeline';
import type { VideoClip } from '../../../../../project-schema/timeline-items/video';
import type { DeepSignal } from 'deepsignal';
import BaseVideo from '../../BaseVideo';

export function getAudioTimelineItems(item: VideoClip): AudioTimelineItem[] {
  const source = item.audioSource || item.source;

  if (!source) return [];

  return [
    {
      start: parseTime(item.start),
      audioStart: parseTime(item.videoStart || 0),
      duration: parseTime(item.duration),
      source,
    },
  ];
}

interface Props {
  projectDir: FileSystemDirectoryHandle;
  time: Signal<number>;
  config: DeepSignal<VideoClip>;
}

const Video: FunctionComponent<Props> = ({ projectDir, time, config }) => {
  const file = useSignal<File | null>(null);
  const startValue = useOptimComputed(() => parseTime(config.start));
  const videoStartValue = useOptimComputed(() =>
    parseTime(config.videoStart || 0)
  );

  useLayoutEffect(() => {
    const p = (async () => {
      file.value = await getFile(projectDir, config.source);
    })();
    waitUntil(p);
  }, []);

  if (!file.value) return null;

  return (
    <BaseVideo
      file={file.value}
      start={startValue}
      time={time}
      videoStart={videoStartValue}
    />
  );
};

export default Video;
