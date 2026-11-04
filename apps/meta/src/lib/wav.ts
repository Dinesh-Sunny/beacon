"use client";

// Records the microphone straight to 16 kHz mono 16-bit WAV, the format Muse Voice Transcribe
// accepts. Uses an AudioWorklet so nothing is sent until the person taps stop.

const TARGET_RATE = 16_000;

const WORKLET = `
class Tap extends AudioWorkletProcessor {
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (ch) this.port.postMessage(ch.slice(0));
    return true;
  }
}
registerProcessor("beacon-tap", Tap);
`;

export interface Recorder {
  stop: () => Promise<Blob>;
  cancel: () => void;
  level: () => number;
}

export async function startRecording(): Promise<Recorder> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
  });
  const ctx = new AudioContext();
  const url = URL.createObjectURL(
    new Blob([WORKLET], { type: "application/javascript" }),
  );
  await ctx.audioWorklet.addModule(url);
  URL.revokeObjectURL(url);
  const src = ctx.createMediaStreamSource(stream);
  const node = new AudioWorkletNode(ctx, "beacon-tap");
  const chunks: Float32Array[] = [];
  let last = 0;
  node.port.onmessage = (e: MessageEvent<Float32Array>) => {
    chunks.push(e.data);
    let peak = 0;
    for (const v of e.data) peak = Math.max(peak, Math.abs(v));
    last = peak;
  };
  src.connect(node);
  const end = () => {
    src.disconnect();
    node.disconnect();
    for (const t of stream.getTracks()) t.stop();
    void ctx.close();
  };
  return {
    level: () => last,
    cancel: end,
    stop: async () => {
      const rate = ctx.sampleRate;
      end();
      return encodeWav(
        downsample(join(chunks), rate, TARGET_RATE),
        TARGET_RATE,
      );
    },
  };
}

function join(chunks: Float32Array[]): Float32Array {
  const out = new Float32Array(chunks.reduce((n, c) => n + c.length, 0));
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out;
}

function downsample(
  input: Float32Array,
  from: number,
  to: number,
): Float32Array {
  if (from === to) return input;
  const ratio = from / to;
  const out = new Float32Array(Math.floor(input.length / ratio));
  for (let i = 0; i < out.length; i++) {
    const start = Math.floor(i * ratio);
    const stop = Math.min(input.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let j = start; j < stop; j++) sum += input[j] ?? 0;
    out[i] = sum / Math.max(1, stop - start);
  }
  return out;
}

export function encodeWav(samples: Float32Array, rate: number): Blob {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buf);
  const str = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i));
  };
  str(0, "RIFF");
  v.setUint32(4, 36 + samples.length * 2, true);
  str(8, "WAVE");
  str(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, "data");
  v.setUint32(40, samples.length * 2, true);
  let o = 44;
  for (const s of samples) {
    const c = Math.max(-1, Math.min(1, s));
    v.setInt16(o, c < 0 ? c * 0x8000 : c * 0x7fff, true);
    o += 2;
  }
  return new Blob([buf], { type: "audio/wav" });
}
