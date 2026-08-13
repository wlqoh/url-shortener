const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches
const FORGE_DURATION_MS = 1300

export function triggerForge(titleEl: HTMLElement): void {
  if (REDUCED_MOTION) return

  titleEl.classList.remove('is-forging')
  void titleEl.offsetWidth
  titleEl.classList.add('is-forging')

  window.setTimeout(() => {
    titleEl.classList.remove('is-forging')
  }, FORGE_DURATION_MS)
}

export function isReducedMotion(): boolean {
  return REDUCED_MOTION
}
