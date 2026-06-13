import {
  FiGrid,
  FiHelpCircle,
  FiUsers,
  FiClipboard,
  FiFileText,
  FiBarChart2,
  FiCpu,
  FiSettings,
} from 'react-icons/fi'

export const navGroups = [
  {
    label: 'Overview',
    items: [{ to: '/', label: 'Dashboard', icon: FiGrid, end: true }],
  },
  {
    label: 'Manage',
    items: [
      { to: '/questions', label: 'Questions', icon: FiHelpCircle },
      { to: '/candidates', label: 'Candidates', icon: FiUsers },
      { to: '/sessions', label: 'Exam Sessions', icon: FiClipboard },
      { to: '/transcripts', label: 'Transcripts', icon: FiFileText },
    ],
  },
  {
    label: 'Insights',
    items: [{ to: '/analytics', label: 'Analytics', icon: FiBarChart2 }],
  },
  {
    label: 'System',
    items: [
      { to: '/ai-config', label: 'AI Configuration', icon: FiCpu },
      { to: '/settings', label: 'Settings', icon: FiSettings },
    ],
  },
]

export const pageMeta = {
  '/': { title: 'Dashboard', sub: 'Overview of your platform' },
  '/questions': { title: 'Question Bank', sub: 'Manage clinical exam questions' },
  '/candidates': { title: 'Candidates', sub: 'Registered users & performance' },
  '/sessions': { title: 'Exam Sessions', sub: 'Completed & live AI sessions' },
  '/transcripts': { title: 'Transcripts', sub: 'Session conversation records' },
  '/analytics': { title: 'Analytics', sub: 'Trends & performance metrics' },
  '/ai-config': { title: 'AI Configuration', sub: 'Examiner prompt & voice settings' },
  '/settings': { title: 'Settings', sub: 'Integrations & platform controls' },
}
