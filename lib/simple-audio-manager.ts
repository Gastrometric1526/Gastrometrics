// Sonido de notificación sintetizado con Web Audio API — antes este módulo cargaba un
// mp3 externo desde blob.vercel-storage.com (almacenamiento temporal de v0.dev), que ya
// no resuelve y generaba errores de red en cada notificación ("An unknown error occurred
// when fetching the script"). Sintetizar el tono localmente elimina esa dependencia externa
// y hace que el sonido funcione de forma consistente sin depender de la red.
class SimpleAudioManager {
  private static instance: SimpleAudioManager
  private audioContext: AudioContext | null = null
  private volume = 0.4
  private isPlaying = false

  private constructor() {}

  static getInstance(): SimpleAudioManager {
    if (!SimpleAudioManager.instance) {
      SimpleAudioManager.instance = new SimpleAudioManager()
    }
    return SimpleAudioManager.instance
  }

  private getContext(): AudioContext | null {
    if (typeof window === "undefined") return null
    if (!this.audioContext) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
      if (!AudioContextClass) return null
      this.audioContext = new AudioContextClass()
    }
    return this.audioContext
  }

  async playNotificationSound(): Promise<void> {
    if (this.isPlaying) return

    const ctx = this.getContext()
    if (!ctx) return

    try {
      if (ctx.state === "suspended") {
        await ctx.resume()
      }

      this.isPlaying = true

      // Dos tonos cortos ascendentes, como un "ding" de notificación.
      const now = ctx.currentTime
      ;[880, 1318.5].forEach((frequency, i) => {
        const oscillator = ctx.createOscillator()
        const gain = ctx.createGain()
        oscillator.type = "sine"
        oscillator.frequency.value = frequency

        const start = now + i * 0.09
        const end = start + 0.15
        gain.gain.setValueAtTime(0, start)
        gain.gain.linearRampToValueAtTime(this.volume, start + 0.01)
        gain.gain.exponentialRampToValueAtTime(0.001, end)

        oscillator.connect(gain)
        gain.connect(ctx.destination)
        oscillator.start(start)
        oscillator.stop(end)
      })

      setTimeout(() => {
        this.isPlaying = false
      }, 300)
    } catch (error) {
      this.isPlaying = false
      console.warn("🔊 No se pudo reproducir el sonido de notificación:", error)
    }
  }

  async testAudio(): Promise<boolean> {
    try {
      await this.playNotificationSound()
      return true
    } catch (error) {
      console.warn("🔊 Prueba de audio fallida:", error)
      return false
    }
  }

  getStatus(): { ready: boolean; playing: boolean; hasAudio: boolean } {
    return {
      ready: this.getContext() !== null,
      playing: this.isPlaying,
      hasAudio: this.audioContext !== null,
    }
  }

  cleanup(): void {
    if (this.audioContext) {
      this.audioContext.close()
      this.audioContext = null
    }
    this.isPlaying = false
  }
}

export const simpleAudioManager = SimpleAudioManager.getInstance()
