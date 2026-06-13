import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { PageLoader } from './components/ui'
import Layout from './components/Layout'
import Login from './pages/Login'
import ResetPassword from './pages/ResetPassword'
import Dashboard from './pages/Dashboard'
import Questions from './pages/Questions'
import Candidates from './pages/Candidates'
import Sessions from './pages/Sessions'
import Transcripts from './pages/Transcripts'
import Analytics from './pages/Analytics'
import AIConfig from './pages/AIConfig'
import Settings from './pages/Settings'

function Protected({ children }) {
  const { session, admin, loading } = useAuth()
  if (loading) return <PageLoader />
  if (!session || !admin) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  const { session, admin, loading } = useAuth()

  return (
    <Routes>
      <Route
        path="/login"
        element={!loading && session && admin ? <Navigate to="/" replace /> : <Login />}
      />
      <Route path="/reset-password" element={<ResetPassword />} />

      <Route
        path="/"
        element={
          <Protected>
            <Layout />
          </Protected>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="questions" element={<Questions />} />
        <Route path="candidates" element={<Candidates />} />
        <Route path="sessions" element={<Sessions />} />
        <Route path="transcripts" element={<Transcripts />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="ai-config" element={<AIConfig />} />
        <Route path="settings" element={<Settings />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
