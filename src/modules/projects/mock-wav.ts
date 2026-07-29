const SAMPLE_RATE = 8_000;
const DURATION_SECONDS = 12;

export function createMockDemoWav() {
  const samples = SAMPLE_RATE * DURATION_SECONDS; const dataSize = samples * 2; const buffer = Buffer.alloc(44 + dataSize);
  buffer.write("RIFF", 0); buffer.writeUInt32LE(36 + dataSize, 4); buffer.write("WAVE", 8); buffer.write("fmt ", 12); buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(1, 22); buffer.writeUInt32LE(SAMPLE_RATE, 24); buffer.writeUInt32LE(SAMPLE_RATE * 2, 28); buffer.writeUInt16LE(2, 32); buffer.writeUInt16LE(16, 34); buffer.write("data", 36); buffer.writeUInt32LE(dataSize, 40);
  const notes = [261.63, 329.63, 392, 523.25, 440, 392, 329.63, 293.66];
  for (let index = 0; index < samples; index += 1) { const time = index / SAMPLE_RATE; const frequency = notes[Math.floor(time / 0.5) % notes.length]!; const envelope = Math.min(1, (time % 0.5) * 12) * Math.max(0, 1 - (time % 0.5) * 1.8); const sample = Math.sin(2 * Math.PI * frequency * time) * envelope * 0.16; buffer.writeInt16LE(Math.round(sample * 32767), 44 + index * 2); }
  return buffer;
}
