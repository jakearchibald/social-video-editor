import {
  AudioBufferSource,
  BlobSource,
  EncodedPacketSink,
  EncodedVideoPacketSource,
  Input,
  MP4,
  Mp4OutputFormat,
  Output,
  type AudioEncodingConfig,
  type Target,
  type VideoCodec,
} from 'mediabunny';

export interface VideoChunk {
  /** An MP4 containing the chunk's frames, starting at timestamp zero. */
  file: File;
  /** Time, in seconds, that the chunk's frames start at in the final video. */
  timeOffset: number;
}

interface Options {
  /** Video chunks, in playback order. */
  chunks: VideoChunk[];
  videoCodec: VideoCodec;
  frameRate: number;
  audioBuffer: AudioBuffer;
  audioEncodingConfig: AudioEncodingConfig;
  /** Where the final MP4 is written. */
  target: Target;
}

/**
 * Joins separately encoded video chunks into a single MP4, along with the audio. The video isn't
 * re-encoded; the packets are copied over with their timestamps shifted into place.
 */
export async function muxVideoChunks({
  chunks,
  videoCodec,
  frameRate,
  audioBuffer,
  audioEncodingConfig,
  target,
}: Options) {
  const output = new Output({
    format: new Mp4OutputFormat(),
    target,
  });
  const videoSource = new EncodedVideoPacketSource(videoCodec);
  const audioSource = new AudioBufferSource(audioEncodingConfig);
  output.addVideoTrack(videoSource, { frameRate });
  output.addAudioTrack(audioSource);

  await output.start();

  await audioSource.add(audioBuffer);
  audioSource.close();

  // Only the first packet's metadata is used by the muxer. Every chunk is encoded with the same
  // settings, so the first chunk's decoder config describes the whole track.
  let videoMeta: EncodedVideoChunkMetadata | undefined;

  for (const { file, timeOffset } of chunks) {
    const input = new Input({ formats: [MP4], source: new BlobSource(file) });
    const track = await input.getPrimaryVideoTrack();
    if (!track) throw new Error(`Video chunk ${file.name} has no video track`);

    if (!videoMeta) {
      const decoderConfig = await track.getDecoderConfig();
      if (!decoderConfig) {
        throw new Error(
          `Couldn't read the decoder config of video chunk ${file.name}`,
        );
      }
      videoMeta = { decoderConfig };
    }

    const sink = new EncodedPacketSink(track);

    for await (const packet of sink.packets()) {
      await videoSource.add(
        packet.clone({ timestamp: packet.timestamp + timeOffset }),
        videoMeta,
      );
    }

    input.dispose();
  }

  videoSource.close();
  await output.finalize();
}
