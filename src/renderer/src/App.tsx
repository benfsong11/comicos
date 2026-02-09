import React, { useState, useRef, useCallback, useEffect } from 'react'
import Toolbar from './components/Toolbar'
import Canvas, { type Tool, type CanvasHandle } from './components/Canvas'
import StatusBar from './components/StatusBar'

const CANVAS_WIDTH = 1200
const CANVAS_HEIGHT = 800

function getInitialTheme(): 'light' | 'dark' {
  const saved = localStorage.getItem('comicos-theme')
  if (saved === 'light' || saved === 'dark') return saved
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

const App: React.FC = () => {
  const [tool, setTool] = useState<Tool>('pen')
  const [color, setColor] = useState('#000000')
  const [brushSize, setBrushSize] = useState(3)
  const [theme, setTheme] = useState<'light' | 'dark'>(getInitialTheme)
  const [zoom, setZoom] = useState(1)
  const canvasRef = useRef<CanvasHandle>(null)
  const [, setDrawCount] = useState(0)

  // Apply theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('comicos-theme', theme)
  }, [theme])

  // Set platform
  useEffect(() => {
    const platform = navigator.userAgent.includes('Mac') ? 'darwin' : 'win32'
    document.documentElement.setAttribute('data-platform', platform)
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }, [])

  const handleDraw = useCallback(() => {
    setDrawCount((c) => c + 1)
  }, [])

  const handleUndo = useCallback(() => canvasRef.current?.undo(), [])
  const handleRedo = useCallback(() => canvasRef.current?.redo(), [])
  const handleClear = useCallback(() => canvasRef.current?.clear(), [])

  const handleSave = useCallback(async () => {
    if (!canvasRef.current) return
    const dataUrl = canvasRef.current.toDataURL()
    await window.api.saveImage(dataUrl)
  }, [])

  const handleOpen = useCallback(async () => {
    const result = await window.api.openImage()
    if (result.success && result.dataUrl) {
      canvasRef.current?.loadImage(result.dataUrl)
    }
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey

      if (ctrl && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        handleUndo()
      } else if (ctrl && (e.key === 'Z' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault()
        handleRedo()
      } else if (ctrl && e.key === 's' && !e.shiftKey) {
        e.preventDefault()
        handleSave()
      } else if (ctrl && e.key === 'o') {
        e.preventDefault()
        handleOpen()
      } else if (!ctrl) {
        switch (e.key) {
          case 'b':
          case 'p':
            setTool('pen')
            break
          case 'e':
            setTool('eraser')
            break
          case 'g':
            setTool('fill')
            break
          case '[':
            setBrushSize((s) => Math.max(1, s - 1))
            break
          case ']':
            setBrushSize((s) => Math.min(50, s + 1))
            break
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleUndo, handleRedo, handleSave, handleOpen])

  // Menu actions from main process
  useEffect(() => {
    if (!window.api?.onMenuAction) return
    const cleanup = window.api.onMenuAction((action: string) => {
      switch (action) {
        case 'new':
          handleClear()
          break
        case 'open':
          handleOpen()
          break
        case 'save':
        case 'save-as':
          handleSave()
          break
        case 'undo':
          handleUndo()
          break
        case 'redo':
          handleRedo()
          break
        case 'zoom-in':
          setZoom((z) => Math.min(3, z + 0.1))
          break
        case 'zoom-out':
          setZoom((z) => Math.max(0.25, z - 0.1))
          break
        case 'zoom-reset':
          setZoom(1)
          break
      }
    })
    return cleanup
  }, [handleClear, handleOpen, handleSave, handleUndo, handleRedo])

  // Zoom with Ctrl+Wheel
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        setZoom((z) => {
          const delta = e.deltaY > 0 ? -0.05 : 0.05
          return Math.min(3, Math.max(0.25, z + delta))
        })
      }
    }

    window.addEventListener('wheel', handleWheel, { passive: false })
    return () => window.removeEventListener('wheel', handleWheel)
  }, [])

  return (
    <div className="app">
      <Toolbar
        tool={tool}
        setTool={setTool}
        color={color}
        setColor={setColor}
        brushSize={brushSize}
        setBrushSize={setBrushSize}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onClear={handleClear}
        onSave={handleSave}
        onOpen={handleOpen}
        theme={theme}
        toggleTheme={toggleTheme}
      />
      <div className="canvas-area">
        <div style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}>
          <Canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            tool={tool}
            color={color}
            brushSize={brushSize}
            onDraw={handleDraw}
          />
        </div>
      </div>
      <StatusBar
        canvasWidth={CANVAS_WIDTH}
        canvasHeight={CANVAS_HEIGHT}
        tool={tool}
        zoom={zoom}
      />
    </div>
  )
}

export default App
