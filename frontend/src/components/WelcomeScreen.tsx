import { useEffect, useState } from "react"

interface WelcomeScreenProps {
  onStart: () => void
}

export function WelcomeScreen({ onStart }: WelcomeScreenProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50)
    return () => clearTimeout(t)
  }, [])

  return (
    <div
      className={`min-h-screen bg-black flex flex-col items-center justify-center cursor-pointer transition-opacity duration-700 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
      onClick={onStart}
    >
      <div className="text-center space-y-8">
        {/* Pulsing suit icon */}
        <div className="relative inline-flex items-center justify-center mx-auto">
          <div className="absolute w-24 h-24 rounded-full bg-red-500/20 animate-ping" />
          <div className="relative w-20 h-20 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
            <span className="text-5xl text-red-500 select-none">♠</span>
          </div>
        </div>

        <div className="space-y-3">
          <h1 className="text-4xl font-bold text-slate-100 tracking-tight">
            Probabilistic Poker Engine
          </h1>
          <p className="text-slate-400 font-mono text-sm">
            Heads-Up Texas Hold'em · ML Research Platform
          </p>
        </div>
      </div>

      <p className="absolute bottom-12 text-slate-600 font-mono text-sm animate-pulse select-none">
        Click anywhere to begin
      </p>
    </div>
  )
}
