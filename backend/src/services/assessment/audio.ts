export const decodeBase64Audio = (audioData: string) => Buffer.from(audioData, 'base64');

export const getWavSampleRate = (buffer: Buffer) => {
  if (buffer.length < 28) return null;
  if (buffer.toString('ascii', 0, 4) !== 'RIFF') return null;
  if (buffer.toString('ascii', 8, 12) !== 'WAVE') return null;
  return buffer.readUInt32LE(24);
};

export const getWavDurationSeconds = (buffer: Buffer) => {
  if (buffer.length < 44) return null;
  const sampleRate = getWavSampleRate(buffer);
  if (!sampleRate) return null;
  const channels = buffer.readUInt16LE(22);
  const bitsPerSample = buffer.readUInt16LE(34);
  const bytesPerSample = bitsPerSample / 8;
  const dataOffset = findWavDataOffset(buffer);
  if (dataOffset === null) return null;
  const dataSize = buffer.readUInt32LE(dataOffset + 4);
  if (!dataSize || !channels || !bytesPerSample) return null;
  return dataSize / (sampleRate * channels * bytesPerSample);
};

export const findWavDataOffset = (buffer: Buffer) => {
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString('ascii', offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    if (chunkId === 'data') return offset;
    offset += 8 + chunkSize;
  }
  return null;
};

export const extractWavPcmData = (buffer: Buffer) => {
  const dataOffset = findWavDataOffset(buffer);
  if (dataOffset === null) return buffer;
  const dataSize = buffer.readUInt32LE(dataOffset + 4);
  const start = dataOffset + 8;
  const end = Math.min(buffer.length, start + dataSize);
  return buffer.subarray(start, end);
};
