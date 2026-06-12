import { createContext, useContext, useState } from 'react'

const ExamContext = createContext(null)

export function ExamProvider({ children }) {
  const [sessionData, setSessionData] = useState(null)

  return (
    <ExamContext.Provider value={{ sessionData, setSessionData }}>
      {children}
    </ExamContext.Provider>
  )
}

export function useExam() {
  return useContext(ExamContext)
}
