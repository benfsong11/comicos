import React, { useState, useRef, useCallback, useEffect } from 'react'
import Toolbar from './components/Toolbar'
import Canvas, { type Tool, type CanvasHandle, type Layer } from './components/Canvas'
import LayerPanel from './components/LayerPanel'
import StatusBar from './components/StatusBar'
import CanvasSizeModal from './components/CanvasSizeModal'

function getInitialTheme(): 'light' | 'dark' {
  const saved = localStorage.getItem('comicos-theme')
  if (saved === 'light' || saved === 'dark') return saved
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

let layerIdCounter = 0
function newLayerId(): string {
  return `layer-${++layerIdCounter}-${Date.now()}`
}

function createDefaultLayers(): { layers: Layer[]; activeId: string } {
  const id = newLayerId()
  return {
    layers: [{ id, name: '레이어 1', opacity: 1, visible: true }],
    activeId: id
  }
}

const App: React.FC = () => {
  const [tool, setTool] = useState<Tool>('pen')
  const [color, setColor] = useState('#000000')
  const [brushSize, setBrushSize] = useState(3)
  const [pressureEnabled, setPressureEnabled] = useState(true)
  const [theme, setTheme] = useState<'light' | 'dark'>(getInitialTheme)
  const [zoom, setZoom] = useState(1)
  const [canvasSize, setCanvasSize] = useState<{ width: number; height: number } | null>(null)
  const [currentFilePath, setCurrentFilePath] = useState<string | null>(null)
  const canvasRef = useRef<CanvasHandle>(null)
  const [, setDrawCount] = useState(0)

  // Layer state
  const [layers, setLayers] = useState<Layer[]>(() => createDefaultLayers().layers)
  const [activeLayerId, setActiveLayerId] = useState<string>(() => layers[0]?.id ?? '')

  // Pan & zoom-drag state
  const [spaceHeld, setSpaceHeld] = useState(false)
  const [ctrlHeld, setCtrlHeld] = useState(false)
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const panDragRef = useRef<{
    startX: number; startY: number; initPanX: number; initPanY: number
  } | null>(null)
  const zoomDragRef = useRef<{
    startX: number; initZoom: number
    anchorX: number; anchorY: number
    initPanX: number; initPanY: number
  } | null>(null)
  const canvasAreaRef = useRef<HTMLDivElement>(null)

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

  // Window title
  useEffect(() => {
    const name = currentFilePath?.split(/[/\\]/).pop() ?? '제목 없음'
    document.title = `${name} - Comicos`
  }, [currentFilePath])

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }, [])

  const togglePressure = useCallback(() => {
    setPressureEnabled((prev) => !prev)
  }, [])

  const handleDraw = useCallback(() => {
    setDrawCount((c) => c + 1)
  }, [])

  const handleUndo = useCallback(() => canvasRef.current?.undo(), [])
  const handleRedo = useCallback(() => canvasRef.current?.redo(), [])
  const handleClear = useCallback(() => canvasRef.current?.clear(), [])

  const handleNew = useCallback(() => {
    const { layers: newLayers, activeId } = createDefaultLayers()
    setLayers(newLayers)
    setActiveLayerId(activeId)
    setCanvasSize(null)
    setCurrentFilePath(null)
    setPanOffset({ x: 0, y: 0 })
    setZoom(1)
  }, [])

  const handleCanvasSizeConfirm = useCallback((width: number, height: number) => {
    setCanvasSize({ width, height })
  }, [])

  // --- Layer callbacks ---
  const handleAddLayer = useCallback(() => {
    const id = newLayerId()
    const count = layers.length + 1
    setLayers((prev) => [{ id, name: `레이어 ${count}`, opacity: 1, visible: true }, ...prev])
    setActiveLayerId(id)
  }, [layers.length])

  const handleDeleteLayer = useCallback(
    (id: string) => {
      if (layers.length <= 1) return
      canvasRef.current?.purgeLayerHistory(id)
      setLayers((prev) => prev.filter((l) => l.id !== id))
      if (activeLayerId === id) {
        const remaining = layers.filter((l) => l.id !== id)
        setActiveLayerId(remaining[0]?.id ?? '')
      }
    },
    [layers, activeLayerId]
  )

  const handleMoveLayer = useCallback((id: string, direction: 'up' | 'down') => {
    setLayers((prev) => {
      const idx = prev.findIndex((l) => l.id === id)
      if (idx < 0) return prev
      const targetIdx = direction === 'up' ? idx - 1 : idx + 1
      if (targetIdx < 0 || targetIdx >= prev.length) return prev
      const copy = [...prev]
      ;[copy[idx], copy[targetIdx]] = [copy[targetIdx], copy[idx]]
      return copy
    })
  }, [])

  const handleToggleVisibility = useCallback((id: string) => {
    setLayers((prev) =>
      prev.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l))
    )
  }, [])

  const handleSetOpacity = useCallback((id: string, opacity: number) => {
    setLayers((prev) =>
      prev.map((l) => (l.id === id ? { ...l, opacity } : l))
    )
  }, [])

  const handleRenameLayer = useCallback((id: string, name: string) => {
    setLayers((prev) =>
      prev.map((l) => (l.id === id ? { ...l, name } : l))
    )
  }, [])

  const handleSelectLayer = useCallback((id: string) => {
    setActiveLayerId(id)
  }, [])

  // Build .cmc project JSON from current state (v2)
  const buildProjectData = useCallback(() => {
    if (!canvasRef.current || !canvasSize) return null
    const layerImages: Record<string, string> = {}
    const dataURLs = canvasRef.current.getLayerDataURLs()
    for (const [id, dataUrl] of dataURLs) {
      layerImages[id] = dataUrl
    }
    const project = {
      version: 2,
      canvasWidth: canvasSize.width,
      canvasHeight: canvasSize.height,
      tool,
      brushSize,
      pressureEnabled,
      color,
      layers,
      activeLayerId,
      layerImages
    }
    return JSON.stringify(project, null, 2)
  }, [canvasSize, tool, brushSize, pressureEnabled, color, layers, activeLayerId])

  const handleSave = useCallback(async () => {
    const data = buildProjectData()
    if (!data) return
    const result = await window.api.saveProject(data, currentFilePath ?? undefined)
    if (result.success && result.filePath) {
      setCurrentFilePath(result.filePath)
    }
  }, [buildProjectData, currentFilePath])

  const handleSaveAs = useCallback(async () => {
    const data = buildProjectData()
    if (!data) return
    const result = await window.api.saveProjectAs(data)
    if (result.success && result.filePath) {
      setCurrentFilePath(result.filePath)
    }
  }, [buildProjectData])

  const handleExport = useCallback(async () => {
    if (!canvasRef.current) return
    const dataUrl = canvasRef.current.toDataURL()
    await window.api.exportImage(dataUrl)
  }, [])

  const handleOpen = useCallback(async () => {
    const result = await window.api.openProject()
    if (result.success && result.data) {
      try {
        const project = JSON.parse(result.data)
        setCanvasSize({ width: project.canvasWidth, height: project.canvasHeight })
        setTool(project.tool ?? 'pen')
        setBrushSize(project.brushSize ?? 3)
        setPressureEnabled(project.pressureEnabled ?? true)
        setColor(project.color ?? '#000000')
        setCurrentFilePath(result.filePath)
        setPanOffset({ x: 0, y: 0 })
        setZoom(1)

        if (project.version === 2 && project.layers) {
          // v2 format
          const loadedLayers: Layer[] = project.layers
          setLayers(loadedLayers)
          setActiveLayerId(project.activeLayerId ?? loadedLayers[0]?.id ?? '')
          // Load layer images after canvas and layers are ready
          setTimeout(() => {
            if (project.layerImages) {
              const imageMap = new Map<string, string>()
              for (const [id, dataUrl] of Object.entries(project.layerImages)) {
                imageMap.set(id, dataUrl as string)
              }
              canvasRef.current?.loadLayerImages(imageMap)
            }
          }, 100)
        } else {
          // v1 format: single layer
          const { layers: newLayers, activeId } = createDefaultLayers()
          setLayers(newLayers)
          setActiveLayerId(activeId)
          setTimeout(() => {
            if (project.imageData) {
              canvasRef.current?.loadImage(project.imageData)
            }
          }, 100)
        }
      } catch {
        // Invalid project file
      }
    }
  }, [])

  // Helper: compute cursor position relative to canvas-area center
  const getCursorRelativeToCenter = useCallback((clientX: number, clientY: number) => {
    const area = canvasAreaRef.current
    if (!area) return { x: 0, y: 0 }
    const rect = area.getBoundingClientRect()
    return {
      x: clientX - rect.left - rect.width / 2,
      y: clientY - rect.top - rect.height / 2
    }
  }, [])

  // Modifier key tracking (Space for pan, Ctrl+Space for zoom-drag)
  useEffect(() => {
    if (!canvasSize) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return
      if (e.code === 'Space') {
        e.preventDefault()
        setSpaceHeld(true)
      } else if (e.key === 'Control' || e.key === 'Meta') {
        setCtrlHeld(true)
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setSpaceHeld(false)
      } else if (e.key === 'Control' || e.key === 'Meta') {
        setCtrlHeld(false)
      }
    }

    const handleBlur = () => {
      setSpaceHeld(false)
      setCtrlHeld(false)
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('blur', handleBlur)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', handleBlur)
    }
  }, [canvasSize])

  // Clear drag refs when modifier released
  useEffect(() => {
    if (!spaceHeld) {
      panDragRef.current = null
      zoomDragRef.current = null
      setIsDragging(false)
    }
  }, [spaceHeld])

  useEffect(() => {
    if (!ctrlHeld) zoomDragRef.current = null
  }, [ctrlHeld])

  // Pointer handlers for pan/zoom on canvas-area
  const handleAreaPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return
      if (spaceHeld && (e.ctrlKey || e.metaKey)) {
        ;(e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId)
        const cursor = getCursorRelativeToCenter(e.clientX, e.clientY)
        zoomDragRef.current = {
          startX: e.clientX,
          initZoom: zoom,
          anchorX: cursor.x - panOffset.x,
          anchorY: cursor.y - panOffset.y,
          initPanX: panOffset.x,
          initPanY: panOffset.y
        }
        setIsDragging(true)
      } else if (spaceHeld) {
        ;(e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId)
        panDragRef.current = {
          startX: e.clientX,
          startY: e.clientY,
          initPanX: panOffset.x,
          initPanY: panOffset.y
        }
        setIsDragging(true)
      }
    },
    [spaceHeld, panOffset, zoom, getCursorRelativeToCenter]
  )

  const handleAreaPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (panDragRef.current) {
        const dx = e.clientX - panDragRef.current.startX
        const dy = e.clientY - panDragRef.current.startY
        setPanOffset({
          x: panDragRef.current.initPanX + dx,
          y: panDragRef.current.initPanY + dy
        })
      } else if (zoomDragRef.current) {
        const dx = e.clientX - zoomDragRef.current.startX
        const newZoom = Math.min(3, Math.max(0.25,
          zoomDragRef.current.initZoom + dx * 0.005
        ))
        const ratio = 1 - newZoom / zoomDragRef.current.initZoom
        setPanOffset({
          x: zoomDragRef.current.initPanX + zoomDragRef.current.anchorX * ratio,
          y: zoomDragRef.current.initPanY + zoomDragRef.current.anchorY * ratio
        })
        setZoom(newZoom)
      }
    },
    []
  )

  const handleAreaPointerUp = useCallback(() => {
    panDragRef.current = null
    zoomDragRef.current = null
    setIsDragging(false)
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey

      if (ctrl && e.key === 'n') {
        e.preventDefault()
        handleNew()
      } else if (ctrl && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        handleUndo()
      } else if (ctrl && (e.key === 'Z' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault()
        handleRedo()
      } else if (ctrl && e.shiftKey && e.key === 'S') {
        e.preventDefault()
        handleSaveAs()
      } else if (ctrl && e.key === 's' && !e.shiftKey) {
        e.preventDefault()
        handleSave()
      } else if (ctrl && e.key === 'e') {
        e.preventDefault()
        handleExport()
      } else if (ctrl && e.key === 'o') {
        e.preventDefault()
        handleOpen()
      } else if (!ctrl && canvasSize) {
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
  }, [handleUndo, handleRedo, handleSave, handleSaveAs, handleExport, handleOpen, handleNew, canvasSize])

  // Menu actions from main process
  useEffect(() => {
    if (!window.api?.onMenuAction) return
    const cleanup = window.api.onMenuAction((action: string) => {
      switch (action) {
        case 'new':
          handleNew()
          break
        case 'open':
          handleOpen()
          break
        case 'save':
          handleSave()
          break
        case 'save-as':
          handleSaveAs()
          break
        case 'export':
          handleExport()
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
          setPanOffset({ x: 0, y: 0 })
          break
      }
    })
    return cleanup
  }, [handleNew, handleOpen, handleSave, handleSaveAs, handleExport, handleUndo, handleRedo])

  // Zoom with Ctrl+Wheel — anchored to cursor position
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return
      e.preventDefault()

      const area = canvasAreaRef.current
      if (!area) return
      const rect = area.getBoundingClientRect()
      const cursorX = e.clientX - rect.left - rect.width / 2
      const cursorY = e.clientY - rect.top - rect.height / 2

      setZoom((prevZoom) => {
        const delta = e.deltaY > 0 ? -0.05 : 0.05
        const newZoom = Math.min(3, Math.max(0.25, prevZoom + delta))
        const ratio = 1 - newZoom / prevZoom
        setPanOffset((prevPan) => ({
          x: prevPan.x + (cursorX - prevPan.x) * ratio,
          y: prevPan.y + (cursorY - prevPan.y) * ratio
        }))
        return newZoom
      })
    }

    window.addEventListener('wheel', handleWheel, { passive: false })
    return () => window.removeEventListener('wheel', handleWheel)
  }, [])

  if (!canvasSize) {
    return (
      <div className="app">
        <CanvasSizeModal onConfirm={handleCanvasSizeConfirm} />
      </div>
    )
  }

  const areaCursor = spaceHeld && ctrlHeld
    ? 'zoom-in'
    : spaceHeld
      ? (isDragging ? 'grabbing' : 'grab')
      : undefined

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
        pressureEnabled={pressureEnabled}
        togglePressure={togglePressure}
        theme={theme}
        toggleTheme={toggleTheme}
      />
      <div className="main-content">
        <div
          ref={canvasAreaRef}
          className="canvas-area"
          style={areaCursor ? { cursor: areaCursor } : undefined}
          onPointerDown={handleAreaPointerDown}
          onPointerMove={handleAreaPointerMove}
          onPointerUp={handleAreaPointerUp}
        >
          <div
            style={{
              transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
              transformOrigin: 'center center'
            }}
          >
            <Canvas
              ref={canvasRef}
              width={canvasSize.width}
              height={canvasSize.height}
              tool={tool}
              color={color}
              brushSize={brushSize}
              pressureEnabled={pressureEnabled}
              onDraw={handleDraw}
              interactive={!spaceHeld}
              layers={layers}
              activeLayerId={activeLayerId}
            />
          </div>
        </div>
        <LayerPanel
          layers={layers}
          activeLayerId={activeLayerId}
          onAddLayer={handleAddLayer}
          onDeleteLayer={handleDeleteLayer}
          onMoveLayer={handleMoveLayer}
          onToggleVisibility={handleToggleVisibility}
          onSetOpacity={handleSetOpacity}
          onRenameLayer={handleRenameLayer}
          onSelectLayer={handleSelectLayer}
        />
      </div>
      <StatusBar
        canvasWidth={canvasSize.width}
        canvasHeight={canvasSize.height}
        tool={tool}
        zoom={zoom}
      />
    </div>
  )
}

export default App
