import type { ChildrenTimelineItemBase, TimelineItemBase } from '../schema';

export interface Code extends ChildrenTimelineItemBase {
  type: 'code';
  source?: string;
  lang?: string;
  slice?: {
    startAfter: string;
    endBefore: string;
  };
  timeline?: CodeTimelineItem[];
}

export type CodeTimelineItem =
  | CodeTimelineItemUpdate
  | CodeTimelineItemHighlight;

export interface CodeTimelineItemUpdate extends TimelineItemBase {
  type: 'update';
  animMode: 'lines' | 'chars';
  source?: string;
  lang?: string;
  slice?: {
    startAfter: string;
    endBefore: string;
  };
}

interface CodeTimelineItemHighlight extends TimelineItemBase {
  type: 'highlight';
  text: string;
  end: string | number;
}
