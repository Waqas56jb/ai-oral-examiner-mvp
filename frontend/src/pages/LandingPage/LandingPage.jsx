import Header from '../../components/layout/Header/Header'
import Footer from '../../components/layout/Footer/Footer'

import Hero from '../../components/sections/Hero/Hero'
import TrustBar from '../../components/sections/TrustBar/TrustBar'
import Features from '../../components/sections/Features/Features'
import HowItWorks from '../../components/sections/HowItWorks/HowItWorks'
import ExamTypes from '../../components/sections/ExamTypes/ExamTypes'
import VoiceDemo from '../../components/sections/VoiceDemo/VoiceDemo'
import Stats from '../../components/sections/Stats/Stats'
import Benefits from '../../components/sections/Benefits/Benefits'
import Testimonials from '../../components/sections/Testimonials/Testimonials'
import Pricing from '../../components/sections/Pricing/Pricing'
import FAQ from '../../components/sections/FAQ/FAQ'
import CTA from '../../components/sections/CTA/CTA'

import BackToTop from '../../components/common/BackToTop/BackToTop'

export default function LandingPage() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <TrustBar />
        <Features />
        <HowItWorks />
        <ExamTypes />
        <VoiceDemo />
        <Stats />
        <Benefits />
        <Testimonials />
        <Pricing />
        <FAQ />
        <CTA />
      </main>
      <Footer />
      <BackToTop />
    </>
  )
}
