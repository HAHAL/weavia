// Joins shot clips into one vertical video on this device: each clip is drawn
// onto a canvas with its caption burned in, optional background music is mixed
// in, and the canvas stream is recorded. No server time and no extra install.

export type ComposeClip = { url: string; caption?: string; seconds?: number };
export type ComposeOptions = { width?: number; height?: number; music?: File; onProgress?: (done: number, total: number) => void };

function pickMime(): string {
  const candidates = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'];
  return candidates.find(type => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) || 'video/webm';
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const char of text) {
    if (ctx.measureText(line + char).width > maxWidth && line) { lines.push(line); line = char; } else line += char;
  }
  if (line) lines.push(line);
  return lines.slice(0, 3);
}

function drawCaption(ctx: CanvasRenderingContext2D, caption: string, width: number, height: number) {
  if (!caption) return;
  const size = Math.round(width * 0.052);
  ctx.font = `700 ${size}px "PingFang SC","Microsoft YaHei",sans-serif`;
  ctx.textAlign = 'center';
  const lines = wrap(ctx, caption, width * 0.84);
  const lineHeight = size * 1.35;
  const top = height * 0.8 - (lines.length - 1) * lineHeight;
  lines.forEach((line, i) => {
    const y = top + i * lineHeight;
    ctx.lineWidth = size * 0.18;
    ctx.strokeStyle = 'rgba(0,0,0,0.75)';
    ctx.strokeText(line, width / 2, y);
    ctx.fillStyle = '#fff';
    ctx.fillText(line, width / 2, y);
  });
}

function drawCover(ctx: CanvasRenderingContext2D, video: HTMLVideoElement, width: number, height: number) {
  const scale = Math.max(width / video.videoWidth, height / video.videoHeight);
  const w = video.videoWidth * scale;
  const h = video.videoHeight * scale;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(video, (width - w) / 2, (height - h) / 2, w, h);
}

function loadVideo(url: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.src = url;
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.onloadeddata = () => resolve(video);
    video.onerror = () => reject(new Error('镜头视频无法读取'));
  });
}

export async function composeClips(clips: ComposeClip[], options: ComposeOptions = {}): Promise<Blob> {
  if (!clips.length) throw new Error('没有可合成的镜头');
  if (typeof MediaRecorder === 'undefined') throw new Error('当前系统不支持本机合成，请升级系统后重试');
  const width = options.width ?? 720;
  const height = options.height ?? 1280;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法创建画布');
  const stream = canvas.captureStream(30);
  let audio: AudioContext | undefined;
  let music: HTMLAudioElement | undefined;
  if (options.music) {
    audio = new AudioContext();
    music = new Audio(URL.createObjectURL(options.music));
    music.loop = true;
    const destination = audio.createMediaStreamDestination();
    const gain = audio.createGain();
    gain.gain.value = 0.6;
    audio.createMediaElementSource(music).connect(gain).connect(destination);
    destination.stream.getAudioTracks().forEach(track => stream.addTrack(track));
  }
  const mime = pickMime();
  const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 5_000_000 });
  const chunks: Blob[] = [];
  recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
  const finished = new Promise<Blob>(resolve => { recorder.onstop = () => resolve(new Blob(chunks, { type: mime.split(';')[0] })); });
  recorder.start(250);
  if (music) await music.play().catch(() => undefined);
  try {
    for (const [index, clip] of clips.entries()) {
      const video = await loadVideo(clip.url);
      const limit = clip.seconds && clip.seconds > 0 ? Math.min(clip.seconds, video.duration || clip.seconds) : video.duration;
      await video.play();
      await new Promise<void>(resolve => {
        const draw = () => {
          drawCover(ctx, video, width, height);
          drawCaption(ctx, clip.caption || '', width, height);
          if (video.ended || video.currentTime >= limit) { video.pause(); resolve(); return; }
          requestAnimationFrame(draw);
        };
        draw();
      });
      options.onProgress?.(index + 1, clips.length);
    }
  } finally {
    recorder.stop();
    music?.pause();
    void audio?.close();
  }
  return finished;
}
