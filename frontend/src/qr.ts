import QRCode from 'qrcode'

export async function renderQr(target: HTMLElement, text: string): Promise<void> {
  target.innerHTML = ''

  try {
    const canvas = document.createElement('canvas')
    await QRCode.toCanvas(canvas, text, {
      width: 140,
      margin: 1,
      color: {
        dark: '#1a1712',
        light: '#eae7e2',
      },
    })
    target.appendChild(canvas)
  } catch {
    // QR — не критичная функция, тихо пропускаем сбой
  }
}

export function clearQr(target: HTMLElement): void {
  target.innerHTML = ''
}
