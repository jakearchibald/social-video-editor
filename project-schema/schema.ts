type integer = number;

export interface Project {
  appCommit?: string;
  width: integer;
  height: integer;
  audioSampleRate: integer;
  fps: number;
  childrenTimeline: ChildrenTimelineItem[];
}

export type ChildrenTimelineItem = VideoClip | Container;

interface ChildrenTimelineItemBase extends TimelineItemBase {
  /** Duration. 00:00:00.000 or ms */
  duration: string | number;
}

interface TimelineItemBase {
  /** Start time. 00:00:00.000 or ms */
  start: string | number;
}

export interface VideoClip extends ChildrenTimelineItemBase {
  type: 'video';
  /** Relative path to video file */
  source: string;
  /** Relative path to audio file, used instead of video audio */
  audioSource?: string;
  /** Start time within the video file. 00:00:00.000 or ms */
  videoStart?: string | number;
}

export type ContainerTimelineItem =
  | ContainerTimelineSetStyles
  | ContainerTimelineAddStyles;

type SimpleCSSDeclaration = {
  [K in keyof CSSStyleDeclaration as CSSStyleDeclaration[K] extends string
    ? K extends string
      ? K
      : never
    : never]?: string;
};

interface ContainerTimelineSetStyles extends TimelineItemBase {
  type: 'set-styles';
  styles: SimpleCSSDeclaration;
}

interface ContainerTimelineAddStyles extends TimelineItemBase {
  type: 'add-styles';
  styles: SimpleCSSDeclaration;
  transition?: {
    duration: number;
    easing: string;
  };
}

export interface Container extends ChildrenTimelineItemBase {
  type: 'container';
  childrenTimeline?: ChildrenTimelineItem[];
  timeline?: ContainerTimelineItem[];
  styles?: SimpleCSSDeclaration;
}
