export type SpeechActivityOptions = {
  speakingHoldMs?: number;
  onChange?: (hasSpeech: boolean) => void;
};

export async function createSpeechActivityDetector(
  stream: MediaStream,
  options: SpeechActivityOptions = {}
) {
  const audioContext = new AudioContext();
  const source = audioContext.createMediaStreamSource(stream);
  const analyser = audioContext.createAnalyser();
  const data = new Float32Array(analyser.fftSize);
  const speakingHoldMs = options.speakingHoldMs ?? 700;

  analyser.fftSize = 1024;
  source.connect(analyser);

  let rafId = 0;
  let lastVoiceAt = 0;
  let current = false;

  function getRms() {
    analyser.getFloatTimeDomainData(data);
    let sum = 0;
    for (const sample of data) {
      sum += sample * sample;
    }
    return Math.sqrt(sum / data.length);
  }

  function tick(now: number) {
    const rms = getRms();
    const hasVoice = rms > 0.025;

    if (hasVoice) {
      lastVoiceAt = now;
    }

    const next = now - lastVoiceAt < speakingHoldMs;
    if (next !== current) {
      current = next;
      options.onChange?.(current);
    }

    rafId = requestAnimationFrame(tick);
  }

  rafId = requestAnimationFrame(tick);

  return {
    get hasSpeech() {
      return current;
    },
    async stop() {
      cancelAnimationFrame(rafId);
      source.disconnect();
      await audioContext.close();
    }
  };
}
