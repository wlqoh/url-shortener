import './style.css'
import { ForgeFX } from './forge'
import { shortenUrl } from './shorten'
import { renderQr, clearQr } from './qr'
import { triggerForge, isReducedMotion } from './metal'

const titleEl = document.getElementById('title') as HTMLHeadingElement
const canvasEl = document.getElementById('forge-canvas') as HTMLCanvasElement
const formEl = document.getElementById('forge-form') as HTMLFormElement
const inputEl = document.getElementById('url-input') as HTMLInputElement
const buttonEl = document.getElementById('forge-button') as HTMLButtonElement
const resultEl = document.getElementById('result') as HTMLDivElement
const resultLinkEl = document.getElementById('result-link') as HTMLAnchorElement
const copyButtonEl = document.getElementById('copy-button') as HTMLButtonElement
const qrPanelEl = document.getElementById('qr-panel') as HTMLDivElement
const errorEl = document.getElementById('error-text') as HTMLParagraphElement

let fx: ForgeFX | null = null

if (!isReducedMotion()) {
  try {
    fx = new ForgeFX(canvasEl)
    fx.start()
    const rect = titleEl.getBoundingClientRect()
    fx.burst(rect, 110)
  } catch {
    fx = null
  }
}

function hideResult(): void {
  resultEl.hidden = true
  resultLinkEl.textContent = ''
  resultLinkEl.removeAttribute('href')
  clearQr(qrPanelEl)
}

function showError(message: string): void {
  errorEl.hidden = false
  errorEl.textContent = message
}

function hideError(): void {
  errorEl.hidden = true
  errorEl.textContent = ''
}

async function showResult(short: string): Promise<void> {
  resultEl.hidden = false
  resultLinkEl.textContent = short
  resultLinkEl.href = short
  await renderQr(qrPanelEl, short)
}

async function handleCopy(): Promise<void> {
  const text = resultLinkEl.textContent
  if (!text) return

  try {
    await navigator.clipboard.writeText(text)
    const original = copyButtonEl.textContent
    copyButtonEl.textContent = 'Скопировано!'
    setTimeout(() => {
      copyButtonEl.textContent = original
    }, 1500)
  } catch {
    showError('Не удалось скопировать — скопируйте ссылку вручную.')
  }
}

async function handleSubmit(event: SubmitEvent): Promise<void> {
  event.preventDefault()

  const url = inputEl.value.trim()
  if (!url) return

  hideError()
  hideResult()

  buttonEl.disabled = true
  const originalLabel = buttonEl.textContent
  buttonEl.textContent = 'Куётся…'

  triggerForge(titleEl)
  if (fx) {
    fx.burst(titleEl.getBoundingClientRect(), 70)
  }

  const result = await shortenUrl(url)

  buttonEl.disabled = false
  buttonEl.textContent = originalLabel

  if (result.ok) {
    await showResult(result.short)
  } else {
    showError(result.message)
  }
}

formEl.addEventListener('submit', (event) => {
  void handleSubmit(event)
})

copyButtonEl.addEventListener('click', () => {
  void handleCopy()
})
