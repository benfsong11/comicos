import React from 'react'

interface StatusBarProps {
  canvasWidth: number
  canvasHeight: number
  tool: string
  zoom: number
}

const StatusBar: React.FC<StatusBarProps> = ({ canvasWidth, canvasHeight, tool, zoom }) => {
  const toolNames: Record<string, string> = {
    pen: '펜',
    eraser: '지우개',
    fill: '색 채우기'
  }

  return (
    <div className="statusbar">
      <div className="statusbar-item">
        <span>{canvasWidth} x {canvasHeight}px</span>
      </div>
      <div className="statusbar-item">
        <span>{toolNames[tool] || tool}</span>
      </div>
      <div className="statusbar-item">
        <span>{Math.round(zoom * 100)}%</span>
      </div>
    </div>
  )
}

export default StatusBar
