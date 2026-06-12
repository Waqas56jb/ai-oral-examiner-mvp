import Preloader from './components/common/Preloader/Preloader'
import LandingPage from './pages/LandingPage/LandingPage'

export default function App() {
  return (
    <>
      {/* Brand preloader self-dismisses on first paint */}
      <Preloader duration={1400} />
      <LandingPage />
    </>
  )
}
