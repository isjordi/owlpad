import { useEffect, useState } from 'react'
import { useOwlPadStore } from './state/store'
import Onboarding from './pages/Onboarding'
import LockScreen from './pages/LockScreen'
import AppShell from './pages/AppShell'

export default function App() {
  const { config, setConfig, unlocked, theme, font } = useOwlPadStore()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    window.owlpad.getConfig().then((c) => {
      setConfig(c)
      setLoading(false)
    })
  }, [setConfig])

  useEffect(() => {
    document.documentElement.className = `theme-${theme} font-${font}`
  }, [theme, font])

  if (loading) {
    return <div className="h-screen w-screen bg-[var(--owl-bg)]" />
  }

  if (!config?.vaultPath || !config?.hasPin) {
    return <Onboarding />
  }

  if (!unlocked) {
    return <LockScreen />
  }

  return <AppShell />
}
