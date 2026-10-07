import { useState, useRef, useEffect, useCallback } from 'react'
import { FaMicrophone, FaStop, FaPlay, FaRedo, FaCheckCircle, FaCircle, FaEye, FaEyeSlash, FaSignOutAlt, FaBrain, FaRobot, FaLightbulb, FaCode, FaCoffee, FaDatabase, FaLaptopCode } from 'react-icons/fa'
import Webcam from 'react-webcam'
import { AnswerRecorder, transcribe } from './voice'
import { Dashboard, ConsentModal, RubricBars, CameraView, MicMeter, DevicePicker } from './Panels'


// API configuration
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'
console.log("API_URL =", API_URL)
const SPEECH_LANG = import.meta.env.VITE_SPEECH_LANG || 'en-US'

const getAuthHeaders = (): Record<string, string> => {
  const token = sessionStorage.getItem('authToken')

  return token
    ? { Authorization: `Bearer ${token}` }
    : {}
}

type Question = {
  id: number
  text: string
  category: string
}

type Technology = 'java' | 'python' | 'dbms' | 'full-stack'

type Feedback = {
  score: number
  rubric?: { correctness: number; depth: number; communication: number }
  strengths?: string[]
  analysis: string
  suggestions: string[]
}


const TECHNOLOGY_OPTIONS: { id: Technology; label: string; description: string; icon: JSX.Element }[] = [
  { id: 'java', label: 'Java', description: 'Java development and OOP concepts', icon: <FaCoffee /> },
  { id: 'python', label: 'Python', description: 'Python programming and data science', icon: <FaLightbulb /> },
  { id: 'dbms', label: 'DBMS', description: 'Database management systems', icon: <FaDatabase /> },
  { id: 'full-stack', label: 'Full Stack', description: 'Web development (frontend + backend)', icon: <FaLaptopCode /> },
]

const ROLES = ['Software Engineer', 'Frontend Developer', 'Backend Developer', 'Full-Stack Developer', 'Data Analyst', 'HR / Behavioral']
const LEVELS = ['Beginner', 'Intermediate', 'Advanced']
const MAX_FOLLOW_UPS = 3

const TECHNOLOGY_QUESTIONS: Record<Technology, Question[]> = {
  java: [
    { id: 1, text: 'Explain the concept of inheritance in Java and provide an example', category: 'Java' },
    { id: 2, text: 'What is the difference between abstract classes and interfaces in Java?', category: 'Java' },
    { id: 3, text: 'How do you handle exceptions in Java? What are checked and unchecked exceptions?', category: 'Java' },
  ],
  python: [
    { id: 1, text: 'Explain list comprehension in Python and why it is useful', category: 'Python' },
    { id: 2, text: 'What are decorators in Python? Can you provide a real-world example?', category: 'Python' },
    { id: 3, text: 'How does Python handle memory management and garbage collection?', category: 'Python' },
  ],
  dbms: [
    { id: 1, text: 'What is normalization in databases? Explain the different normal forms', category: 'DBMS' },
    { id: 2, text: 'What are indexes in databases and how do they improve performance?', category: 'DBMS' },
    { id: 3, text: 'Explain the difference between INNER JOIN and LEFT JOIN in SQL', category: 'DBMS' },
  ],
  'full-stack': [
    { id: 1, text: 'What is the difference between HTTP and HTTPS? Why is HTTPS important?', category: 'Full Stack' },
    { id: 2, text: 'Explain the concept of REST API and how it differs from SOAP', category: 'Full Stack' },
    { id: 3, text: 'What is the purpose of a frontend framework like React or Vue? What problems does it solve?', category: 'Full Stack' },
  ],
}

const GENERAL_QUESTIONS: Question[] = [
  { id: 1, text: 'Tell me about yourself', category: 'General' },
  { id: 2, text: 'What are your greatest strengths?', category: 'Behavioral' },
  { id: 3, text: 'Describe a challenge you faced and how you overcame it', category: 'Behavioral' },
  { id: 4, text: 'Where do you see yourself in 5 years?', category: 'Career Goals' },
]

const App = () => {
  const [currentStep, setCurrentStep] = useState<'login' | 'welcome' | 'technology-selection' | 'interview' | 'feedback'>('login')
  const [selectedTechnologies, setSelectedTechnologies] = useState<Technology[]>([])
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [isListening, setIsListening] = useState(false)
  const [currentAnswer, setCurrentAnswer] = useState('')
  const [recordedAnswers, setRecordedAnswers] = useState<{questionId: number, answer: string}[]>([])
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [useChatGpt, setUseChatGpt] = useState(true)
  const [role, setRole] = useState(ROLES[0])
  const [difficulty, setDifficulty] = useState(LEVELS[1])
  const [jobDescription, setJobDescription] = useState('')
  const [consentNeeded, setConsentNeeded] = useState(false)
  const [preparing, setPreparing] = useState(false)
  const questionsRef = useRef<Question[]>([])
  const answersRef = useRef<any[]>([])
  const followUpsRef = useRef(0)
  const [timeoutSeconds, setTimeoutSeconds] = useState(5)
  const [status, setStatus] = useState<'idle' | 'speaking' | 'listening' | 'processing' | 'timeout'>('idle')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [isSignUpMode, setIsSignUpMode] = useState(false)
  const [signUpData, setSignUpData] = useState({ name: '', email: '', username: '', password: '', confirmPassword: '' })
  const [signUpError, setSignUpError] = useState('')
  const [showSignUpPassword, setShowSignUpPassword] = useState(false)
  const [showSignUpConfirmPassword, setShowSignUpConfirmPassword] = useState(false)
  const [userId, setUserId] = useState<number | null>(null)
  const [userName, setUserName] = useState('')
  const [loading, setLoading] = useState(false)
  const [webcamError, setWebcamError] = useState<string | null>(null)
  const webcamRef = useRef<Webcam>(null)
  const recognitionRef = useRef<any>(null)
  const recognitionStartRef = useRef<number | null>(null)
  const [enableFaceAnalysis, setEnableFaceAnalysis] = useState(false)
  const [perAnswerFeedback, setPerAnswerFeedback] = useState<any[]>([])
  const [resumeText, setResumeText] = useState('')
  const [resumeParseResult, setResumeParseResult] = useState<any | null>(null)
  const [resumeParsing, setResumeParsing] = useState(false)
  const [history, setHistory] = useState<any[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [authChecking, setAuthChecking] = useState(true)
  const timeoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const questionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const questionStartedRef = useRef<boolean>(false)
  const userHasStartedSpeakingRef = useRef<boolean>(false)
  const noResponseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const recorderRef = useRef<AnswerRecorder | null>(null)
  if (!recorderRef.current) recorderRef.current = new AnswerRecorder()
  const transcriptRef = useRef('')
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const faceDetectorRef = useRef<any>(null)
  const [camId, setCamId] = useState('')
  const [micId, setMicId] = useState('')
  const [camReady, setCamReady] = useState(false)
  const [micStream, setMicStream] = useState<MediaStream | null>(null)
  const onCamError = useCallback((e: any) => setWebcamError(e?.name || e?.message || 'Camera access error'), [])
  const onCamReady = useCallback(() => { setWebcamError(null); setCamReady(true) }, [])

  // Samples whether the face is centered, right when an answer ends (small image = fast).
  const sampleFraming = async (): Promise<number | null> => {
    const FD = (window as any).FaceDetector
    if (!enableFaceAnalysis || !FD || !webcamRef.current) return null
    try {
      if (!faceDetectorRef.current) faceDetectorRef.current = new FD({ fastMode: true, maxDetectedFaces: 1 })
      const dataUrl = (webcamRef.current as any).getScreenshot({ width: 320, height: 240 })
      if (!dataUrl) return null
      const img = await new Promise<HTMLImageElement>((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = dataUrl })
      const faces = await faceDetectorRef.current.detect(img)
      if (!faces.length) return 0
      const b = faces[0].boundingBox
      return Math.round(Math.max(0, 1 - (Math.abs(b.x + b.width / 2 - img.width / 2) / img.width) * 2) * 100)
    } catch { return null }
  }

  // Speech recognition support and error states
  const [speechRecognitionSupported, setSpeechRecognitionSupported] = useState<boolean>(false)
  const [speechRecognitionError, setSpeechRecognitionError] = useState<string | null>(null)
  const [microphonePermissionGranted, setMicrophonePermissionGranted] = useState<boolean>(false)
  const [isRecognitionActive, setIsRecognitionActive] = useState<boolean>(false)

  const getQuestionsForSelectedTechnologies = (): Question[] => {
    const technologyQuestions: Question[] = []
    selectedTechnologies.forEach(tech => {
      technologyQuestions.push(...TECHNOLOGY_QUESTIONS[tech])
    })
    return technologyQuestions
  }

  // Interview questions state: populated once when interview starts to avoid repeats
  const [interviewQuestions, setInterviewQuestions] = useState<Question[]>([])
  const currentConfidenceRef = useRef<number | null>(null)

  // Shuffle helper (Fisher-Yates)
  const shuffleArray = <T,>(array: T[]) => {
    const a = array.slice()
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[a[i], a[j]] = [a[j], a[i]]
    }
    return a
  }

  const extractKeywords = (text: string) => {
    const stopwords = new Set(['the','is','and','or','a','an','of','in','to','for','with','on','what','how','why','you','your','be'])
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w && !stopwords.has(w))
  }

  // Initialize speech recognition support check
  useEffect(() => {
    checkSpeechRecognitionSupport()
  }, [])

  // Ask for consent once per account
  useEffect(() => {
    if (!isLoggedIn) return
    fetch(`${API_URL}/api/user`, { headers: { ...getAuthHeaders() } })
      .then(r => (r.ok ? r.json() : null))
      .then(u => { if (u && !u.consent_at) setConsentNeeded(true) })
      .catch(() => {})
  }, [isLoggedIn])

  const acceptConsent = async () => {
    try { await fetch(`${API_URL}/api/consent`, { method: 'POST', headers: { ...getAuthHeaders() } }) } catch {}
    setConsentNeeded(false)
  }

  // Restore the authenticated session when the page is refreshed.
  useEffect(() => {
    const restoreSession = async () => {
      const token = sessionStorage.getItem('authToken')

      if (!token) {
        setAuthChecking(false)
        return
      }

      try {
        const response = await fetch(`${API_URL}/api/user`, {
          headers: { ...getAuthHeaders() }
        })

        if (!response.ok) {
          sessionStorage.removeItem('authToken')
          setIsLoggedIn(false)
          setUserId(null)
          setUserName('')
          return
        }

        const data = await response.json()
        setUserId(data.id)
        setUserName(data.name)
        setIsLoggedIn(true)
        setCurrentStep('welcome')
      } catch (error) {
        console.error('Session restore error:', error)
        sessionStorage.removeItem('authToken')
      } finally {
        setAuthChecking(false)
      }
    }

    restoreSession()
  }, [])

  // Initialize speech recognition
  useEffect(() => {
    // Check browser support first
    if (!checkSpeechRecognitionSupport()) {
      return
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition()
      // Use interim results but not continuous to avoid issues
      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = SPEECH_LANG
      // Increase max alternatives for better accuracy
      recognition.maxAlternatives = 1

      recognition.onstart = () => {
        recognitionStartRef.current = Date.now()
        setIsListening(true)
        setIsRecognitionActive(true)
        setStatus('listening')
        setSpeechRecognitionError(null)
      }

      recognition.onresult = (event: any) => {
        // User has started speaking - clear the 5-second no-response timeout
        if (!userHasStartedSpeakingRef.current) {
          userHasStartedSpeakingRef.current = true
          if (noResponseTimeoutRef.current) {
            clearTimeout(noResponseTimeoutRef.current)
            noResponseTimeoutRef.current = null
          }
        }

        // Rebuild the whole transcript (continuous mode keeps every segment)
        let interimTranscript = ''
        let finalTranscript = ''
        let confSum = 0
        let confN = 0
        for (let i = 0; i < event.results.length; i++) {
          const result = event.results[i]
          const text = result[0].transcript
          if (result.isFinal) {
            finalTranscript += text + ' '
            if (typeof result[0].confidence === 'number' && result[0].confidence > 0) { confSum += result[0].confidence; confN++ }
          } else {
            interimTranscript += text
          }
        }
        if (confN) currentConfidenceRef.current = confSum / confN
        transcriptRef.current = (finalTranscript + interimTranscript).replace(/\s+/g, ' ').trim()
        if (!flushTimerRef.current) {
          flushTimerRef.current = setTimeout(() => { flushTimerRef.current = null; setCurrentAnswer(transcriptRef.current) }, 150)
        }

        // End the answer after 2.5s of silence (allows natural pauses mid-answer)
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
        silenceTimerRef.current = setTimeout(() => {
          try { recognitionRef.current?.stop() } catch (e) { console.warn('Error stopping recognition after silence', e) }
        }, 2500)
      }

      recognition.onend = () => {
        // flush the last transcript immediately so the answer is never cut short
        if (flushTimerRef.current) { clearTimeout(flushTimerRef.current); flushTimerRef.current = null }
        if (transcriptRef.current) setCurrentAnswer(transcriptRef.current)
        // recognition ended (usually due to user silence or manual stop)
        setIsListening(false)
        setIsRecognitionActive(false)
        // Clear any pending silence timer
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current)
          silenceTimerRef.current = null
        }
      }

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error', event.error, event)
        setIsListening(false)
        setIsRecognitionActive(false)

        // Provide user-friendly error messages
        let errorMessage = 'Speech recognition error occurred.'
        switch (event.error) {
          case 'no-speech':
            errorMessage = 'No speech detected. Please speak clearly into your microphone.'
            break
          case 'audio-capture':
            errorMessage = 'Audio capture failed. Please check your microphone connection.'
            break
          case 'not-allowed':
            errorMessage = 'Microphone permission denied. Please allow microphone access and reload the page.'
            setMicrophonePermissionGranted(false)
            break
          case 'network':
            errorMessage = 'Network error occurred. Please check your internet connection.'
            break
          case 'service-not-allowed':
            errorMessage = 'Speech recognition service not allowed. This may be due to browser restrictions.'
            break
          case 'bad-grammar':
            errorMessage = 'Speech recognition grammar error. Please try again.'
            break
          case 'language-not-supported':
            errorMessage = 'Language not supported. Please use English.'
            break
          default:
            errorMessage = `Speech recognition error: ${event.error}`
        }

        setSpeechRecognitionError(errorMessage)
        setStatus('idle')
      }

      recognitionRef.current = recognition
    }

    return () => {
      try {
        if (recognitionRef.current) {
          recognitionRef.current.onresult = null
          recognitionRef.current.onend = null
          recognitionRef.current.onerror = null
          recognitionRef.current.onstart = null
          recognitionRef.current.abort && recognitionRef.current.abort()
        }
      } catch (e) {
        console.warn('Error cleaning up recognition', e)
      }
      recognitionRef.current = null
      recorderRef.current?.release()
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current)
        silenceTimerRef.current = null
      }
      if (noResponseTimeoutRef.current) {
        clearTimeout(noResponseTimeoutRef.current)
        noResponseTimeoutRef.current = null
      }
      if (timeoutTimerRef.current) {
        clearTimeout(timeoutTimerRef.current)
        timeoutTimerRef.current = null
      }
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current)
        countdownTimerRef.current = null
      }
    }
  }, [])

  // Speak question and start listening
  useEffect(() => {
    if (currentStep === 'interview' && interviewQuestions.length > 0) {
      // Only start if we haven't already started this question
      if (questionStartedRef.current) {
        return
      }
      
      questionStartedRef.current = true
      userHasStartedSpeakingRef.current = false
      const currentQuestion = interviewQuestions[currentQuestionIndex]
      
      // Clear any existing timers
      if (noResponseTimeoutRef.current) clearTimeout(noResponseTimeoutRef.current)
      if (timeoutTimerRef.current) clearTimeout(timeoutTimerRef.current)
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current)

      // Reset states
      transcriptRef.current = ''
      setCurrentAnswer('')
      setStatus('speaking')

      // Speak the question (only once)
      const utterance = new SpeechSynthesisUtterance(currentQuestion.text)
      utterance.rate = 1
      utterance.pitch = 1
      utterance.volume = 1

      let proceeded = false
      utterance.onend = async () => {
        if (proceeded) return
        proceeded = true
        clearTimeout(speakWatchdog)
        // Start listening after question is spoken
        setTimeout(async () => {
          // clear any leftover silence timers
          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current)
            silenceTimerRef.current = null
          }

          const started = await startSpeechRecognition()
          if (!started) {
            setStatus('idle')
            return
          }

          setStatus('listening')

          // Set a 5-second timeout for no response
          noResponseTimeoutRef.current = setTimeout(() => {
            if (recognitionRef.current) {
              try {
                recognitionRef.current.stop()
              } catch (e) {
                console.warn('Error stopping recognition on timeout:', e)
              }
            }
            // No response received - move to next question
            setStatus('timeout')
            transcriptRef.current = ''
            setCurrentAnswer('')

            setTimeout(() => {
              moveToNextQuestion()
            }, 1000)
          }, 5000)

          // Set a safety timeout (60 seconds max) to prevent infinite listening
          timeoutTimerRef.current = setTimeout(() => {
            if (recognitionRef.current) {
              try {
                recognitionRef.current.stop()
              } catch (e) {
                console.warn('Error stopping recognition on safety timeout:', e)
              }
            }
            setStatus('timeout')

            setTimeout(() => {
              moveToNextQuestion()
            }, 1000)
          }, 60000)
        }, 300)
      }
      utterance.onerror = () => { utterance.onend?.(null as any) }
      // Chrome sometimes never fires onend for speech synthesis; don't let the interview hang
      const speakWatchdog = setTimeout(() => {
        try { speechSynthesis.cancel() } catch {}
        utterance.onend?.(null as any)
      }, Math.max(5000, currentQuestion.text.length * 90 + 2500))

      speechSynthesis.speak(utterance)
    }

    return () => {
      if (noResponseTimeoutRef.current) clearTimeout(noResponseTimeoutRef.current)
      if (timeoutTimerRef.current) clearTimeout(timeoutTimerRef.current)
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current)
    }
  }, [currentStep, currentQuestionIndex, interviewQuestions])

  // Auto move to next question when user stops speaking
  useEffect(() => {
    if (isListening === false && currentAnswer.trim() && status === 'listening') {
      setStatus('processing')
      ;(async () => {
      const currentQuestion = interviewQuestions[currentQuestionIndex]
      const liveWords = currentAnswer.trim().split(/\s+/).filter(Boolean).length
      const techLabels = selectedTechnologies.map(t => TECHNOLOGY_OPTIONS.find(opt => opt.id === t)?.label).filter(Boolean).join(', ')
      const wantFollowUp = useChatGpt && followUpsRef.current < MAX_FOLLOW_UPS && currentQuestion.category !== 'Follow-up' && liveWords >= 15
      const blob = (await recorderRef.current?.stop()) ?? null

      // Run transcription, follow-up generation and camera sampling at the same time (not one after another)
      const [better, followUpText, framing] = await Promise.all([
        transcribe(blob, techLabels, sessionStorage.getItem('authToken') || ''),
        wantFollowUp
          ? fetch(`${API_URL}/api/follow-up`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
              body: JSON.stringify({ question: currentQuestion.text, answer: currentAnswer, role, difficulty }),
              signal: AbortSignal.timeout(8000)
            }).then(r => (r.ok ? r.json() : null)).then(j => (j?.followUp as string) || null).catch(() => null)
          : Promise.resolve(null),
        sampleFraming()
      ])
      const answerText = better && better.trim() ? better.trim() : currentAnswer
      if (answerText !== currentAnswer) setCurrentAnswer(answerText)

      // Timing & pacing
      const startTs = recognitionStartRef.current || Date.now()
      const durationMs = Math.max(300, Date.now() - startTs)
      const words = answerText.trim().split(/\s+/).filter(Boolean).length
      const wpm = Math.round(words / (durationMs / 60000) || 0)
      const fillerMatches = (answerText.match(/\b(um|uh|like|you know|so)\b/gi) || [])
      const fillerCount = fillerMatches.length
      const fillerPenalty = Math.min(1, fillerCount / 5)

      // Relevance (keyword overlap)
      const qKeys = extractKeywords(currentQuestion?.text || '')
      const aKeys = extractKeywords(answerText)
      const qSet = new Set(qKeys)
      let common = 0
      for (const k of aKeys) if (qSet.has(k)) common++
      const relevance = qKeys.length > 0 ? Math.min(1, common / qKeys.length) : (aKeys.length > 0 ? 1 : 0)
      const relevancePct = Math.round(relevance * 100)

      // Pace score (ideal ~140 WPM)
      const paceScore = Math.max(0, 100 - Math.min(100, Math.abs(wpm - 140)))

      // Local score (weighted): relevance 50%, fillers 20%, pace 30%
      const localScore = Math.round((relevancePct * 0.5) + ((1 - fillerPenalty) * 100 * 0.2) + (paceScore * 0.3))

      const answerRecord = {
        questionId: currentQuestion.id,
        question: currentQuestion.text,
        answer: answerText,
        confidence: currentConfidenceRef.current ?? 0,
        durationMs,
        words,
        wpm,
        fillerCount,
        localScore,
        framing,
      }

      answersRef.current = [...answersRef.current, answerRecord]
      setRecordedAnswers((prev) => [...prev, answerRecord])

      setPerAnswerFeedback((prev) => [...prev, {
        questionId: currentQuestion.id,
        relevance: relevancePct,
        fillerCount,
        wpm,
        localScore,
        suggestions: [
          ...(relevancePct < 60 ? ['Be more specific; include keywords and examples.'] : []),
          ...(fillerCount > 2 ? ['Reduce filler words (um/uh/like); pause briefly instead.'] : []),
          ...(wpm < 100 ? ['Speak a little faster to improve pacing.'] : (wpm > 180 ? ['Slow down slightly; avoid rushing.'] : []))
        ]
      }])

      // reset confidence and start-time
      currentConfidenceRef.current = null
      recognitionStartRef.current = null

      setStatus('processing')

      // Clear all timers
      if (noResponseTimeoutRef.current) clearTimeout(noResponseTimeoutRef.current)
      if (timeoutTimerRef.current) clearTimeout(timeoutTimerRef.current)
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current)

      // Insert the AI follow-up right after the current question
      if (followUpText) {
        followUpsRef.current += 1
        const fq: Question = { id: 5000 + followUpsRef.current, text: followUpText, category: 'Follow-up' }
        const next = [...questionsRef.current.slice(0, currentQuestionIndex + 1), fq, ...questionsRef.current.slice(currentQuestionIndex + 1)]
        questionsRef.current = next
        setInterviewQuestions(next)
      }

      // Move to next question after a short pause
      setTimeout(() => {
        moveToNextQuestion()
      }, 500)
          })()
    }
  }, [isListening, currentAnswer])

  useEffect(() => {
    if (currentStep === 'interview' && micId) recorderRef.current?.prepare(micId).then(setMicStream).catch(() => {})
  }, [micId])

  const toggleTechnology = (tech: Technology) => {
    if (selectedTechnologies.includes(tech)) {
      setSelectedTechnologies(selectedTechnologies.filter(t => t !== tech))
    } else {
      setSelectedTechnologies([...selectedTechnologies, tech])
    }
  }

  const proceedToTechnologySelection = () => {
    setCurrentStep('technology-selection')
  }

  const startInterview = async () => {
    if (selectedTechnologies.length === 0) {
      alert('Please select at least one technology')
      return
    }
    setPreparing(true)
    recorderRef.current?.prepare(micId || undefined).then(setMicStream).catch((e) => console.warn('Microphone not ready yet', e))
    const techLabels = selectedTechnologies.map(tid => TECHNOLOGY_OPTIONS.find(o => o.id === tid)?.label).filter(Boolean).join(', ')
    let selected: Question[] | null = null
    if (useChatGpt) {
      try {
        const resp = await fetch(`${API_URL}/api/generate-questions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
          body: JSON.stringify({ technologies: techLabels, role, difficulty, resumeText, jobDescription, count: 8 }),
          signal: AbortSignal.timeout(30000)
        })
        if (resp.ok) selected = (await resp.json()).questions
      } catch (e) { console.warn('AI question generation failed; using the built-in question bank', e) }
    }
    if (!selected || selected.length === 0) {
      // Fallback: built-in bank
      const pool = [...getQuestionsForSelectedTechnologies(), ...GENERAL_QUESTIONS]
      selected = shuffleArray(pool).slice(0, Math.min(10, pool.length))
    }
    questionsRef.current = selected
    answersRef.current = []
    followUpsRef.current = 0
    questionStartedRef.current = false
    userHasStartedSpeakingRef.current = false
    setRecordedAnswers([])
    setPerAnswerFeedback([])
    setCurrentAnswer('')
    setCurrentQuestionIndex(0)
    setInterviewQuestions(selected)
    setPreparing(false)
    setCurrentStep('interview')
  }

  const moveToNextQuestion = async () => {
    void recorderRef.current?.stop()
    questionStartedRef.current = false
    userHasStartedSpeakingRef.current = false
    if (currentQuestionIndex < questionsRef.current.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1)
    } else {
      await generateFeedback()
      setCurrentStep('feedback')
    }
  }

  const generateFeedback = async () => {
    // Analyze recorded answers for relevance, pronunciation, and fillers
    const techList = selectedTechnologies.map(t => TECHNOLOGY_OPTIONS.find(opt => opt.id === t)?.label).join(', ')

    // reuse global extractKeywords helper (local keyword extraction removed)

    recorderRef.current?.release()
    setMicStream(null)
    const recordedAnswers = answersRef.current
    const interviewQuestions = questionsRef.current
    const perAnswerScores: { relevance: number; pronunciation: number; fillers: number; eyeContact: number }[] = []

    // If FaceDetector is available, create one
    const hasFaceDetector = typeof (window as any).FaceDetector !== 'undefined'

    for (const ans of recordedAnswers) {
      const q = interviewQuestions.find(qi => qi.id === ans.questionId)
      const answerText = (ans.answer || '').toString()

      // Relevance: keyword overlap
      const qKeys = extractKeywords(q?.text || '')
      const aKeys = extractKeywords(answerText)
      const qSet = new Set(qKeys)
      let common = 0
      for (const k of aKeys) if (qSet.has(k)) common++
      const relevance = qKeys.length > 0 ? Math.min(1, common / qKeys.length) : (aKeys.length > 0 ? 1 : 0)

      // Pronunciation: use confidence if available (0-1)
      const conf = typeof (ans as any).confidence === 'number' ? (ans as any).confidence : 0.75
      const pronunciation = Math.round(conf * 100)

      // Fillers/body-language proxy: count filler words
      const fillers = (answerText.match(/\b(um|uh|like|you know|so)\b/gi) || []).length
      const fillerPenalty = Math.min(1, fillers / 5)
      const fillersScore = Math.round((1 - fillerPenalty) * 100)

      // Camera framing was sampled when each answer ended (informational only, not scored)
      const eyeScore = typeof (ans as any).framing === 'number' ? (ans as any).framing : 75

      perAnswerScores.push({ relevance: Math.round(relevance * 100), pronunciation, fillers: fillersScore, eyeContact: eyeScore })
    }

    // Aggregate weighted scores
    let totalRelevance = 0, totalPron = 0, totalFillers = 0, totalEye = 0
    if (perAnswerScores.length === 0) perAnswerScores.push({ relevance: 0, pronunciation: 75, fillers: 80, eyeContact: 75 })
    for (const s of perAnswerScores) {
      totalRelevance += s.relevance
      totalPron += s.pronunciation
      totalFillers += s.fillers
      totalEye += s.eyeContact
    }
    const n = perAnswerScores.length
    const avgRelevance = Math.round(totalRelevance / n)
    const avgPron = Math.round(totalPron / n)
    const avgFillers = Math.round(totalFillers / n)
    const avgEye = Math.round(totalEye / n)

    // Weights: relevance 45%, pronunciation/clarity 30%, fillers 25%. Camera framing is informational only (not scored).
    const overall = Math.round((avgRelevance * 0.45) + (avgPron * 0.3) + (avgFillers * 0.25))
    const showFraming = enableFaceAnalysis && hasFaceDetector

    const analysis = `Average relevance: ${avgRelevance}%. Speech clarity: ${avgPron}%. Filler-word score: ${avgFillers}%.${showFraming ? ` Camera framing (face centered, not scored): ${avgEye}%.` : ''}`
    const suggestions: string[] = []
    if (avgRelevance < 60) suggestions.push('Be more specific and directly address the question; include key concepts or keywords.')
    if (avgPron < 70) suggestions.push('Work on clear pronunciation and pacing; speak slightly slower and enunciate.')
    if (avgFillers < 70) suggestions.push('Reduce filler words (um/uh/like); pause briefly instead of saying fillers.')
    if (showFraming && avgEye < 60) suggestions.push('Keep your face centered and well lit in the camera frame.')

    const finalFeedback: Feedback = {
      score: overall,
      analysis,
      suggestions: suggestions.length ? suggestions : ['Good job — keep practicing and add more technical examples.']
    }

    let savedFeedback: Feedback = finalFeedback
    // If AI features are enabled, request rubric-based feedback
    if (useChatGpt) {
      try {
        setStatus('processing')
        const resp = await fetch(`${API_URL}/api/analyze-answer`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders()
          },
          body: JSON.stringify({ technologies: selectedTechnologies.join(','), recordedAnswers, interviewQuestions, role, difficulty })
        })
        if (resp.ok) {
          const json = await resp.json()
          if (json && typeof json.score === 'number') {
            const serverFeedback: Feedback = {
              score: Math.round(json.score),
              analysis: json.analysis || finalFeedback.analysis,
              suggestions: Array.isArray(json.suggestions) && json.suggestions.length ? json.suggestions : finalFeedback.suggestions,
              rubric: json.rubric,
              strengths: Array.isArray(json.strengths) ? json.strengths : []
            }
            savedFeedback = serverFeedback
            setFeedback(serverFeedback)
          } else {
            // fallback to local heuristic
            setFeedback(finalFeedback)
          }
        } else {
          console.error('Server analyze failed', await resp.text())
          setFeedback(finalFeedback)
        }
      } catch (err) {
        console.error('Error calling analyze endpoint', err)
        setFeedback(finalFeedback)
      } finally {
        setStatus('idle')
      }
    } else {
      setFeedback(finalFeedback)
    }

    // Save feedback to the authenticated user's history.
    try {
      const token = sessionStorage.getItem('authToken')
      if (!token) {
        console.error('No authentication token found; interview results were not saved.')
        return
      }

      const response = await fetch(`${API_URL}/api/interview-results`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          technologies: selectedTechnologies.join(','),
          score: savedFeedback.score,
          answers: recordedAnswers,
          role,
          difficulty,
          rubric: savedFeedback.rubric,
          analysis: savedFeedback.analysis,
          strengths: savedFeedback.strengths,
          suggestions: savedFeedback.suggestions
        })
      })

      if (response.ok) {
        console.log('Interview results saved successfully')
      } else {
        console.error('Failed to save interview results:', await response.text())
      }
    } catch (error) {
      console.error('Error saving interview results:', error)
    }
  }

  const restartInterview = () => {
    questionStartedRef.current = false
    userHasStartedSpeakingRef.current = false
    setCurrentStep('welcome')
    setSelectedTechnologies([])
    setFeedback(null)
  }

  // Try to trigger camera permission prompt / check availability
  const requestCameraPermission = async () => {
    setWebcamError(null)
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setWebcamError('Camera API not supported in this browser')
        return
      }
      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      // immediately stop tracks - we only wanted permission / availability
      stream.getTracks().forEach((t) => t.stop())
      setWebcamError(null)
    } catch (err: any) {
      const errorName = err?.name || 'Unknown Error'
      const errorMsg = err?.message || 'Camera access denied or unavailable'
      console.error('Camera error details:', { name: errorName, message: errorMsg })
      
      // Provide specific error messages
      if (errorName === 'NotReadableError') {
        setWebcamError('NotReadableError: Camera is already in use. Close other apps/tabs using the camera (Teams, Zoom, Discord, other browser tabs) and try again.')
      } else if (errorName === 'NotAllowedError') {
        setWebcamError('Camera permission denied. Please allow camera access in browser settings and reload.')
      } else if (errorName === 'NotFoundError') {
        setWebcamError('No camera found. Please connect a camera and reload the browser.')
      } else {
        setWebcamError(`${errorName}: ${errorMsg}`)
      }
    }
  }

  // Check microphone permission and speech recognition support
  const checkMicrophonePermission = async () => {
    if (microphonePermissionGranted || recorderRef.current?.stream) return true
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach(track => track.stop())
      setMicrophonePermissionGranted(true)
      setSpeechRecognitionError(null)
      return true
    } catch (error: any) {
      setMicrophonePermissionGranted(false)
      if (error.name === 'NotAllowedError') {
        setSpeechRecognitionError('Microphone permission denied. Please allow microphone access in browser settings and reload.')
      } else if (error.name === 'NotFoundError') {
        setSpeechRecognitionError('No microphone found. Please connect a microphone and reload.')
      } else {
        setSpeechRecognitionError(`Microphone access error: ${error.message}`)
      }
      return false
    }
  }

  // Check if speech recognition is supported
  const checkSpeechRecognitionSupport = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      setSpeechRecognitionSupported(false)
      setSpeechRecognitionError('Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.')
      return false
    }

    // Check if running on HTTPS (required by some browsers)
    if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
      setSpeechRecognitionError('Speech recognition requires HTTPS. Please access this site over HTTPS.')
      setSpeechRecognitionSupported(false)
      return false
    }

    setSpeechRecognitionSupported(true)
    setSpeechRecognitionError(null)
    return true
  }

  // Safely start speech recognition with proper error handling
  const startSpeechRecognition = async () => {
    if (!speechRecognitionSupported || !recognitionRef.current) {
      setSpeechRecognitionError('Speech recognition is not available.')
      return false
    }

    // Check microphone permission first
    const hasPermission = await checkMicrophonePermission()
    if (!hasPermission) {
      return false
    }

    // If recognition is already active, abort it first
    if (isRecognitionActive) {
      try {
        recognitionRef.current.abort()
        setIsRecognitionActive(false)
        // Wait a bit for the abort to complete
        await new Promise(resolve => setTimeout(resolve, 100))
      } catch (e) {
        console.warn('Error aborting existing recognition:', e)
      }
    }

    try {
      recognitionRef.current.start()
      recorderRef.current?.start().catch((e) => console.warn('Audio recorder unavailable; using live captions only', e))
      setIsRecognitionActive(true)
      setSpeechRecognitionError(null)
      return true
    } catch (e: any) {
      console.error('Failed to start speech recognition:', e)
      setIsRecognitionActive(false)

      // Provide specific error messages based on the error
      let errorMessage = 'Failed to start speech recognition. Please try again.'
      if (e.name === 'InvalidStateError') {
        errorMessage = 'Speech recognition is already running. Please wait for it to finish.'
      } else if (e.name === 'NotAllowedError') {
        errorMessage = 'Microphone permission was denied. Please allow microphone access.'
      } else if (e.name === 'NotFoundError') {
        errorMessage = 'No microphone found. Please connect a microphone.'
      }

      setSpeechRecognitionError(errorMessage)
      return false
    }
  }

  const handleLogin = async () => {
    setLoginError('')
    setLoading(true)
    
    // Basic validation
    if (!username.trim()) {
      setLoginError('Please enter a username')
      setLoading(false)
      return
    }
    if (!password.trim()) {
      setLoginError('Please enter a password')
      setLoading(false)
      return
    }
    
    try {
      const response = await fetch(`${API_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      })
      
      const data = await response.json()
      
      if (response.ok) {
        sessionStorage.setItem('authToken', data.token)
        setUserId(data.user.id)
        setUserName(data.user.name)
        setIsLoggedIn(true)
        setCurrentStep('welcome')
        setUsername('')
        setPassword('')
      } else {
        setLoginError(data.error || 'Login failed')
      }
    } catch (error) {
      setLoginError('Error connecting to server. Make sure backend is running on http://localhost:3001')
      console.error('Login error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSignUp = async () => {
    setSignUpError('')
    setLoading(true)

    // Validation
    if (!signUpData.name.trim()) {
      setSignUpError('Please enter your name')
      setLoading(false)
      return
    }
    if (!signUpData.email.trim() || !signUpData.email.includes('@')) {
      setSignUpError('Please enter a valid email')
      setLoading(false)
      return
    }
    if (!signUpData.username.trim() || signUpData.username.length < 3) {
      setSignUpError('Username must be at least 3 characters')
      setLoading(false)
      return
    }
    if (!signUpData.password.trim() || signUpData.password.length < 8) {
      setSignUpError('Password must be at least 8 characters')
      setLoading(false)
      return
    }
    if (signUpData.password !== signUpData.confirmPassword) {
      setSignUpError('Passwords do not match')
      setLoading(false)
      return
    }

    try {
      const response = await fetch(`${API_URL}/api/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: signUpData.name,
          email: signUpData.email,
          username: signUpData.username,
          password: signUpData.password
        })
      })
      
      const data = await response.json()
      
      if (response.ok) {
        // The secured backend returns a JWT on successful signup.
        if (data.token) {
          sessionStorage.setItem('authToken', data.token)
        }

        setSignUpError('')
        setSignUpData({ name: '', email: '', username: '', password: '', confirmPassword: '' })
        setIsSignUpMode(false)

        if (data.token && data.user) {
          setUserId(data.user.id)
          setUserName(data.user.name)
          setIsLoggedIn(true)
          setCurrentStep('welcome')
          setLoginError('')
        } else {
          setLoginError('Registration successful! Please log in.')
        }
      } else {
        setSignUpError(data.error || 'Signup failed')
      }
    } catch (error) {
      setSignUpError('Error connecting to server. Make sure backend is running on http://localhost:3001')
      console.error('Signup error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    sessionStorage.removeItem('authToken')
    setIsLoggedIn(false)
    setCurrentStep('login')
    setUsername('')
    setPassword('')
    setLoginError('')
    setSelectedTechnologies([])
    setFeedback(null)
    setUserId(null)
    setUserName('')
  }

  return (
    <div className="flex items-center justify-center min-h-screen p-4 relative overflow-hidden">
      {/* AI-themed decorative background elements */}
      <div className="fixed inset-0 pointer-events-none opacity-10">
        <div className="absolute top-10 left-10 text-6xl text-blue-400"><FaBrain /></div>
        <div className="absolute top-1/3 right-20 text-8xl text-purple-400"><FaRobot /></div>
        <div className="absolute bottom-20 left-1/4 text-7xl text-cyan-400"><FaLightbulb /></div>
        <div className="absolute bottom-10 right-10 text-6xl text-blue-300"><FaCode /></div>
      </div>
      
      {/* Animated gradient orbs */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 w-96 h-96 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-5 animate-pulse"></div>
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-5 animate-pulse" style={{animationDelay: '2s'}}></div>
        <div className="absolute bottom-0 left-1/2 w-96 h-96 bg-cyan-500 rounded-full mix-blend-multiply filter blur-3xl opacity-5 animate-pulse" style={{animationDelay: '4s'}}></div>
      </div>
      
      <div className="relative z-10 flex flex-col items-center justify-center">
      {authChecking ? (
        <div className="max-w-md w-full bg-white/95 backdrop-blur rounded-2xl shadow-2xl p-8 border border-white/20 text-center">
          <div className="text-4xl text-blue-600 mb-4"><FaBrain /></div>
          <p className="text-gray-600">Checking your session...</p>
        </div>
      ) : (
      <>
      {currentStep === 'login' && !isLoggedIn && !isSignUpMode && (
        <div className="max-w-md w-full bg-white/95 backdrop-blur rounded-2xl shadow-2xl p-8 border border-white/20">
          <div className="flex justify-center mb-4">
            <div className="text-5xl text-blue-600 animate-bounce"><FaBrain /></div>
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2 text-center">AI Interview Coach</h1>
          <p className="text-gray-600 text-center mb-8">Master Your Interview Skills with AI</p>
          
          <div className="space-y-4">
            {/* Username Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value)
                  setLoginError('')
                }}
                placeholder="Enter your username"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition"
              />
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    setLoginError('')
                  }}
                  placeholder="Enter your password"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-gray-600 hover:text-primary"
                >
                  {showPassword ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {loginError && (
              <div className={`${loginError.includes('successful') ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'} border px-4 py-3 rounded-lg`}>
                {loginError}
              </div>
            )}

            {/* Login Button */}
            <button
              onClick={handleLogin}
              className="w-full bg-primary hover:bg-secondary text-white font-bold py-2 px-4 rounded-lg transition duration-200"
            >
              Sign In
            </button>

            {/* Sign Up Link */}
            <div className="text-center">
              <p className="text-gray-600">Don't have an account? 
                <button
                  onClick={() => {
                    setIsSignUpMode(true)
                    setLoginError('')
                    setUsername('')
                    setPassword('')
                  }}
                  className="text-primary hover:text-secondary font-semibold ml-1"
                >
                  Sign Up
                </button>
              </p>
            </div>
          </div>
        </div>
      )}

      {currentStep === 'login' && !isLoggedIn && isSignUpMode && (
        <div className="max-w-md w-full bg-white/95 backdrop-blur rounded-2xl shadow-2xl p-8 border border-white/20">
          <div className="flex justify-center mb-4">
            <div className="text-5xl text-blue-600"><FaRobot /></div>
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2 text-center">Create Account</h1>
          <p className="text-gray-600 text-center mb-8">Join AI Interview Coach</p>
          
          <div className="space-y-4">
            {/* Name Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
              <input
                type="text"
                value={signUpData.name}
                onChange={(e) => {
                  setSignUpData({...signUpData, name: e.target.value})
                  setSignUpError('')
                }}
                placeholder="Enter your full name"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition"
              />
            </div>

            {/* Email Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
              <input
                type="email"
                value={signUpData.email}
                onChange={(e) => {
                  setSignUpData({...signUpData, email: e.target.value})
                  setSignUpError('')
                }}
                placeholder="Enter your email"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition"
              />
            </div>

            {/* Username Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Username</label>
              <input
                type="text"
                value={signUpData.username}
                onChange={(e) => {
                  setSignUpData({...signUpData, username: e.target.value})
                  setSignUpError('')
                }}
                placeholder="Choose a username"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition"
              />
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
              <div className="relative">
                <input
                  type={showSignUpPassword ? 'text' : 'password'}
                  value={signUpData.password}
                  onChange={(e) => {
                    setSignUpData({...signUpData, password: e.target.value})
                    setSignUpError('')
                  }}
                  placeholder="Create a password"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition"
                />
                <button
                  type="button"
                  onClick={() => setShowSignUpPassword(!showSignUpPassword)}
                  className="absolute right-3 top-3 text-gray-600 hover:text-primary"
                >
                  {showSignUpPassword ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>
            </div>

            {/* Confirm Password Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Confirm Password</label>
              <div className="relative">
                <input
                  type={showSignUpConfirmPassword ? 'text' : 'password'}
                  value={signUpData.confirmPassword}
                  onChange={(e) => {
                    setSignUpData({...signUpData, confirmPassword: e.target.value})
                    setSignUpError('')
                  }}
                  placeholder="Confirm your password"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition"
                />
                <button
                  type="button"
                  onClick={() => setShowSignUpConfirmPassword(!showSignUpConfirmPassword)}
                  className="absolute right-3 top-3 text-gray-600 hover:text-primary"
                >
                  {showSignUpConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {signUpError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                {signUpError}
              </div>
            )}

            {/* Sign Up Button */}
            <button
              onClick={handleSignUp}
              className="w-full bg-primary hover:bg-secondary text-white font-bold py-2 px-4 rounded-lg transition duration-200"
            >
              Create Account
            </button>

            {/* Back to Login Link */}
            <div className="text-center">
              <p className="text-gray-600">Already have an account? 
                <button
                  onClick={() => {
                    setIsSignUpMode(false)
                    setSignUpError('')
                    setSignUpData({ name: '', email: '', username: '', password: '', confirmPassword: '' })
                  }}
                  className="text-primary hover:text-secondary font-semibold ml-1"
                >
                  Sign In
                </button>
              </p>
            </div>
          </div>
        </div>
      )}

      {isLoggedIn && currentStep === 'welcome' && (
        <div className="max-w-2xl w-full bg-white/95 backdrop-blur rounded-2xl shadow-2xl p-8 text-center relative border border-white/20">
          <button
            onClick={handleLogout}
            className="absolute top-4 right-4 flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition"
          >
            <FaSignOutAlt /> Logout
          </button>
          <div className="flex justify-center mb-4">
            <div className="text-6xl text-blue-600 animate-bounce"><FaBrain /></div>
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-4">AI Interview Coach</h1>
          <p className="text-gray-600 mb-6">
            Practice your interview skills with our AI coach. Answer questions and get detailed feedback on your performance.
          </p>

          <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200 text-left text-sm space-y-3">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={useChatGpt}
                onChange={(e) => setUseChatGpt(e.target.checked)}
                className="w-4 h-4"
              />
              <div>
                <div className="font-medium">Enable AI features</div>
                <div className="text-xs text-gray-500">Tailored questions, follow-ups based on your answers, and rubric scoring. Needs GEMINI_API_KEY on the server; otherwise the built-in question bank is used.</div>
              </div>
            </label>

            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={enableFaceAnalysis}
                onChange={(e) => setEnableFaceAnalysis(e.target.checked)}
                className="w-4 h-4"
              />
              <div>
                <div className="font-medium">Show camera framing tips (optional)</div>
                <div className="text-xs text-gray-500">Only checks whether your face is centered in the frame. It does not measure eye contact and does not affect your score. Runs locally; no images are stored.</div>
              </div>
            </label>

            {useChatGpt && (
              <div className="mt-1 text-sm text-gray-600">The backend will call Gemini and return richer feedback. Configure <code>GEMINI_API_KEY</code> in the server environment before enabling.</div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm font-medium text-gray-700">Role
                <select value={role} onChange={(e) => setRole(e.target.value)} className="mt-1 w-full border rounded px-2 py-1.5 font-normal bg-white">
                  {ROLES.map(r => <option key={r}>{r}</option>)}
                </select>
              </label>
              <label className="text-sm font-medium text-gray-700">Difficulty
                <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className="mt-1 w-full border rounded px-2 py-1.5 font-normal bg-white">
                  {LEVELS.map(l => <option key={l}>{l}</option>)}
                </select>
              </label>
            </div>
            <div className="mt-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Job description (optional)</label>
              <textarea value={jobDescription} onChange={(e) => setJobDescription(e.target.value.slice(0, 4000))} placeholder="Paste the job description to get questions for that role" className="w-full border rounded px-3 py-2 text-sm h-20" />
            </div>
            <div className="mt-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Paste resume (optional)</label>
              <textarea value={resumeText} onChange={(e) => setResumeText(e.target.value)} placeholder="Paste your resume here to generate tailored questions" className="w-full p-2 border rounded-md text-sm h-24" />
              <div className="flex gap-2 mt-2">
                <input type="file" accept=".txt" onChange={(e) => {
                  const f = (e.target as HTMLInputElement).files?.[0]
                  if (!f) return
                  f.text().then(t => setResumeText(t)).catch(() => alert('Unable to read file'))
                }} className="text-sm" />
                <button onClick={async () => {
                  if (!resumeText.trim()) { alert('Paste or upload resume text first'); return }
                  setResumeParsing(true)
                  try {
                    const resp = await fetch(`${API_URL}/api/parse-resume`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        ...getAuthHeaders()
                      },
                      body: JSON.stringify({ resumeText })
                    })
                    const json = await resp.json()
                    if (resp.ok) {
                      setResumeParseResult(json)
                      if (Array.isArray(json.detectedTechnologies) && json.detectedTechnologies.length) {
                        setSelectedTechnologies(json.detectedTechnologies as Technology[])
                      }
                    } else {
                      alert(json.error || 'Failed to parse resume')
                    }
                  } catch (err) {
                    console.error('Resume parse error', err)
                    alert('Error parsing resume')
                  } finally {
                    setResumeParsing(false)
                  }
                }} disabled={resumeParsing} className="bg-primary hover:bg-secondary text-white px-3 py-1 rounded text-sm">{resumeParsing ? 'Parsing...' : 'Generate tailored questions'}</button>

                <button onClick={() => setShowHistory(true)} className="ml-auto bg-gray-200 hover:bg-gray-300 px-3 py-1 rounded text-sm">My Progress &amp; Data</button>
              </div>

              {resumeParseResult && (
                <div className="mt-2 text-sm text-gray-700">Detected: {resumeParseResult.detectedTechnologies?.join(', ')}</div>
              )}
            </div>
          </div>

          <button
            onClick={proceedToTechnologySelection}
            className="bg-primary hover:bg-secondary text-white font-bold py-3 px-6 rounded-lg transition duration-200"
          >
            Start Practice Interview
          </button>
        </div>
      )}

      {isLoggedIn && currentStep === 'technology-selection' && (
        <div className="max-w-2xl w-full bg-white/95 backdrop-blur rounded-2xl shadow-2xl p-8 relative border border-white/20">
          <button
            onClick={handleLogout}
            className="absolute top-4 right-4 flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition"
          >
            <FaSignOutAlt /> Logout
          </button>
          <div className="flex justify-center mb-4">
            <div className="text-5xl text-blue-600"><FaLightbulb /></div>
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">Select Technologies</h1>
          <p className="text-gray-600 mb-8">Choose the technologies you want to be interviewed on. Select at least one to continue.</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            {TECHNOLOGY_OPTIONS.map((tech) => (
              <div
                key={tech.id}
                onClick={() => toggleTechnology(tech.id)}
                className={`p-4 rounded-lg border-2 cursor-pointer transition transform hover:scale-105 hover:-translate-y-1 shadow-md fade-in-up ${
                  selectedTechnologies.includes(tech.id)
                    ? 'border-primary bg-primary bg-opacity-10'
                    : 'border-gray-300 hover:border-primary'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 flex items-center justify-center rounded-full bg-white/10 text-2xl text-blue-500 float">
                    <div className="tech-icon">{tech.icon}</div>
                  </div>
                  <div className="text-left flex-1">
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                      {tech.label}
                      {selectedTechnologies.includes(tech.id) ? (
                        <FaCheckCircle className="text-primary ml-2" />
                      ) : null}
                    </h3>
                    <p className="text-gray-300 text-sm">{tech.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => setCurrentStep('welcome')}
              className="flex-1 bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg transition"
            >
              Back
            </button>
            <button
              onClick={startInterview}
              disabled={selectedTechnologies.length === 0 || preparing}
              className={`flex-1 font-bold py-2 px-4 rounded-lg transition ${
                selectedTechnologies.length === 0 || preparing
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-primary hover:bg-secondary text-white'
              }`}
            >
              {preparing ? 'Preparing your questions…' : 'Start Interview'}
            </button>
          </div>
        </div>
      )}

      {isLoggedIn && currentStep === 'interview' && (
        <div className="max-w-4xl w-full bg-white/95 backdrop-blur rounded-2xl shadow-2xl p-6 relative border border-white/20">
          <button
            onClick={handleLogout}
            className="absolute top-4 right-4 flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition text-sm z-10"
          >
            <FaSignOutAlt /> Logout
          </button>
          <div className="mb-4 pb-4 border-b">
            <h2 className="text-sm font-semibold text-gray-600 mb-2">Technologies: {selectedTechnologies.map(t => TECHNOLOGY_OPTIONS.find(opt => opt.id === t)?.label).join(', ')}</h2>
          </div>
          <div className="flex flex-col md:flex-row gap-6">
            <div className="md:w-1/2">
              <h2 className="text-xl font-semibold text-gray-700 mb-2">Question {currentQuestionIndex + 1}/{interviewQuestions.length}</h2>
              <p className="text-lg mb-4">{interviewQuestions[currentQuestionIndex]?.text}</p>
              <div className="bg-gray-100 p-4 rounded-lg mb-4">
                <h3 className="font-medium text-gray-700 mb-2">Category: {interviewQuestions[currentQuestionIndex]?.category}</h3>
                <p className="text-gray-600 text-sm">Speak your complete answer. If no response in 5 seconds, we'll skip to the next question.</p>
              </div>

              {/* Status Display */}
              <div className="mb-6 p-4 rounded-lg bg-blue-50 border-2 border-blue-200">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${
                      status === 'listening' ? 'bg-red-500 animate-pulse' :
                      status === 'processing' ? 'bg-yellow-500 animate-pulse' :
                      status === 'timeout' ? 'bg-orange-500' :
                      status === 'speaking' ? 'bg-blue-500 animate-pulse' :
                      'bg-gray-400'
                    }`}></div>
                    <span className="font-semibold text-gray-700">
                      {status === 'speaking' && 'Question Reading...'}
                      {status === 'listening' && 'Listening...'}
                      {status === 'processing' && 'Processing Answer...'}
                      {status === 'timeout' && 'No response - Moving to next...'}
                      {status === 'idle' && 'Ready'}
                    </span>
                  </div>
                </div>
                
                {/* Answer Transcript */}
                {currentAnswer && (
                  <div className="bg-white p-3 rounded border border-gray-300">
                    <p className="text-sm text-gray-600 mb-1">Your Answer:</p>
                    <p className="text-gray-800">{currentAnswer}</p>
                  </div>
                )}

                {/* Per-answer instant feedback (local heuristic + optional AI feedback) */}
                {(() => {
                  const qId = interviewQuestions[currentQuestionIndex]?.id
                  const fb = perAnswerFeedback.find(f => f.questionId === qId)
                  if (!fb) return null
                  return (
                    <div className="mt-3 p-3 border rounded bg-white">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm font-semibold">Instant feedback</div>
                        <div className="text-sm font-medium">{fb.localScore}/100</div>
                      </div>
                      <div className="text-xs text-gray-600 mb-2">
                        <div>Relevance: {fb.relevance}%</div>
                        <div>WPM: {fb.wpm}</div>
                        <div>Fillers: {fb.fillerCount}</div>
                      </div>
                      <ul className="text-sm list-disc pl-5">
                        {fb.suggestions.map((s: string, i: number) => <li key={i}>{s}</li>)}
                      </ul>
                      {fb.serverFeedback && (
                        <div className="mt-2 bg-gray-50 p-2 rounded border text-xs">
                          <div className="font-semibold">AI suggestions:</div>
                          <div>{fb.serverFeedback.analysis}</div>
                        </div>
                      )}
                    </div>
                  )
                })() }
              </div>

              {/* Microphone indicator */}
              <div className="flex items-center justify-center gap-3 p-4 bg-gray-50 rounded-lg">
                {isListening && (
                  <>
                    <div className="flex gap-1">
                      <div className="w-1 h-8 bg-red-500 rounded animate-pulse"></div>
                      <div className="w-1 h-6 bg-red-500 rounded animate-pulse" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-1 h-8 bg-red-500 rounded animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                      <div className="w-1 h-6 bg-red-500 rounded animate-pulse" style={{ animationDelay: '0.3s' }}></div>
                    </div>
                    <span className="text-red-500 font-semibold">Microphone Active</span>
                  </>
                )}
                {!isListening && status !== 'idle' && (
                  <span className="text-gray-500">Processing...</span>
                )}
              </div>

              {/* Speech Recognition Error Display */}
              {speechRecognitionError && (
                <div className="mt-3 p-4 rounded bg-red-50 border border-red-200 text-red-700 text-sm">
                  <div className="font-semibold mb-2"> Speech Recognition Error</div>
                  <div className="text-xs text-gray-600 mb-3">
                    <p className="mb-2">{speechRecognitionError}</p>
                    <div className="font-semibold mb-2">Troubleshooting steps:</div>
                    <ul className="list-disc pl-4 space-y-1">
                      <li>Allow microphone permission when prompted by your browser</li>
                      <li>Check that your microphone is connected and working</li>
                      <li>Try refreshing the page</li>
                      <li>Use Chrome, Edge, or Safari browser</li>
                      <li>Ensure you're accessing the site over HTTPS (or localhost)</li>
                    </ul>
                  </div>
                  <button
                    onClick={async () => {
                      setSpeechRecognitionError(null)
                      await checkMicrophonePermission()
                      await startSpeechRecognition()
                    }}
                    className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-xs"
                  >
                    Retry Recognition
                  </button>
                </div>
              )}

              {/* Browser Support Warning */}
              {!speechRecognitionSupported && !speechRecognitionError && (
                <div className="mt-3 p-4 rounded bg-yellow-50 border border-yellow-200 text-yellow-700 text-sm">
                  <div className="font-semibold mb-2"> Speech Recognition Not Supported</div>
                  <div className="text-xs">
                    Your browser doesn't support speech recognition. Please use:
                    <ul className="list-disc pl-4 mt-1">
                      <li>Google Chrome</li>
                      <li>Microsoft Edge</li>
                      <li>Apple Safari</li>
                    </ul>
                  </div>
                </div>
              )}

            </div>
            <div className="md:w-1/2">
              <div className="border-2 border-gray-200 rounded-lg overflow-hidden">
                <CameraView camRef={webcamRef} deviceId={camId} onError={onCamError} onReady={onCamReady} />
              </div>
              <MicMeter stream={micStream} />
              <DevicePicker camId={camId} micId={micId} onCam={setCamId} onMic={setMicId} reloadKey={camReady} />
              {webcamError && (
                <div className="mt-3 p-4 rounded bg-red-50 border border-red-200 text-red-700 text-sm">
                  <div className="font-semibold mb-2">{webcamError}</div>
                  <div className="text-xs text-gray-600 mb-3">
                    <p className="mb-2"><strong>Troubleshooting steps:</strong></p>
                    <ul className="list-disc pl-4 space-y-1">
                      <li>Close any apps using your camera (Teams, Zoom, Discord, VS Code extensions, etc.)</li>
                      <li>Close other browser tabs that might be using the camera</li>
                      <li>Check that your camera is physically connected and enabled</li>
                      <li>Restart your browser completely</li>
                    </ul>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={requestCameraPermission}
                      className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm"
                    >
                      Retry
                    </button>
                    <button
                      onClick={() => window.location.reload()}
                      className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm"
                    >
                      Reload Browser
                    </button>
                  </div>
                </div>
              )}

              {/* Microphone Permission Request */}
              {speechRecognitionSupported && !microphonePermissionGranted && !speechRecognitionError && (
                <div className="mt-3 p-4 rounded bg-blue-50 border border-blue-200 text-blue-700 text-sm">
                  <div className="font-semibold mb-2"> Microphone Access Required</div>
                  <div className="text-xs text-gray-600 mb-3">
                    <p className="mb-2">Speech recognition requires microphone access to work.</p>
                    <p>Click the button below to grant microphone permission.</p>
                  </div>
                  <button
                    onClick={async () => {
                      const hasPermission = await checkMicrophonePermission()
                      if (hasPermission) {
                        await startSpeechRecognition()
                      }
                    }}
                    className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm"
                  >
                    Allow Microphone Access
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {isLoggedIn && currentStep === 'feedback' && feedback && (
        <div className="max-w-2xl w-full bg-white/95 backdrop-blur rounded-2xl shadow-2xl p-8 relative border border-white/20">
          <button
            onClick={handleLogout}
            className="absolute top-4 right-4 flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition text-sm"
          >
            <FaSignOutAlt /> Logout
          </button>
          <div className="flex justify-center mb-4">
            <div className="text-5xl text-blue-600"><FaRobot /></div>
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-6">Interview Feedback</h1>
          
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-2">Overall Score</h2>
            <div className="w-full bg-gray-200 rounded-full h-6 mb-2">
              <div 
                className={`h-6 rounded-full ${feedback.score > 70 ? 'bg-green-500' : feedback.score > 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                style={{ width: `${feedback.score}%` }}
              ></div>
            </div>
            <p className="text-right font-medium">{feedback.score}/100</p>
          </div>

          {feedback.rubric && (
            <div className="mb-8">
              <h2 className="text-xl font-semibold mb-2">Rubric</h2>
              <RubricBars rubric={feedback.rubric} />
            </div>
          )}

          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-2">Analysis</h2>
            <p className="text-gray-700">{feedback.analysis}</p>
          </div>

          {feedback.strengths && feedback.strengths.length > 0 && (
            <div className="mb-8">
              <h2 className="text-xl font-semibold mb-2">Strengths</h2>
              <ul className="list-disc pl-5 space-y-2">
                {feedback.strengths.map((s, i) => <li key={i} className="text-gray-700">{s}</li>)}
              </ul>
            </div>
          )}

          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-2">Suggestions for Improvement</h2>
            <ul className="list-disc pl-5 space-y-2">
              {feedback.suggestions.map((suggestion, index) => (
                <li key={index} className="text-gray-700">{suggestion}</li>
              ))}
            </ul>
          </div>

          <button
            onClick={restartInterview}
            className="w-full bg-primary hover:bg-secondary text-white font-bold py-3 px-4 rounded-lg transition duration-200 flex items-center justify-center gap-2"
          >
            <FaRedo /> Practice Again
          </button>
        </div>
      )}

      {showHistory && (
        <Dashboard apiUrl={API_URL} headers={getAuthHeaders} onClose={() => setShowHistory(false)} onAccountDeleted={() => { setShowHistory(false); handleLogout() }} />
      )}
      {isLoggedIn && consentNeeded && <ConsentModal onAccept={acceptConsent} onDecline={() => { setConsentNeeded(false); handleLogout() }} />}
      </>
      )}
      </div>
    </div>
  )
}

export default App