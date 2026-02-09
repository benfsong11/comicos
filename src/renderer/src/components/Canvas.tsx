import React, { useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react'

export type Tool = 'pen' | 'eraser' | 'fill'

interface CanvasProps {
  width: number
  height: number
  tool: Tool
  color: string
  brushSize: number
  onDraw: () => void
}

export interface CanvasHandle {
  undo: () => void
  redo: () => void
  clear: () => void
  toDataURL: () => string
  loadImage: (dataUrl: string) => void
  getContext: () => CanvasRenderingContext2D | null
}

const Canvas = forwardRef<CanvasHandle, CanvasProps>(
  ({ width, height, tool, color, brushSize, onDraw }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const isDrawing = useRef(false)
    const lastPos = useRef<{ x: number; y: number } | null>(null)
    const historyRef = useRef<ImageData[]>([])
    const historyIndexRef = useRef(-1)
    const maxHistory = 50

    const getCtx = useCallback(() => {
      return canvasRef.current?.getContext('2d', { willReadFrequently: true }) ?? null
    }, [])

    const saveState = useCallback(() => {
      const ctx = getCtx()
      if (!ctx) return
      const imageData = ctx.getImageData(0, 0, width, height)
      // Remove any redo states
      historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1)
      historyRef.current.push(imageData)
      if (historyRef.current.length > maxHistory) {
        historyRef.current.shift()
      } else {
        historyIndexRef.current++
      }
    }, [getCtx, width, height])

    // Initialize canvas
    useEffect(() => {
      const ctx = getCtx()
      if (!ctx) return
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, width, height)
      historyRef.current = []
      historyIndexRef.current = -1
      saveState()
    }, [width, height, getCtx, saveState])

    const floodFill = useCallback(
      (startX: number, startY: number, fillColor: string) => {
        const ctx = getCtx()
        if (!ctx) return

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
          return
        }

        const tolerance = 10
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

        ctx.putImageData(imageData, 0, 0)
        saveState()
        onDraw()
      },
      [getCtx, width, height, saveState, onDraw]
    )

    const getCanvasPos = useCallback(
      (e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current
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

    const handleMouseDown = useCallback(
      (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (e.button !== 0) return
        const pos = getCanvasPos(e)

        if (tool === 'fill') {
          floodFill(pos.x, pos.y, color)
          return
        }

        isDrawing.current = true
        lastPos.current = pos

        const ctx = getCtx()
        if (!ctx) return

        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        ctx.lineWidth = brushSize

        if (tool === 'eraser') {
          ctx.globalCompositeOperation = 'destination-out'
          ctx.strokeStyle = 'rgba(0,0,0,1)'
        } else {
          ctx.globalCompositeOperation = 'source-over'
          ctx.strokeStyle = color
        }

        // Draw a dot for single click
        ctx.beginPath()
        ctx.arc(pos.x, pos.y, brushSize / 2, 0, Math.PI * 2)
        ctx.fillStyle = tool === 'eraser' ? 'rgba(0,0,0,1)' : color
        const prevComposite = ctx.globalCompositeOperation
        if (tool === 'eraser') {
          ctx.globalCompositeOperation = 'destination-out'
        }
        ctx.fill()
        ctx.globalCompositeOperation = prevComposite
      },
      [tool, color, brushSize, getCanvasPos, getCtx, floodFill]
    )

    const handleMouseMove = useCallback(
      (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!isDrawing.current || !lastPos.current) return
        const ctx = getCtx()
        if (!ctx) return

        const pos = getCanvasPos(e)
        drawLine(ctx, lastPos.current.x, lastPos.current.y, pos.x, pos.y)
        lastPos.current = pos
      },
      [getCtx, getCanvasPos, drawLine]
    )

    const handleMouseUp = useCallback(() => {
      if (isDrawing.current) {
        isDrawing.current = false
        lastPos.current = null
        const ctx = getCtx()
        if (ctx) {
          ctx.globalCompositeOperation = 'source-over'
        }
        saveState()
        onDraw()
      }
    }, [getCtx, saveState, onDraw])

    // Global mouse up listener
    useEffect(() => {
      const handleGlobalUp = () => {
        if (isDrawing.current) {
          isDrawing.current = false
          lastPos.current = null
          const ctx = getCtx()
          if (ctx) {
            ctx.globalCompositeOperation = 'source-over'
          }
          saveState()
          onDraw()
        }
      }
      window.addEventListener('mouseup', handleGlobalUp)
      return () => window.removeEventListener('mouseup', handleGlobalUp)
    }, [getCtx, saveState, onDraw])

    useImperativeHandle(
      ref,
      () => ({
        undo: () => {
          if (historyIndexRef.current <= 0) return
          historyIndexRef.current--
          const ctx = getCtx()
          if (!ctx) return
          ctx.putImageData(historyRef.current[historyIndexRef.current], 0, 0)
          onDraw()
        },
        redo: () => {
          if (historyIndexRef.current >= historyRef.current.length - 1) return
          historyIndexRef.current++
          const ctx = getCtx()
          if (!ctx) return
          ctx.putImageData(historyRef.current[historyIndexRef.current], 0, 0)
          onDraw()
        },
        clear: () => {
          const ctx = getCtx()
          if (!ctx) return
          ctx.fillStyle = '#ffffff'
          ctx.fillRect(0, 0, width, height)
          saveState()
          onDraw()
        },
        toDataURL: () => {
          return canvasRef.current?.toDataURL('image/png') ?? ''
        },
        loadImage: (dataUrl: string) => {
          const ctx = getCtx()
          if (!ctx) return
          const img = new Image()
          img.onload = () => {
            ctx.fillStyle = '#ffffff'
            ctx.fillRect(0, 0, width, height)
            ctx.drawImage(img, 0, 0, width, height)
            saveState()
            onDraw()
          }
          img.src = dataUrl
        },
        getContext: getCtx
      }),
      [getCtx, width, height, saveState, onDraw]
    )

    const cursorStyle =
      tool === 'fill'
        ? 'crosshair'
        : tool === 'eraser'
          ? `url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='${brushSize}' height='${brushSize}'><circle cx='${brushSize / 2}' cy='${brushSize / 2}' r='${brushSize / 2 - 1}' fill='none' stroke='%23888' stroke-width='1'/></svg>") ${brushSize / 2} ${brushSize / 2}, auto`
          : 'crosshair'

    return (
      <div className="canvas-container">
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          style={{ cursor: cursorStyle }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onContextMenu={(e) => e.preventDefault()}
        />
      </div>
    )
  }
)

Canvas.displayName = 'Canvas'
export default Canvas
