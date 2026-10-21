const PHRASES = [
  { t0: 0.0, t1: 2.47, speaker: 1, role: "Agent", text: "Please hold. I have the invoice for Greyling." },
  { t0: 3.2, t1: 5.3, speaker: 2, role: "Customer", text: "It still says forty minutes on hold." },
  { t0: 7.0, t1: 10.7, speaker: 3, role: "Supervisor", text: "Log a callback, and spell the name G R E Y L I N G." },
];

const DURATION = 10.7;

const PROMPTS = {
  signal: "> Listening to the local clip.",
  words: "> Transcribe it. Names: Greyling. Terms: invoice, callback.",
  languages: "> This clip is English. A translate prompt would be a second instruction on the same audio.",
  speakers: "> Label the speakers. Up to 8, in 13 languages. This clip uses 3.",
  timing: "> Add phrase timing. These marks are hand-timed for the demo playhead.",
  json: "> Return one JSON object the caller can parse.",
  events: "> List the speaker changes.",
};

const LANGUAGES = [
  ["Arabic", true, true],
  ["Bengali", false, false],
  ["Bulgarian", true, false],
  ["Chinese Mandarin", true, true],
  ["Croatian", true, false],
  ["Czech", true, false],
  ["Danish", true, false],
  ["Dutch", true, false],
  ["English", true, true],
  ["Estonian", true, false],
  ["Finnish", true, false],
  ["French", true, true],
  ["German", true, true],
  ["Greek", true, false],
  ["Hebrew", true, false],
  ["Hindi", true, true],
  ["Hungarian", true, false],
  ["Indonesian", false, false],
  ["Italian", true, true],
  ["Japanese", true, true],
  ["Korean", true, true],
  ["Latvian", true, false],
  ["Lithuanian", true, false],
  ["Maltese", true, false],
  ["Marathi", false, false],
  ["Norwegian", false, false],
  ["Polish", true, false],
  ["Portuguese", true, true],
  ["Romanian", true, false],
  ["Russian", true, true],
  ["Slovak", true, false],
  ["Slovenian", true, false],
  ["Spanish", true, true],
  ["Swedish", true, false],
  ["Tagalog", false, false],
  ["Tamil", false, false],
  ["Thai", true, true],
  ["Turkish", false, false],
  ["Ukrainian", true, false],
  ["Vietnamese", false, false],
];

const player = document.querySelector("#player");
const playBtn = document.querySelector("#play");
const clock = document.querySelector("#clock");
const playhead = document.querySelector("#playhead");
const prompt = document.querySelector("#prompt");
const out = document.querySelector("#out");
const canvas = document.querySelector("#wave");
let tab = "signal";
let peaks = [];

function fmt(t) {
  return t.toFixed(2) + "s";
}

function payload() {
  return {
    model: "nemotron-3.5-transcribe",
    mode: "demo",
    note: "Shape of a result. Not model output.",
    context: ["Greyling", "invoice", "callback"],
    phrases: PHRASES.map((p) => ({
      start: p.t0,
      end: p.t1,
      speaker: p.speaker,
      role: p.role,
      text: p.text,
    })),
    answer: "The customer was on hold for forty minutes.",
  };
}

function render() {
  prompt.textContent = PROMPTS[tab];
  const t = player.currentTime || 0;
  if (tab === "signal") {
    out.innerHTML = `<p class="phrase">The file is ${DURATION.toFixed(2)} seconds, mono, 16 kHz. Three voices, one after another.</p><p class="note">A real request can hold up to 60 minutes.</p>`;
  } else if (tab === "words" || tab === "timing") {
    out.innerHTML = PHRASES.map((p) => {
      const on = t >= p.t0 && t < p.t1 ? " on" : "";
      const when = tab === "timing" ? `[${p.t0.toFixed(2)}–${p.t1.toFixed(2)}] ` : "";
      return `<p class="phrase${on}"><b class="who-${p.speaker}">${when}Speaker ${p.speaker}</b> ${p.text}</p>`;
    }).join("");
  } else if (tab === "languages") {
    out.innerHTML = `<p class="phrase">Detected language on this clip: <b>English</b>.</p><p class="note">All 40 languages transcribe and can switch mid-sentence. 31 of them translate to and from English. Speaker labels are a separate list of 13.</p>`;
  } else if (tab === "speakers") {
    const width = DURATION;
    out.innerHTML = [1, 2, 3].map((n) => {
      const bits = PHRASES.filter((p) => p.speaker === n).map((p) => {
        const left = (p.t0 / width) * 100;
        const w = ((p.t1 - p.t0) / width) * 100;
        return `<i class="seg s${n}" style="left:${left}%;width:${w}%"></i>`;
      }).join("");
      const role = PHRASES.find((p) => p.speaker === n).role;
      return `<div class="lane"><span class="who-${n}">${role}</span><div class="track">${bits}</div></div>`;
    }).join("") + `<p class="note">The briefing allows 8 speakers. This clip has 3.</p>`;
  } else if (tab === "json") {
    out.innerHTML = `<pre>${JSON.stringify(payload(), null, 2)}</pre>`;
  } else {
    out.innerHTML = PHRASES.map((p, i) => {
      const prev = PHRASES[i - 1];
      const label = i === 0 ? "speech starts" : `speaker change ${prev.speaker} → ${p.speaker}`;
      return `<p class="phrase"><b class="who-${p.speaker}">${p.t0.toFixed(2)}s</b> ${label}</p>`;
    }).join("") + `<p class="phrase"><b>10.70s</b> end of file</p>`;
  }
}

function drawWave() {
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#76b900";
  const n = peaks.length || 80;
  const gap = 2;
  const bar = Math.max(2, (w - gap * n) / n);
  for (let i = 0; i < n; i += 1) {
    const amp = peaks.length ? peaks[i] : 0.15 + 0.5 * Math.abs(Math.sin(i * 0.45));
    const bh = Math.max(4, amp * (h - 16));
    ctx.fillRect(i * (bar + gap), (h - bh) / 2, bar, bh);
  }
}

async function loadPeaks() {
  try {
    const res = await fetch("assets/demo.wav");
    const buf = await res.arrayBuffer();
    const audio = await new AudioContext().decodeAudioData(buf.slice(0));
    const data = audio.getChannelData(0);
    const bars = 96;
    const size = Math.floor(data.length / bars);
    peaks = [];
    for (let i = 0; i < bars; i += 1) {
      let sum = 0;
      for (let j = 0; j < size; j += 1) sum += Math.abs(data[i * size + j] || 0);
      peaks.push(sum / size);
    }
    const max = Math.max(...peaks, 0.001);
    peaks = peaks.map((v) => v / max);
    audio.close();
  } catch (err) {
    peaks = [];
  }
  drawWave();
}

document.querySelectorAll(".tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    tab = btn.dataset.tab;
    document.querySelectorAll(".tab").forEach((el) => {
      el.setAttribute("aria-selected", el === btn ? "true" : "false");
    });
    render();
  });
});

playBtn.addEventListener("click", () => {
  if (player.paused) player.play();
  else player.pause();
});

player.addEventListener("play", () => { playBtn.textContent = "Pause"; });
player.addEventListener("pause", () => { playBtn.textContent = "Play clip"; });
player.addEventListener("timeupdate", () => {
  clock.textContent = fmt(player.currentTime);
  playhead.style.left = `${(player.currentTime / DURATION) * 100}%`;
  if (tab === "words" || tab === "timing") render();
});
player.addEventListener("ended", () => {
  playhead.style.left = "100%";
  clock.textContent = fmt(DURATION);
});

const langRoot = document.querySelector("#langs");
LANGUAGES.forEach(([name, translate, speakers]) => {
  const chip = document.createElement("span");
  chip.className = "chip" + (translate ? " tr" : "") + (speakers ? " sp" : "");
  chip.textContent = name;
  langRoot.appendChild(chip);
});

render();
loadPeaks();
