import React, { useRef } from 'react'
import type { Tool } from './Canvas'
import {
  PenIcon,
  EraserIcon,
  FillIcon,
  UndoIcon,
  RedoIcon,
  SunIcon,
  MoonIcon,
  SaveIcon,
  FolderOpenIcon,
  FilePlusIcon
} from './icons'

interface ToolbarProps {
  tool: Tool
  setTool: (tool: Tool) => void
  color: string
  setColor: (color: string) => void
  brushSize: number
  setBrushSize: (size: number) => void
  onUndo: () => void
  onRedo: () => void
  onClear: () => void
  onSave: () => void
  onOpen: () => void
  theme: 'light' | 'dark'
  toggleTheme: () => void
}

const Toolbar: React.FC<ToolbarProps> = ({
  tool,
  setTool,
  color,
  setColor,
  brushSize,
  setBrushSize,
  onUndo,
  onRedo,
  onClear,
  onSave,
  onOpen,
  theme,
  toggleTheme
}) => {
  const colorInputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="toolbar">
      {/* File operations */}
      <div className="toolbar-group">
        <button className="toolbar-btn" onClick={onClear} title="새 캔버스">
          <FilePlusIcon />
        </button>
        <button className="toolbar-btn" onClick={onOpen} title="이미지 열기">
          <FolderOpenIcon />
        </button>
        <button className="toolbar-btn" onClick={onSave} title="저장">
          <SaveIcon />
        </button>
      </div>

      <div className="toolbar-separator" />

      {/* Undo/Redo */}
      <div className="toolbar-group">
        <button className="toolbar-btn" onClick={onUndo} title="실행 취소">
          <UndoIcon />
        </button>
        <button className="toolbar-btn" onClick={onRedo} title="다시 실행">
          <RedoIcon />
        </button>
      </div>

      <div className="toolbar-separator" />

      {/* Drawing tools */}
      <div className="toolbar-group">
        <button
          className={`toolbar-btn ${tool === 'pen' ? 'active' : ''}`}
          onClick={() => setTool('pen')}
          title="펜"
        >
          <PenIcon />
        </button>
        <button
          className={`toolbar-btn ${tool === 'eraser' ? 'active' : ''}`}
          onClick={() => setTool('eraser')}
          title="지우개"
        >
          <EraserIcon />
        </button>
        <button
          className={`toolbar-btn ${tool === 'fill' ? 'active' : ''}`}
          onClick={() => setTool('fill')}
          title="색 채우기"
        >
          <FillIcon />
        </button>
      </div>

      <div className="toolbar-separator" />

      {/* Color picker */}
      <div className="color-picker-wrapper">
        <div
          className="color-swatch"
          style={{ backgroundColor: color }}
          onClick={() => colorInputRef.current?.click()}
        />
        <input
          ref={colorInputRef}
          className="color-input-hidden"
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
        />
      </div>

      <div className="toolbar-separator" />

      {/* Brush size */}
      <div className="brush-size-control">
        <input
          className="brush-size-slider"
          type="range"
          min={1}
          max={50}
          value={brushSize}
          onChange={(e) => setBrushSize(Number(e.target.value))}
        />
        <span className="brush-size-label">{brushSize}</span>
      </div>

      <div className="toolbar-spacer" />

      <span className="toolbar-title">Comicos</span>

      <div className="toolbar-spacer" />

      {/* Theme toggle */}
      <button className="toolbar-btn theme-toggle" onClick={toggleTheme} title="테마 전환">
        {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
      </button>
    </div>
  )
}

export default Toolbar
