import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// StrictMode is intentionally off: in development it mounts everything twice, which opens
// the camera and microphone twice and causes "camera in use" / stuck-start problems.
ReactDOM.createRoot(document.getElementById('root')!).render(<App />)
