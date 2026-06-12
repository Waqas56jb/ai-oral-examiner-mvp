import { FiUserCheck, FiMessageSquare, FiActivity, FiAward } from 'react-icons/fi'

export const steps = [
  {
    icon: FiUserCheck,
    number: '01',
    title: 'Choose your case',
    text: 'Pick your exam pathway and the clinical case you want to rehearse. Your candidate details load automatically.',
  },
  {
    icon: FiMessageSquare,
    number: '02',
    title: 'Speak with your examiner',
    text: 'Press start and begin a live, spoken consultation. The AI examiner asks, probes and follows up in real time.',
  },
  {
    icon: FiActivity,
    number: '03',
    title: 'Get your transcript',
    text: 'When the timer ends, a full transcript of the conversation is generated instantly for review.',
  },
  {
    icon: FiAward,
    number: '04',
    title: 'Receive your feedback',
    text: 'A structured report scores your performance and highlights exactly where to focus before exam day.',
  },
]
