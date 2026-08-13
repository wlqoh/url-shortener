interface SaveResponse {
  status: 'OK' | 'Error'
  alias?: string
  error?: string
}

export type ShortenErrorKind =
  | 'invalid_url'
  | 'network'
  | 'auth'
  | 'alias_taken'
  | 'validation'
  | 'server'
  | 'unreadable'

export type ShortenResult =
  | { ok: true; short: string }
  | { ok: false; kind: ShortenErrorKind; message: string }

const SHORT_ORIGIN = import.meta.env.VITE_BACKEND_ORIGIN || window.location.origin

export function validateUrl(value: string): boolean {
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

export async function shortenUrl(url: string): Promise<ShortenResult> {
  if (!validateUrl(url)) {
    return { ok: false, kind: 'invalid_url', message: 'Это не похоже на ссылку — проверьте адрес.' }
  }

  let response: Response
  try {
    response = await fetch('/url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    })
  } catch {
    return { ok: false, kind: 'network', message: 'Горн недоступен — нет связи с сервером.' }
  }

  const text = await response.text()

  let data: SaveResponse | null = null
  try {
    data = JSON.parse(text) as SaveResponse
  } catch {
    if (response.status === 401 || response.status === 403) {
      return { ok: false, kind: 'auth', message: 'Кузница закрыта: сервер недоступен или требует доступа.' }
    }
    if (response.status >= 500) {
      return { ok: false, kind: 'server', message: 'Горн перегрелся — ошибка сервера, попробуйте позже.' }
    }
    return { ok: false, kind: 'unreadable', message: 'Сервер ответил не тем, чего ждал горн.' }
  }

  if (data.status !== 'OK' || !data.alias) {
    const error = data.error ?? ''

    if (error.includes('already exists')) {
      return { ok: false, kind: 'alias_taken', message: 'Такая ссылка уже выкована.' }
    }
    if (error.includes('valid URL') || error.includes('required')) {
      return { ok: false, kind: 'validation', message: 'Адрес не прошёл проверку — попробуйте другую ссылку.' }
    }
    return { ok: false, kind: 'server', message: error || 'Не удалось выковать ссылку.' }
  }

  return { ok: true, short: `${SHORT_ORIGIN}/${data.alias}` }
}
