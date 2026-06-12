import {
  FiMic,
  FiZap,
  FiFileText,
  FiBarChart2,
  FiShield,
  FiSmartphone,
} from 'react-icons/fi'

export const features = [
  {
    icon: FiMic,
    title: 'Real-Time Voice Conversation',
    text: 'Speak naturally and your AI examiner replies instantly. Two-way, low-latency voice powered by WebRTC — just like sitting across from a real examiner.',
    accent: 'blue',
  },
  {
    icon: FiZap,
    title: 'Powered by OpenAI Realtime',
    text: 'Built on the OpenAI Realtime API for fluid, human-like spoken dialogue that listens, reasons and responds in the moment.',
    accent: 'teal',
  },
  {
    icon: FiFileText,
    title: 'Automatic Transcripts',
    text: 'Every session is captured word-for-word. The full transcript is generated the moment your exam ends — nothing to set up.',
    accent: 'blue',
  },
  {
    icon: FiBarChart2,
    title: 'Structured Feedback Reports',
    text: 'Receive a clear performance summary with strengths, gaps and actionable next steps — mapped to real exam marking criteria.',
    accent: 'gold',
  },
  {
    icon: FiShield,
    title: 'Secure by Design',
    text: 'API keys never touch the browser. All calls run through a hardened backend, so your data and credentials stay protected.',
    accent: 'teal',
  },
  {
    icon: FiSmartphone,
    title: 'Works Everywhere',
    text: 'Fully responsive and embeds seamlessly into Kajabi and Jotform via a single iframe. Practice on desktop, tablet or phone.',
    accent: 'blue',
  },
]
