import type { ChildrenTimelineItemBase, TimelineItemBase } from '../schema';

type Slice = {
  startAfter?: string;
  endBefore?: string;
};

export type Code = ChildrenTimelineItemBase & {
  type: 'code';
  source?: string;
  lang?: string;
  slice?: Slice;
  timeline?: CodeTimelineItem[];
};

export type CodeTimelineItem =
  | CodeTimelineItemUpdate
  | CodeTimelineItemHighlight;

export interface CodeTimelineItemUpdate extends TimelineItemBase {
  type: 'update';
  animMode?: 'lines' | 'chars';
  source?: string;
  lang?: string;
  slice?: Slice;
}

export interface CodeTimelineItemHighlight extends TimelineItemBase {
  type: 'highlight';
  text: string;
  index?: number;
  end: string | number;
}
