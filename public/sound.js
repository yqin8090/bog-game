// Sound effects and background music, made in the browser with the Web Audio API, so no sound files are needed.
// Browsers only let sound start after a click, so the first click on the page starts the audio.
const Sound = (() => {
  const VOLUME = 0.6;
  let ctx = null;
  let master = null;
  let muted = false;
  try {
    muted = localStorage.getItem("bog-muted") === "1";
  } catch (e) {
    // Private windows can block storage. Sound still works, it just won't remember the mute setting.
  }

  // Creates the audio context on the first call. Call it from a click.
  function context() {
    if (!ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      ctx = new AudioCtx();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : VOLUME;
      master.connect(ctx.destination);
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  // One short note. slideTo bends the pitch toward a new frequency.
  function tone(freq, start, dur, { type = "sine", vol = 0.2, slideTo = null, dest = null } = {}) {
    const c = context();
    if (!c) return;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, start + dur);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(vol, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(gain);
    gain.connect(dest || master);
    osc.start(start);
    osc.stop(start + dur + 0.05);
  }

  // A burst of noise, filtered to a band. Used for hits, swishes and whooshes.
  function noise(start, dur, vol, freq) {
    const c = context();
    if (!c) return;
    const len = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource();
    src.buffer = buf;
    const filter = c.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = freq;
    const gain = c.createGain();
    gain.gain.value = vol;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(start);
  }

  const SOUNDS = {
    click: (t) => tone(880, t, 0.04, { type: "square", vol: 0.04 }),
    hit: (t) => {
      noise(t, 0.18, 0.5, 900);
      tone(160, t, 0.2, { vol: 0.4, slideTo: 60 });
    },
    heal: (t) => [523, 659, 784].forEach((f, i) => tone(f, t + i * 0.08, 0.2, { type: "triangle", vol: 0.18 })),
    shield: (t) => tone(440, t, 0.25, { type: "triangle", vol: 0.2, slideTo: 880 }),
    dodge: (t) => noise(t, 0.2, 0.25, 2500),
    slash: (t) => noise(t, 0.25, 0.35, 1800),
    mark: (t) => tone(1200, t, 0.12, { type: "square", vol: 0.08 }),
    transform: (t) => [392, 523, 659, 784, 1046].forEach((f, i) => tone(f, t + i * 0.07, 0.25, { type: "sawtooth", vol: 0.07 })),
    link: (t) => [330, 247].forEach((f, i) => tone(f, t + i * 0.15, 0.3, { type: "sawtooth", vol: 0.12 })),
    turn: (t) => {
      tone(660, t, 0.12, { type: "triangle", vol: 0.2 });
      tone(990, t + 0.1, 0.18, { type: "triangle", vol: 0.2 });
    },
    win: (t) => [523, 659, 784, 1046].forEach((f, i) => tone(f, t + i * 0.14, 0.35, { type: "triangle", vol: 0.25 })),
    lose: (t) => [392, 330, 262, 196].forEach((f, i) => tone(f, t + i * 0.25, 0.4, { type: "sawtooth", vol: 0.12 })),
  };

  function play(name) {
    const c = context();
    if (!c || !SOUNDS[name]) return;
    SOUNDS[name](c.currentTime + 0.01);
  }

  // Background music: four chords (Am, F, C, G) with a bass note and a bouncing arpeggio, scheduled a little ahead.
  const CHORDS = [
    [220, 261.6, 329.6],
    [174.6, 220, 261.6],
    [261.6, 329.6, 392],
    [196, 246.9, 293.7],
  ];
  const BEAT = 60 / 100; // 100 beats a minute
  let musicGain = null;
  let musicTimer = null;
  let nextTime = 0;
  let step = 0;

  function scheduleMusic() {
    const c = ctx;
    while (nextTime < c.currentTime + 0.3) {
      const chord = CHORDS[Math.floor(step / 8) % CHORDS.length];
      const pos = step % 8;
      if (pos === 0) tone(chord[0] / 2, nextTime, BEAT * 2, { type: "triangle", vol: 0.18, dest: musicGain });
      tone(chord[pos % 3] * 2, nextTime, BEAT * 0.45, { type: "sine", vol: 0.07, dest: musicGain });
      nextTime += BEAT / 2;
      step++;
    }
  }

  function startMusic() {
    const c = context();
    if (!c || musicTimer) return;
    musicGain = c.createGain();
    musicGain.gain.setValueAtTime(0, c.currentTime);
    musicGain.gain.linearRampToValueAtTime(0.5, c.currentTime + 1);
    musicGain.connect(master);
    nextTime = c.currentTime + 0.1;
    step = 0;
    scheduleMusic();
    musicTimer = setInterval(scheduleMusic, 100);
  }

  function stopMusic() {
    if (!musicTimer) return;
    clearInterval(musicTimer);
    musicTimer = null;
    const gain = musicGain;
    const c = ctx;
    gain.gain.setTargetAtTime(0, c.currentTime, 0.4);
    setTimeout(() => gain.disconnect(), 2000);
  }

  function setMuted(value) {
    muted = value;
    try {
      localStorage.setItem("bog-muted", value ? "1" : "0");
    } catch (e) {
      // Storage is blocked. The mute still works until the page is closed.
    }
    if (master) master.gain.setTargetAtTime(value ? 0 : VOLUME, ctx.currentTime, 0.05);
  }

  // Every button press gets a small click, and the first press starts the audio.
  document.addEventListener("click", (e) => {
    if (e.target.closest && e.target.closest("button")) play("click");
  });

  return {
    play,
    startMusic,
    stopMusic,
    isMuted: () => muted,
    setMuted,
  };
})();
