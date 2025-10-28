import { createFile } from 'mp4box';

export class Video {
  #file: File;

  constructor(file: File) {
    this.#file = file;
  }

  getFrameAt(time: number): Promise<ImageBitmap> {}
}
