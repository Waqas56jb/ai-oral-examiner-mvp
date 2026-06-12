import { createContext, useContext, useState, useCallback } from 'react'

const STORAGE_KEY = 'pgp_session_data'
const EXAM_KEY    = 'pgp_exam_progress'

const ExamContext = createContext(null)

function loadFromStorage(key) {
  try {
    const raw = sessionStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function saveToStorage(key, value) {
  try {
    if (value === null) sessionStorage.removeItem(key)
    else sessionStorage.setItem(key, JSON.stringify(value))
  } catch { /* storage full or unavailable */ }
}

export function ExamProvider({ children }) {
  const [sessionData, _setSessionData] = useState(() => loadFromStorage(STORAGE_KEY))
  const [examProgress, _setExamProgress] = useState(() => loadFromStorage(EXAM_KEY))

  const setSessionData = useCallback((data) => {
    _setSessionData(data)
    saveToStorage(STORAGE_KEY, data)
    // Clear progress once a full session is saved
    if (data) saveToStorage(EXAM_KEY, null)
  }, [])

  const setExamProgress = useCallback((progress) => {
    _setExamProgress(progress)
    saveToStorage(EXAM_KEY, progress)
  }, [])

  const clearSession = useCallback(() => {
    _setSessionData(null)
    _setExamProgress(null)
    saveToStorage(STORAGE_KEY, null)
    saveToStorage(EXAM_KEY, null)
  }, [])

  return (
    <ExamContext.Provider value={{
      sessionData,
      setSessionData,
      examProgress,
      setExamProgress,
      clearSession,
    }}>
      {children}
    </ExamContext.Provider>
  )
}

export function useExam() {
  return useContext(ExamContext)
}
