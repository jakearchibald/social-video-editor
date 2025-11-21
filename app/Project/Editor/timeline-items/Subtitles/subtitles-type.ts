export interface SubtitleWord {
  word: string;
  start: number;
  end: number;
}

export interface SubtitlesData {
  task: 'transcribe';
  language: string;
  duration: number;
  text: string;
  usage: {
    type: string;
    seconds: number;
  };
  words: SubtitleWord[];
}
