import React, { useRef } from 'react'
import { type Layer } from './Canvas'
import {
  EyeIcon,
  EyeOffIcon,
  PlusIcon,
  TrashIcon,
  ArrowUpIcon,
  ArrowDownIcon
} from './icons'

interface LayerPanelProps {
  layers: Layer[]
  activeLayerId: string
  onAddLayer: () => void
  onDeleteLayer: (id: string) => void
  onMoveLayer: (id: string, direction: 'up' | 'down') => void
  onToggleVisibility: (id: string) => void
  onSetOpacity: (id: string, opacity: number) => void
  onRenameLayer: (id: string, name: string) => void
  onSelectLayer: (id: string) => void
}

const LayerPanel: React.FC<LayerPanelProps> = ({
  layers,
  activeLayerId,
  onAddLayer,
  onDeleteLayer,
  onMoveLayer,
  onToggleVisibility,
  onSetOpacity,
  onRenameLayer,
  onSelectLayer
}) => {
  const editingRef = useRef<HTMLInputElement | null>(null)

  return (
    <div className="layer-panel">
      <div className="layer-panel-header">
        <span className="layer-panel-title">레이어</span>
        <button className="layer-panel-add" title="레이어 추가" onClick={onAddLayer}>
          <PlusIcon />
        </button>
      </div>
      <div className="layer-list">
        {layers.map((layer, index) => {
          const isActive = layer.id === activeLayerId
          return (
            <div
              key={layer.id}
              className={`layer-item${isActive ? ' active' : ''}`}
              onClick={() => onSelectLayer(layer.id)}
            >
              <div className="layer-item-row">
                <button
                  className="layer-item-visibility"
                  title={layer.visible ? '숨기기' : '보이기'}
                  onClick={(e) => {
                    e.stopPropagation()
                    onToggleVisibility(layer.id)
                  }}
                >
                  {layer.visible ? <EyeIcon /> : <EyeOffIcon />}
                </button>
                <input
                  ref={isActive ? editingRef : undefined}
                  className="layer-item-name"
                  value={layer.name}
                  onChange={(e) => onRenameLayer(layer.id, e.target.value)}
                  onDoubleClick={(e) => (e.target as HTMLInputElement).select()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
                <span className="layer-item-opacity-label">
                  {Math.round(layer.opacity * 100)}%
                </span>
              </div>
              {isActive && (
                <div className="layer-item-controls">
                  <input
                    className="layer-item-opacity-slider"
                    type="range"
                    min="0"
                    max="100"
                    value={Math.round(layer.opacity * 100)}
                    onChange={(e) =>
                      onSetOpacity(layer.id, parseInt(e.target.value) / 100)
                    }
                    onClick={(e) => e.stopPropagation()}
                  />
                  <button
                    className="layer-item-btn"
                    title="위로"
                    disabled={index === 0}
                    onClick={(e) => {
                      e.stopPropagation()
                      onMoveLayer(layer.id, 'up')
                    }}
                  >
                    <ArrowUpIcon />
                  </button>
                  <button
                    className="layer-item-btn"
                    title="아래로"
                    disabled={index === layers.length - 1}
                    onClick={(e) => {
                      e.stopPropagation()
                      onMoveLayer(layer.id, 'down')
                    }}
                  >
                    <ArrowDownIcon />
                  </button>
                  <button
                    className="layer-item-btn danger"
                    title="삭제"
                    disabled={layers.length <= 1}
                    onClick={(e) => {
                      e.stopPropagation()
                      onDeleteLayer(layer.id)
                    }}
                  >
                    <TrashIcon />
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default LayerPanel
