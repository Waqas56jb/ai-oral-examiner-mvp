import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ExamProvider } from './context/ExamContext'
import Welcome from './pages/Welcome'
import VoiceAgent from './pages/VoiceAgent'
import Report from './pages/Report'

export default function App() {
  return (
    <ExamProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Welcome />} />
          <Route path="/exam" element={<VoiceAgent />} />
          <Route path="/report" element={<Report />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ExamProvider>
  )
}
