import React, { useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react'

export type Tool = 'pen' | 'eraser' | 'fill'

export interface Layer {
  id: string
  name: string
  opacity: number
  visible: boolean
}

interface CanvasProps {
  width: number
  height: number
  tool: Tool
  color: string
  brushSize: number
  pressureEnabled: boolean
  onDraw: () => void
  interactive?: boolean
  layers: Layer[]
  activeLayerId: string
}

export interface CanvasHandle {
  undo: () => void
  redo: () => void
  clear: () => void
  toDataURL: () => string
  loadImage: (dataUrl: string) => void
  getContext: () => CanvasRenderingContext2D | null
  getLayerDataURLs: () => Map<string, string>
  loadLayerImages: (images: Map<string, string>) => void
  purgeLayerHistory: (layerId: string) => void
}

interface HistoryEntry {
  layerId: string
  imageData: ImageData
}

const Canvas = forwardRef<CanvasHandle, CanvasProps>(
  ({ width, height, tool, color, brushSize, pressureEnabled, onDraw, interactive = true, layers, activeLayerId }, ref) => {
    const displayCanvasRef = useRef<HTMLCanvasElement>(null)
    const layerCanvasesRef = useRef<Map<string, HTMLCanvasElement>>(new Map())
    const isDrawing = useRef(false)
    const lastPos = useRef<{ x: number; y: number } | null>(null)
    const historyRef = useRef<HistoryEntry[]>([])
    const historyIndexRef = useRef(-1)
    const maxHistory = 50
    const beforeStateRef = useRef<ImageData | null>(null)

    const getDisplayCtx = useCallback(() => {
      return displayCanvasRef.current?.getContext('2d', { willReadFrequently: true }) ?? null
    }, [])

    const getLayerCanvas = useCallback((layerId: string): HTMLCanvasElement | undefined => {
      return layerCanvasesRef.current.get(layerId)
    }, [])

    const getLayerCtx = useCallback((layerId: string): CanvasRenderingContext2D | null => {
      const canvas = getLayerCanvas(layerId)
      return canvas?.getContext('2d', { willReadFrequently: true }) ?? null
    }, [getLayerCanvas])

    const getActiveCtx = useCallback((): CanvasRenderingContext2D | null => {
      return getLayerCtx(activeLayerId)
    }, [getLayerCtx, activeLayerId])

    // Composite all layers onto the display canvas
    const composite = useCallback(() => {
      const displayCtx = getDisplayCtx()
      if (!displayCtx) return

      // White background
      displayCtx.globalAlpha = 1
      displayCtx.globalCompositeOperation = 'source-over'
      displayCtx.fillStyle = '#ffffff'
      displayCtx.fillRect(0, 0, width, height)

      // Draw layers bottom to top (layers array is top-first, so iterate in reverse)
      for (let i = layers.length - 1; i >= 0; i--) {
        const layer = layers[i]
        if (!layer.visible) continue
        const layerCanvas = getLayerCanvas(layer.id)
        if (!layerCanvas) continue
        displayCtx.globalAlpha = layer.opacity
        displayCtx.drawImage(layerCanvas, 0, 0)
      }

      displayCtx.globalAlpha = 1
    }, [getDisplayCtx, getLayerCanvas, layers, width, height])

    // Sync offscreen canvases with layers prop
    useEffect(() => {
      const map = layerCanvasesRef.current
      const currentIds = new Set(layers.map((l) => l.id))

      // Remove deleted layers
      for (const [id] of map) {
        if (!currentIds.has(id)) {
          map.delete(id)
        }
      }

      // Add new layers
      for (const layer of layers) {
        if (!map.has(layer.id)) {
          const canvas = document.createElement('canvas')
          canvas.width = width
          canvas.height = height
          // New layer starts transparent (cleared)
          map.set(layer.id, canvas)
        }
      }

      composite()
    }, [layers, width, height, composite])

    // Re-composite whenever layer visibility/opacity changes
    useEffect(() => {
      composite()
    }, [composite])

    // Capture before-state for undo
    const captureBeforeState = useCallback(() => {
      const ctx = getActiveCtx()
      if (!ctx) return
      beforeStateRef.current = ctx.getImageData(0, 0, width, height)
    }, [getActiveCtx, width, height])

    // Commit action to history (swap-based)
    const commitAction = useCallback(() => {
      if (!beforeStateRef.current) return
      // Truncate any redo entries
      historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1)
      historyRef.current.push({
        layerId: activeLayerId,
        imageData: beforeStateRef.current
      })
      if (historyRef.current.length > maxHistory) {
        historyRef.current.shift()
      } else {
        historyIndexRef.current++
      }
      beforeStateRef.current = null
    }, [activeLayerId])

    const floodFill = useCallback(
      (startX: number, startY: number, fillColor: string) => {
        const ctx = getActiveCtx()
        if (!ctx) return

        captureBeforeState()

        const imageData = ctx.getImageData(0, 0, width, height)
        const data = imageData.data

        // Parse fill color
        const temp = document.createElement('canvas')
        const tempCtx = temp.getContext('2d')!
        tempCtx.fillStyle = fillColor
        tempCtx.fillRect(0, 0, 1, 1)
        const fillRgb = tempCtx.getImageData(0, 0, 1, 1).data

        const startIdx = (startY * width + startX) * 4
        const targetR = data[startIdx]
        const targetG = data[startIdx + 1]
        const targetB = data[startIdx + 2]
        const targetA = data[startIdx + 3]

        // Don't fill if same color
        if (
          targetR === fillRgb[0] &&
          targetG === fillRgb[1] &&
          targetB === fillRgb[2] &&
          targetA === 255
        ) {
          beforeStateRef.current = null
          return
        }

        const tolerance = 24
        const matchTarget = (idx: number) => {
          return (
            Math.abs(data[idx] - targetR) <= tolerance &&
            Math.abs(data[idx + 1] - targetG) <= tolerance &&
            Math.abs(data[idx + 2] - targetB) <= tolerance &&
            Math.abs(data[idx + 3] - targetA) <= tolerance
          )
        }

        const stack: [number, number][] = [[startX, startY]]
        const visited = new Uint8Array(width * height)

        while (stack.length > 0) {
          const [x, y] = stack.pop()!
          const pixelIdx = y * width + x

          if (x < 0 || x >= width || y < 0 || y >= height) continue
          if (visited[pixelIdx]) continue

          const dataIdx = pixelIdx * 4
          if (!matchTarget(dataIdx)) continue

          visited[pixelIdx] = 1
          data[dataIdx] = fillRgb[0]
          data[dataIdx + 1] = fillRgb[1]
          data[dataIdx + 2] = fillRgb[2]
          data[dataIdx + 3] = 255

          stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1])
        }

        // Edge expansion: blend fill color into anti-aliased fringe pixels (multi-pass)
        const expanded = new Uint8Array(visited)
        for (let pass = 0; pass < 3; pass++) {
          const newlyExpanded: number[] = []
          for (let py = 0; py < height; py++) {
            for (let px = 0; px < width; px++) {
              const idx = py * width + px
              if (expanded[idx]) continue

              const hasExpandedNeighbor =
                (px > 0 && expanded[idx - 1]) ||
                (px < width - 1 && expanded[idx + 1]) ||
                (py > 0 && expanded[idx - width]) ||
                (py < height - 1 && expanded[idx + width])
              if (!hasExpandedNeighbor) continue

              const di = idx * 4
              const maxDiff = Math.max(
                Math.abs(data[di] - targetR),
                Math.abs(data[di + 1] - targetG),
                Math.abs(data[di + 2] - targetB)
              )
              const bgFraction = Math.max(0, 1 - maxDiff / 255)
              if (bgFraction <= 0) continue

              data[di] = Math.round(Math.min(255, Math.max(0, data[di] + bgFraction * (fillRgb[0] - targetR))))
              data[di + 1] = Math.round(Math.min(255, Math.max(0, data[di + 1] + bgFraction * (fillRgb[1] - targetG))))
              data[di + 2] = Math.round(Math.min(255, Math.max(0, data[di + 2] + bgFraction * (fillRgb[2] - targetB))))
              data[di + 3] = 255
              newlyExpanded.push(idx)
            }
          }
          for (const idx of newlyExpanded) expanded[idx] = 1
        }

        ctx.putImageData(imageData, 0, 0)
        commitAction()
        composite()
        onDraw()
      },
      [getActiveCtx, width, height, captureBeforeState, commitAction, composite, onDraw]
    )

    const getCanvasPos = useCallback(
      (e: React.PointerEvent<HTMLCanvasElement>) => {
        const canvas = displayCanvasRef.current
        if (!canvas) return { x: 0, y: 0 }
        const rect = canvas.getBoundingClientRect()
        const scaleX = canvas.width / rect.width
        const scaleY = canvas.height / rect.height
        return {
          x: Math.floor((e.clientX - rect.left) * scaleX),
          y: Math.floor((e.clientY - rect.top) * scaleY)
        }
      },
      []
    )

    const drawLine = useCallback(
      (
        ctx: CanvasRenderingContext2D,
        x1: number,
        y1: number,
        x2: number,
        y2: number
      ) => {
        ctx.beginPath()
        ctx.moveTo(x1, y1)
        ctx.lineTo(x2, y2)
        ctx.stroke()
      },
      []
    )

    const handlePointerDown = useCallback(
      (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (e.button !== 0) return
        if (!interactive) return
        const canvas = displayCanvasRef.current
        if (canvas) {
          canvas.setPointerCapture(e.pointerId)
        }

        const pos = getCanvasPos(e)

        if (tool === 'fill') {
          floodFill(pos.x, pos.y, color)
          return
        }

        captureBeforeState()
        isDrawing.current = true
        lastPos.current = pos

        const ctx = getActiveCtx()
        if (!ctx) return

        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'

        const pressure = pressureEnabled && e.pressure > 0 ? e.pressure : 1
        ctx.lineWidth = tool === 'pen' ? brushSize * pressure : brushSize

        if (tool === 'eraser') {
          ctx.globalCompositeOperation = 'destination-out'
          ctx.strokeStyle = 'rgba(0,0,0,1)'
        } else {
          ctx.globalCompositeOperation = 'source-over'
          ctx.strokeStyle = color
        }

        const dotSize = tool === 'pen' ? (brushSize * pressure) / 2 : brushSize / 2
        ctx.beginPath()
        ctx.arc(pos.x, pos.y, dotSize, 0, Math.PI * 2)
        ctx.fillStyle = tool === 'eraser' ? 'rgba(0,0,0,1)' : color
        const prevComposite = ctx.globalCompositeOperation
        if (tool === 'eraser') {
          ctx.globalCompositeOperation = 'destination-out'
        }
        ctx.fill()
        ctx.globalCompositeOperation = prevComposite

        composite()
      },
      [tool, color, brushSize, pressureEnabled, getCanvasPos, getActiveCtx, floodFill, interactive, captureBeforeState, composite]
    )

    const handlePointerMove = useCallback(
      (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (!isDrawing.current || !lastPos.current) return
        const ctx = getActiveCtx()
        if (!ctx) return

        const pressure = pressureEnabled && e.pressure > 0 ? e.pressure : 1
        ctx.lineWidth = tool === 'pen' ? brushSize * pressure : brushSize

        const pos = getCanvasPos(e)
        drawLine(ctx, lastPos.current.x, lastPos.current.y, pos.x, pos.y)
        lastPos.current = pos

        composite()
      },
      [getActiveCtx, getCanvasPos, drawLine, tool, brushSize, pressureEnabled, composite]
    )

    const finishStroke = useCallback(() => {
      if (isDrawing.current) {
        isDrawing.current = false
        lastPos.current = null
        const ctx = getActiveCtx()
        if (ctx) {
          ctx.globalCompositeOperation = 'source-over'
        }
        commitAction()
        composite()
        onDraw()
      }
    }, [getActiveCtx, commitAction, composite, onDraw])

    const handlePointerUp = useCallback(() => {
      finishStroke()
    }, [finishStroke])

    // Global pointer up listener
    useEffect(() => {
      const handleGlobalUp = () => {
        finishStroke()
      }
      window.addEventListener('pointerup', handleGlobalUp)
      return () => window.removeEventListener('pointerup', handleGlobalUp)
    }, [finishStroke])

    useImperativeHandle(
      ref,
      () => ({
        undo: () => {
          if (historyIndexRef.current < 0) return
          const entry = historyRef.current[historyIndexRef.current]
          const ctx = getLayerCtx(entry.layerId)
          if (!ctx) return
          // Swap: save current state, restore old state
          const current = ctx.getImageData(0, 0, width, height)
          ctx.putImageData(entry.imageData, 0, 0)
          entry.imageData = current
          historyIndexRef.current--
          composite()
          onDraw()
        },
        redo: () => {
          if (historyIndexRef.current >= historyRef.current.length - 1) return
          historyIndexRef.current++
          const entry = historyRef.current[historyIndexRef.current]
          const ctx = getLayerCtx(entry.layerId)
          if (!ctx) return
          // Swap: save current state, restore redo state
          const current = ctx.getImageData(0, 0, width, height)
          ctx.putImageData(entry.imageData, 0, 0)
          entry.imageData = current
          composite()
          onDraw()
        },
        clear: () => {
          const ctx = getActiveCtx()
          if (!ctx) return
          captureBeforeState()
          ctx.clearRect(0, 0, width, height)
          commitAction()
          composite()
          onDraw()
        },
        toDataURL: () => {
          composite()
          return displayCanvasRef.current?.toDataURL('image/png') ?? ''
        },
        loadImage: (dataUrl: string) => {
          // v1 compat: load into the first layer
          const firstLayer = layers[layers.length - 1]
          if (!firstLayer) return
          const ctx = getLayerCtx(firstLayer.id)
          if (!ctx) return
          const img = new Image()
          img.onload = () => {
            ctx.clearRect(0, 0, width, height)
            ctx.drawImage(img, 0, 0, width, height)
            historyRef.current = []
            historyIndexRef.current = -1
            composite()
            onDraw()
          }
          img.src = dataUrl
        },
        getContext: getDisplayCtx,
        getLayerDataURLs: () => {
          const result = new Map<string, string>()
          for (const [id, canvas] of layerCanvasesRef.current) {
            result.set(id, canvas.toDataURL('image/png'))
          }
          return result
        },
        loadLayerImages: (images: Map<string, string>) => {
          let remaining = images.size
          if (remaining === 0) {
            historyRef.current = []
            historyIndexRef.current = -1
            composite()
            onDraw()
            return
          }
          for (const [id, dataUrl] of images) {
            const ctx = getLayerCtx(id)
            if (!ctx) {
              remaining--
              if (remaining === 0) {
                historyRef.current = []
                historyIndexRef.current = -1
                composite()
                onDraw()
              }
              continue
            }
            const img = new Image()
            img.onload = () => {
              ctx.clearRect(0, 0, width, height)
              ctx.drawImage(img, 0, 0, width, height)
              remaining--
              if (remaining === 0) {
                historyRef.current = []
                historyIndexRef.current = -1
                composite()
                onDraw()
              }
            }
            img.src = dataUrl
          }
        },
        purgeLayerHistory: (layerId: string) => {
          // Remove all history entries for a deleted layer, adjusting index
          const newHistory: HistoryEntry[] = []
          let removedBefore = 0
          for (let i = 0; i < historyRef.current.length; i++) {
            if (historyRef.current[i].layerId === layerId) {
              if (i <= historyIndexRef.current) removedBefore++
            } else {
              newHistory.push(historyRef.current[i])
            }
          }
          historyRef.current = newHistory
          historyIndexRef.current = Math.min(
            historyIndexRef.current - removedBefore,
            newHistory.length - 1
          )
        }
      }),
      [getLayerCtx, getActiveCtx, getDisplayCtx, width, height, captureBeforeState, commitAction, composite, onDraw, layers]
    )

    const cursorStyle = !interactive
      ? 'inherit'
      : tool === 'fill'
        ? 'crosshair'
        : tool === 'eraser'
          ? `url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='${brushSize}' height='${brushSize}'><circle cx='${brushSize / 2}' cy='${brushSize / 2}' r='${brushSize / 2 - 1}' fill='none' stroke='%23888' stroke-width='1'/></svg>") ${brushSize / 2} ${brushSize / 2}, auto`
          : 'crosshair'

    return (
      <div className="canvas-container">
        <canvas
          ref={displayCanvasRef}
          width={width}
          height={height}
          style={{ cursor: cursorStyle, touchAction: 'none' }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onContextMenu={(e) => e.preventDefault()}
        />
      </div>
    )
  }
)

Canvas.displayName = 'Canvas'
export default Canvas
