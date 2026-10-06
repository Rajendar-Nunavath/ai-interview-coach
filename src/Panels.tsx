import { memo, useEffect, useMemo, useState } from 'react'
import Webcam from 'react-webcam'

type Headers = () => Record<string, string>
type Rubric = { correctness: number; depth: number; communication: number }

const RUBRIC_LABELS: [keyof Rubric, string][] = [['correctness', 'Correctness'], ['depth', 'Depth'], ['communication', 'Communication']]

export function RubricBars({ rubric }: { rubric: Rubric }) {
  return (
    <div className="space-y-2">
      {RUBRIC_LABELS.map(([k, label]) => (
        <div key={k}>
          <div className="flex justify-between text-sm"><span>{label}</span><span className="font-medium">{rubric[k]}/100</span></div>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div className={`h-2.5 rounded-full ${rubric[k] > 70 ? 'bg-green-500' : rubric[k] > 50 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${rubric[k]}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function Trend({ scores }: { scores: number[] }) {
  if (scores.length < 2) return <p className="text-sm text-gray-500">Complete 2+ interviews to see your trend.</p>
  const w = 400, h = 90, step = w / (scores.length - 1)
  const pts = scores.map((s, i) => `${(i * step).toFixed(1)},${(h - (s / 100) * h).toFixed(1)}`).join(' ')
  return (
    <svg viewBox={`-6 -6 ${w + 12} ${h + 12}`} className="w-full h-24" role="img" aria-label="Score trend">
      <polyline points={pts} fill="none" stroke="#2563eb" strokeWidth="3" strokeLinejoin="round" />
      {scores.map((s, i) => <circle key={i} cx={i * step} cy={h - (s / 100) * h} r="4" fill="#2563eb" />)}
    </svg>
  )
}

export function Dashboard({ apiUrl, headers, onClose, onAccountDeleted }: {
  apiUrl: string; headers: Headers; onClose: () => void; onAccountDeleted: () => void
}) {
  const [items, setItems] = useState<any[] | null>(null)
  const [detail, setDetail] = useState<any | null>(null)
  const [msg, setMsg] = useState('')

  const api = (path: string, init: RequestInit = {}) =>
    fetch(`${apiUrl}/api${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...headers(), ...(init.headers || {}) } })

  const load = async () => {
    try {
      const r = await api('/interview-results')
      setItems(r.ok ? await r.json() : [])
    } catch { setItems([]); setMsg('Could not load history.') }
  }
  useEffect(() => { load() }, [])

  const open = async (id: number) => {
    const r = await api(`/interview-results/${id}`)
    if (r.ok) setDetail(await r.json())
  }
  const remove = async (id: number) => {
    if (!confirm('Delete this interview and its transcript?')) return
    await api(`/interview-results/${id}`, { method: 'DELETE' })
    setDetail(null); load()
  }
  const exportData = async () => {
    const r = await api('/me/export')
    if (!r.ok) return setMsg('Export failed.')
    const url = URL.createObjectURL(await r.blob())
    const a = document.createElement('a'); a.href = url; a.download = 'my-interview-data.json'; a.click()
    URL.revokeObjectURL(url)
  }
  const deleteAll = async () => {
    if (!confirm('Delete ALL your interviews and transcripts? This cannot be undone.')) return
    const r = await api('/me/data', { method: 'DELETE' })
    setMsg(r.ok ? 'All interview data deleted.' : 'Delete failed.'); load()
  }
  const deleteAccount = async () => {
    const password = prompt('Enter your password to permanently delete your account and all data:')
    if (!password) return
    const r = await api('/me', { method: 'DELETE', body: JSON.stringify({ password }) })
    if (r.ok) onAccountDeleted(); else setMsg((await r.json()).error || 'Delete failed.')
  }

  const list = items || []
  const chrono = [...list].reverse()
  const avg = (f: (x: any) => number) => (list.length ? Math.round(list.reduce((s, x) => s + f(x), 0) / list.length) : 0)
  const rubrics = list.filter(x => x.rubric)
  const avgRubric: Rubric | null = rubrics.length ? {
    correctness: Math.round(rubrics.reduce((s, x) => s + x.rubric.correctness, 0) / rubrics.length),
    depth: Math.round(rubrics.reduce((s, x) => s + x.rubric.depth, 0) / rubrics.length),
    communication: Math.round(rubrics.reduce((s, x) => s + x.rubric.communication, 0) / rubrics.length)
  } : null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-3xl max-h-[85vh] overflow-y-auto bg-white rounded-2xl shadow-2xl p-6 relative text-left">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-gray-800 text-xl" aria-label="Close">×</button>

        {detail ? (
          <div>
            <button onClick={() => setDetail(null)} className="text-sm text-blue-600 mb-3">← Back to progress</button>
            <h2 className="text-xl font-bold">{detail.role} · {detail.difficulty} · {detail.score}/100</h2>
            <p className="text-sm text-gray-500 mb-3">{detail.technologies} — {detail.created_at}</p>
            {detail.rubric && <div className="mb-4"><RubricBars rubric={detail.rubric} /></div>}
            {detail.feedback?.analysis && <p className="text-gray-700 mb-3">{detail.feedback.analysis}</p>}
            <h3 className="font-semibold mb-2">Transcript</h3>
            <div className="space-y-3">
              {detail.answers.map((a: any, i: number) => (
                <div key={i} className="border rounded-lg p-3 bg-gray-50">
                  <p className="font-medium text-sm">Q{i + 1}. {a.question || `Question ${a.questionId}`}</p>
                  <p className="text-gray-700 text-sm mt-1">{a.answer || <em>No answer recorded</em>}</p>
                  <p className="text-xs text-gray-400 mt-1">{a.wpm} wpm · {a.fillerCount} fillers</p>
                </div>
              ))}
            </div>
            <button onClick={() => remove(detail.id)} className="mt-4 text-sm text-red-600 hover:underline">Delete this interview</button>
          </div>
        ) : (
          <div>
            <h2 className="text-2xl font-bold mb-4">My Progress</h2>
            {items === null ? <p>Loading…</p> : list.length === 0 ? (
              <p className="text-gray-600">No interviews yet. Complete one to see your progress here.</p>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-3 mb-4 text-center">
                  <div className="bg-blue-50 rounded-lg p-3"><div className="text-2xl font-bold">{list.length}</div><div className="text-xs text-gray-600">Interviews</div></div>
                  <div className="bg-green-50 rounded-lg p-3"><div className="text-2xl font-bold">{Math.max(...list.map(x => x.score))}</div><div className="text-xs text-gray-600">Best score</div></div>
                  <div className="bg-purple-50 rounded-lg p-3"><div className="text-2xl font-bold">{avg(x => x.score)}</div><div className="text-xs text-gray-600">Average</div></div>
                </div>
                <h3 className="font-semibold mb-1">Score trend</h3>
                <Trend scores={chrono.map(x => x.score)} />
                {avgRubric && <><h3 className="font-semibold mt-4 mb-2">Average rubric</h3><RubricBars rubric={avgRubric} /></>}
                <h3 className="font-semibold mt-4 mb-2">Sessions</h3>
                <div className="space-y-2">
                  {list.map(x => (
                    <div key={x.id} className="border rounded-lg p-3 bg-gray-50 flex items-center justify-between gap-3">
                      <div>
                        <div className="font-medium">{x.score}/100 <span className="text-sm text-gray-500">· {x.role || 'Interview'} · {x.difficulty || ''}</span></div>
                        <div className="text-xs text-gray-500">{x.technologies} — {x.created_at}</div>
                      </div>
                      <div className="flex gap-3 text-sm shrink-0">
                        <button onClick={() => open(x.id)} className="text-blue-600 hover:underline">Transcript</button>
                        <button onClick={() => remove(x.id)} className="text-red-600 hover:underline">Delete</button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            <div className="mt-6 pt-4 border-t">
              <h3 className="font-semibold mb-1">Privacy &amp; data</h3>
              <p className="text-xs text-gray-500 mb-2">Transcripts are stored only so you can review them. Video is never recorded or stored.</p>
              <div className="flex flex-wrap gap-2 text-sm">
                <button onClick={exportData} className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300">Download my data</button>
                <button onClick={deleteAll} className="px-3 py-1 rounded bg-orange-100 text-orange-800 hover:bg-orange-200">Delete all interviews</button>
                <button onClick={deleteAccount} className="px-3 py-1 rounded bg-red-100 text-red-700 hover:bg-red-200">Delete my account</button>
              </div>
              {msg && <p className="text-sm text-gray-700 mt-2">{msg}</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export function ConsentModal({ onAccept, onDecline }: { onAccept: () => void; onDecline: () => void }) {
  const [agreed, setAgreed] = useState(false)
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl p-6 text-left">
        <h2 className="text-2xl font-bold mb-2">Before you start</h2>
        <p className="text-sm text-gray-600 mb-3">Please review how this practice tool uses your data:</p>
        <ul className="list-disc pl-5 text-sm text-gray-700 space-y-1.5 mb-4">
          <li><b>Microphone:</b> your answers are recorded and sent to an AI service (Google Gemini) to produce an accurate transcript and feedback.</li>
          <li><b>Camera (optional):</b> only used for a local check of whether your face is centered. Video and images are never uploaded or stored.</li>
          <li><b>Stored data:</b> your transcripts, scores and feedback are saved to your account so you can track progress.</li>
          <li><b>Your control:</b> you can download or permanently delete your interviews or your whole account at any time from “My Progress”.</li>
          <li>This is a practice tool. Scores are AI estimates and should not be used for hiring decisions.</li>
        </ul>
        <label className="flex items-start gap-2 text-sm mb-4">
          <input type="checkbox" className="mt-1" checked={agreed} onChange={e => setAgreed(e.target.checked)} />
          <span>I understand and agree to the above.</span>
        </label>
        <div className="flex gap-3">
          <button onClick={onDecline} className="flex-1 bg-gray-200 hover:bg-gray-300 rounded-lg py-2 font-medium">Decline &amp; log out</button>
          <button onClick={onAccept} disabled={!agreed} className={`flex-1 rounded-lg py-2 font-bold text-white ${agreed ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-400 cursor-not-allowed'}`}>Agree &amp; continue</button>
        </div>
      </div>
    </div>
  )
}

// Memoized so speech/caption updates in <App> never re-render (or re-init) the camera.
export const CameraView = memo(function CameraView({ camRef, deviceId, onError, onReady }: {
  camRef: any; deviceId: string; onError: (e: any) => void; onReady: () => void
}) {
  const constraints = useMemo(() => ({
    width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 24, max: 30 },
    ...(deviceId ? { deviceId: { exact: deviceId } } : { facingMode: 'user' })
  }), [deviceId])
  return (
    <Webcam audio={false} ref={camRef} mirrored screenshotFormat="image/jpeg" screenshotQuality={0.6}
      videoConstraints={constraints} onUserMedia={onReady} onUserMediaError={onError} className="w-full h-auto" />
  )
})

// Live microphone level, with its own state so it never re-renders <App>.
export function MicMeter({ stream }: { stream: MediaStream | null }) {
  const [level, setLevel] = useState(0)
  useEffect(() => {
    if (!stream) { setLevel(0); return }
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const src = ctx.createMediaStreamSource(stream)
    const an = ctx.createAnalyser()
    an.fftSize = 512
    src.connect(an)
    const buf = new Uint8Array(an.fftSize)
    let raf = 0, last = 0
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick)
      if (now - last < 100) return
      last = now
      an.getByteTimeDomainData(buf)
      let peak = 0
      for (let i = 0; i < buf.length; i++) peak = Math.max(peak, Math.abs(buf[i] - 128))
      const n = Math.min(100, Math.round((peak / 128) * 160))
      setLevel(prev => (Math.abs(n - prev) > 4 ? n : prev))
    }
    raf = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(raf); try { src.disconnect() } catch {} ctx.close().catch(() => {}) }
  }, [stream])
  return (
    <div className="mt-3">
      <div className="flex justify-between text-xs text-gray-500 mb-1"><span>Microphone level</span><span>{stream ? (level < 5 ? 'speak to test' : 'hearing you') : 'not connected'}</span></div>
      <div className="w-full bg-gray-200 rounded-full h-2"><div className="h-2 rounded-full bg-green-500 transition-[width] duration-100" style={{ width: `${level}%` }} /></div>
    </div>
  )
}

// Lets the user pick the exact camera / microphone (fixes virtual or wrong default devices).
export function DevicePicker({ camId, micId, onCam, onMic, reloadKey }: {
  camId: string; micId: string; onCam: (id: string) => void; onMic: (id: string) => void; reloadKey: unknown
}) {
  const [cams, setCams] = useState<MediaDeviceInfo[]>([])
  const [mics, setMics] = useState<MediaDeviceInfo[]>([])
  useEffect(() => {
    const md = navigator.mediaDevices
    if (!md?.enumerateDevices) return
    const load = async () => {
      try {
        const d = await md.enumerateDevices()
        setCams(d.filter(x => x.kind === 'videoinput'))
        setMics(d.filter(x => x.kind === 'audioinput' && x.deviceId !== 'communications'))
      } catch {}
    }
    load()
    md.addEventListener?.('devicechange', load)
    return () => md.removeEventListener?.('devicechange', load)
  }, [reloadKey])
  const sel = 'w-full border rounded px-2 py-1 text-xs bg-white'
  return (
    <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-gray-600">
      <label>Camera
        <select className={sel} value={camId} onChange={e => onCam(e.target.value)}>
          <option value="">Default camera</option>
          {cams.map((c, i) => <option key={c.deviceId || i} value={c.deviceId}>{c.label || `Camera ${i + 1}`}</option>)}
        </select>
      </label>
      <label>Recording microphone
        <select className={sel} value={micId} onChange={e => onMic(e.target.value)}>
          <option value="">Default microphone</option>
          {mics.map((m, i) => <option key={m.deviceId || i} value={m.deviceId}>{m.label || `Microphone ${i + 1}`}</option>)}
        </select>
      </label>
      <p className="text-[11px] text-gray-400">Live captions always use your system default microphone (a browser limitation). Set it in Windows Sound settings if captions seem off.</p>
    </div>
  )
}
