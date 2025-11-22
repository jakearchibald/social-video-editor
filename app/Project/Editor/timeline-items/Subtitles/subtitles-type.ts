export interface SubtitleWord {
  word: string;
  start: number;
  end: number;
}

export interface SubtitlesData {
  word_segments: SubtitleWord[];
}
