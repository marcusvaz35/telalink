import { useEffect, useRef } from 'react'

/** Página da janela invisível que alimenta o Spout (Windows): desenha cada quadro recebido num canvas. */
export function SpoutOutApp(): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const off = window.telalink.onTextureFrameIn((data, width, height) => {
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width
        canvas.height = height
      }
      const pixels = new Uint8ClampedArray(data.byteLength)
      pixels.set(data)
      ctx.putImageData(new ImageData(pixels, width, height), 0, 0)
    })
    return () => {
      off()
    }
  }, [])

  return <canvas ref={canvasRef} style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', background: '#000' }} />
}
