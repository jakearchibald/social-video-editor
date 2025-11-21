export interface SubtitleSegment {
  id: number;
  seek: number;
  start: number;
  end: number;
  text: string;
  tokens: number[];
  temperature: number;
  avg_logprob: number;
  compression_ratio: number;
  no_speech_prob: number;
}

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
  segments: SubtitleSegment[];
  words: SubtitleWord[];
}
