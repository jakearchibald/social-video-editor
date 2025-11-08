import type {
  ChildrenTimelineItem,
  ChildrenTimelineItemBase,
  TimelineItemBase,
} from '../schema';

type ContainerTimelineItem =
  | ContainerTimelineSetStyles
  | ContainerTimelineAddStyles;

export interface Container extends ChildrenTimelineItemBase {
  type: 'container';
  childrenTimeline?: ChildrenTimelineItem[];
  timeline?: ContainerTimelineItem[];
  styles?: SimpleCSSDeclaration;
  enter?: { type: 'fade'; duration?: number };
  exit?: { type: 'fade'; duration?: number };
}

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
