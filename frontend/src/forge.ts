interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  size: number
  hue: number
  bright: boolean
}

const AMBIENT_SPAWN_CHANCE = 0.35
const BRIGHT_POP_CHANCE = 0.06

function computeMaxParticles(): number {
  const area = window.innerWidth * window.innerHeight
  const areaFactor = Math.min(1, area / (1440 * 900))

  const deviceMemory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8
  const cores = navigator.hardwareConcurrency ?? 4

  let cap = 160
  if (window.innerWidth < 640) cap = 70
  if (deviceMemory <= 4 || cores <= 2) cap = Math.round(cap * 0.5)

  return Math.max(24, Math.round(cap * (0.5 + 0.5 * areaFactor)))
}

export class ForgeFX {
  private ctx: CanvasRenderingContext2D
  private particles: Particle[] = []
  private width = 0
  private height = 0
  private dpr = Math.min(window.devicePixelRatio || 1, 2)
  private rafId: number | null = null
  private running = false
  private originX = 0
  private originY = 0
  private originSpread = 0
  private maxParticles = computeMaxParticles()

  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('2d context unavailable')
    this.ctx = ctx

    this.resize()
    window.addEventListener('resize', () => {
      this.resize()
      this.maxParticles = computeMaxParticles()
    })
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.stop()
      } else {
        this.start()
      }
    })
  }

  setOrigin(rect: DOMRect): void {
    this.originX = rect.left + rect.width / 2
    this.originY = rect.top + rect.height / 2
    this.originSpread = rect.width / 2
  }

  private resize(): void {
    this.width = window.innerWidth
    this.height = window.innerHeight
    this.canvas.width = this.width * this.dpr
    this.canvas.height = this.height * this.dpr
    this.canvas.style.width = `${this.width}px`
    this.canvas.style.height = `${this.height}px`
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
  }

  private spawn(x: number, y: number, spread: number, intensity: number): void {
    if (this.particles.length >= this.maxParticles) return

    const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.1
    const speed = 0.6 + Math.random() * 1.8 * intensity
    const bright = Math.random() < BRIGHT_POP_CHANCE

    this.particles.push({
      x: x + (Math.random() - 0.5) * spread,
      y,
      vx: Math.cos(angle) * speed * 0.4,
      vy: Math.sin(angle) * speed,
      life: 0,
      maxLife: 60 + Math.random() * 70,
      size: (bright ? 1.6 : 1) + Math.random() * 2.4,
      hue: bright ? 48 : 12 + Math.random() * 26,
      bright,
    })
  }

  burst(rect: DOMRect, count = 90): void {
    this.setOrigin(rect)
    for (let i = 0; i < count; i++) {
      this.spawn(this.originX, this.originY + rect.height * 0.25, rect.width * 0.8, 1.6)
    }
  }

  private ambientTick(): void {
    if (this.originSpread === 0) return
    if (Math.random() < AMBIENT_SPAWN_CHANCE) {
      this.spawn(this.originX, this.originY + 20, this.originSpread * 1.6, 0.7)
    }
  }

  private drawEmberGlow(): void {
    if (this.originSpread === 0) return

    const t = 0.5 + 0.5 * Math.sin(Date.now() / 1400)
    const radius = this.originSpread * (1.4 + 0.15 * t)
    const alpha = 0.10 + 0.05 * t

    const gradient = this.ctx.createRadialGradient(
      this.originX,
      this.originY + 10,
      0,
      this.originX,
      this.originY + 10,
      radius,
    )
    gradient.addColorStop(0, `rgba(255, 140, 40, ${alpha})`)
    gradient.addColorStop(1, 'rgba(255, 100, 20, 0)')

    this.ctx.fillStyle = gradient
    this.ctx.fillRect(0, 0, this.width, this.height)
  }

  private step(): void {
    this.ctx.clearRect(0, 0, this.width, this.height)

    this.ctx.globalCompositeOperation = 'lighter'
    this.drawEmberGlow()

    this.ambientTick()

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]
      p.life++
      p.x += p.vx
      p.y += p.vy
      p.vy += 0.012
      p.vx *= 0.985

      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1)
        continue
      }

      const t = p.life / p.maxLife
      const alpha = t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85
      const flicker = 0.75 + Math.random() * 0.25
      const radius = p.size * (1 - t * 0.4)
      const hue = p.bright ? p.hue : p.hue + t * 8

      const gradient = this.ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius * 4)
      gradient.addColorStop(0, `hsla(${hue}, 100%, ${p.bright ? 92 : 85}%, ${alpha * flicker})`)
      gradient.addColorStop(0.4, `hsla(${hue}, 100%, 60%, ${alpha * flicker * 0.6})`)
      gradient.addColorStop(1, `hsla(${hue}, 100%, 45%, 0)`)

      this.ctx.fillStyle = gradient
      this.ctx.beginPath()
      this.ctx.arc(p.x, p.y, radius * 4, 0, Math.PI * 2)
      this.ctx.fill()
    }

    this.ctx.globalCompositeOperation = 'source-over'

    if (this.running) {
      this.rafId = requestAnimationFrame(() => this.step())
    }
  }

  start(): void {
    if (this.running) return
    this.running = true
    this.step()
  }

  stop(): void {
    this.running = false
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
  }

  destroy(): void {
    this.stop()
    this.particles = []
  }
}
