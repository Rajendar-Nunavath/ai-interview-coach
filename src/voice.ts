const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001'

// Keeps ONE microphone stream open for the whole interview (no re-opening per question),
// and records each answer from it. The browser's live captions run alongside; after each
// answer the recording is transcribed server-side, which is far more accurate.
export class AnswerRecorder {
  stream: MediaStream | null = null
  private rec?: MediaRecorder
  private chunks: Blob[] = []
  private deviceId?: string

  static mime() {
    return ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']
      .find(m => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m))
  }

  private live() {
    return !!this.stream && this.stream.getAudioTracks().some(t => t.readyState === 'live')
  }

  async prepare(deviceId?: string): Promise<MediaStream> {
    if (this.live() && deviceId === this.deviceId) return this.stream!
    this.release()
    this.deviceId = deviceId
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
        echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1
      }
    })
    return this.stream
  }

  async start() {
    if (this.rec && this.rec.state !== 'inactive') this.rec.stop()
    await this.prepare(this.deviceId)
    this.chunks = []
    this.rec = new MediaRecorder(this.stream!, { mimeType: AnswerRecorder.mime(), audioBitsPerSecond: 32000 })
    this.rec.ondataavailable = e => { if (e.data.size) this.chunks.push(e.data) }
    this.rec.start(1000)
  }

  // Stops the current recording only; the microphone stays open for the next answer.
  stop(): Promise<Blob | null> {
    return new Promise(resolve => {
      const r = this.rec
      if (!r || r.state === 'inactive') return resolve(null)
      r.onstop = () => resolve(new Blob(this.chunks, { type: r.mimeType }))
      r.stop()
    })
  }

  // Releases the microphone (end of interview / unmount).
  release() {
    if (this.rec && this.rec.state !== 'inactive') { try { this.rec.stop() } catch {} }
    this.stream?.getTracks().forEach(t => t.stop())
    this.stream = null
  }
}

// Returns the accurate transcript, or null so the caller can fall back to live captions.
export async function transcribe(blob: Blob | null, technologies: string, token: string): Promise<string | null> {
  if (!blob || blob.size < 2000 || blob.size > 2_000_000) return null
  const audio = await new Promise<string>((ok, no) => {
    const fr = new FileReader()
    fr.onload = () => ok(String(fr.result).split(',')[1])
    fr.onerror = no
    fr.readAsDataURL(blob)
  })
  try {
    const r = await fetch(`${API_URL}/api/transcribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ audio, mimeType: blob.type, technologies }),
      signal: AbortSignal.timeout(20000)
    })
    return r.ok ? ((await r.json()).text || null) : null
  } catch { return null }
}
