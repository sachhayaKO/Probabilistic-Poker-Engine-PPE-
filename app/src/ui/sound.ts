const audioContext = typeof window !== 'undefined' ? new (window.AudioContext || (window as any).webkitAudioContext)() : null

function tone(frequency: number, duration: number): void {
  if (!audioContext) return

  const oscillator = audioContext.createOscillator()
  const gain = audioContext.createGain()

  oscillator.connect(gain)
  gain.connect(audioContext.destination)

  oscillator.frequency.value = frequency
  oscillator.type = 'sine'

  const now = audioContext.currentTime
  gain.gain.setValueAtTime(0.3, now)
  gain.gain.exponentialRampToValueAtTime(0.01, now + duration)

  oscillator.start(now)
  oscillator.stop(now + duration)
}

export function playCardFlip(): void {
  tone(523, 0.1)
  setTimeout(() => tone(784, 0.1), 100)
}

export function playChipPlace(): void {
  tone(784, 0.2)
}

export function playWin(): void {
  tone(784, 0.25)
  setTimeout(() => tone(1047, 0.25), 150)
}
