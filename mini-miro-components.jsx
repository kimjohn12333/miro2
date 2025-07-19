import React, { useState, useRef, useEffect } from 'react';
import './MiniMiro.css';

// 메인 화이트보드 컴포넌트
export function Whiteboard({ diagram, socket, userName, onBack }) {
  const [tool, setTool] = useState('select');
  const [nodes, setNodes] = useState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [isLocked, setIsLocked] = useState(false);
  const [lockStatus, setLockStatus] = useState({});
  const [zoom, setZoom] = useState(100);
  const canvasRef = useRef(null);

  // 도구 모음 컴포넌트
  const ToolPanel = () => (
    <div className="tool-panel">
      <div className="tool-group">
        <ToolButton 
          icon="↖" 
          tool="select" 
          tooltip="선택 (V)" 
          active={tool === 'select'}
          onClick={() => setTool('select')}
        />
        <ToolButton 
          icon="□" 
          tool="rectangle" 
          tooltip="사각형 (R)"
          active={tool === 'rectangle'}
          onClick={() => setTool('rectangle')}
        />
        <ToolButton 
          icon="○" 
          tool="ellipse" 
          tooltip="원 (O)"
          active={tool === 'ellipse'}
          onClick={() => setTool('ellipse')}
        />
        <ToolButton 
          icon="T" 
          tool="text" 
          tooltip="텍스트 (T)"
          active={tool === 'text'}
          onClick={() => setTool('text')}
        />
        <ToolButton 
          icon="↗" 
          tool="connector" 
          tooltip="연결선 (C)"
          active={tool === 'connector'}
          onClick={() => setTool('connector')}
        />
      </div>
      
      <div className="tool-divider" />
      
      <div className="tool-group">
        <ToolButton 
          icon="✋" 
          tool="hand" 
          tooltip="이동 (H)"
          active={tool === 'hand'}
          onClick={() => setTool('hand')}
        />
        <ToolButton 
          icon="🔍" 
          tool="zoom" 
          tooltip="확대/축소 (Z)"
          active={tool === 'zoom'}
          onClick={() => setTool('zoom')}
        />
      </div>
    </div>
  );

  // 헤더 컴포넌트
  const Header = () => (
    <header className="app-header">
      <div className="header-left">
        <button className="btn-back" onClick={onBack}>← 목록</button>
        <h1 className="diagram-title" contentEditable={isLocked}>
          {diagram.title}
        </h1>
      </div>
      
      <div className="header-center">
        <AutoSaveIndicator />
      </div>
      
      <div className="header-right">
        <UserPresence userName={userName} />
        <LockControl 
          isLocked={isLocked}
          lockStatus={lockStatus}
          onRequestLock={handleRequestLock}
          onReleaseLock={handleReleaseLock}
        />
      </div>
    </header>
  );

  // 속성 패널 컴포넌트
  const PropertiesPanel = () => (
    <div className="properties-panel">
      <h3>속성</h3>
      
      {selectedNode ? (
        <NodeProperties 
          node={selectedNode}
          onChange={handleNodeChange}
          disabled={!isLocked}
        />
      ) : (
        <div className="empty-state">
          <p>개체를 선택하면 속성을 편집할 수 있습니다</p>
        </div>
      )}
    </div>
  );

  // 하단 바 컴포넌트
  const BottomBar = () => (
    <div className="bottom-bar">
      <ZoomControl zoom={zoom} onZoomChange={setZoom} />
      <MiniMap nodes={nodes} />
      <CoordinateDisplay />
    </div>
  );

  // 편집 잠금 핸들러
  const handleRequestLock = () => {
    socket.emit('request-lock', { diagramId: diagram.id });
  };

  const handleReleaseLock = () => {
    socket.emit('release-lock', { diagramId: diagram.id });
  };

  const handleNodeChange = (nodeId, changes) => {
    if (!isLocked) return;
    
    setNodes(nodes.map(node => 
      node.id === nodeId ? { ...node, ...changes } : node
    ));
    
    socket.emit('update-diagram', {
      diagramId: diagram.id,
      changes: { nodes: { updated: [{ id: nodeId, ...changes }] } }
    });
  };

  return (
    <div className="whiteboard-container">
      <Header />
      
      <div className="main-content">
        <ToolPanel />
        
        <Canvas 
          ref={canvasRef}
          nodes={nodes}
          selectedNode={selectedNode}
          tool={tool}
          zoom={zoom}
          isLocked={isLocked}
          onNodeSelect={setSelectedNode}
          onNodeChange={handleNodeChange}
          onNodesChange={setNodes}
        />
        
        <PropertiesPanel />
      </div>
      
      <BottomBar />
      
      {isLocked && <EditingIndicator />}
    </div>
  );
}

// 도구 버튼 컴포넌트
function ToolButton({ icon, tool, tooltip, active, onClick }) {
  return (
    <button 
      className={`tool ${active ? 'active' : ''}`}
      data-tool={tool}
      onClick={onClick}
      title={tooltip}
    >
      <span className="tool-icon">{icon}</span>
      <span className="tooltip">{tooltip}</span>
    </button>
  );
}

// 자동 저장 표시기
function AutoSaveIndicator() {
  const [status, setStatus] = useState('saved');
  
  return (
    <div className="auto-save-indicator">
      <span className={`status-dot ${status}`} />
      <span>
        {status === 'saving' ? '저장 중...' : '자동 저장됨'}
      </span>
    </div>
  );
}

// 사용자 표시
function UserPresence({ userName }) {
  const initial = userName.charAt(0).toUpperCase();
  
  return (
    <div className="user-presence">
      <div className="user-avatar">{initial}</div>
      <span>{userName}</span>
    </div>
  );
}

// 편집 잠금 컨트롤
function LockControl({ isLocked, lockStatus, onRequestLock, onReleaseLock }) {
  return (
    <div className="lock-control">
      {lockStatus.locked ? (
        lockStatus.lockedBy === userName ? (
          <button className="btn-lock locked" onClick={onReleaseLock}>
            <svg width="16" height="16" viewBox="0 0 16 16">
              <path d="M3 5v6h10V5H3zm1-2h8V2a2 2 0 00-4 0v1H4V2a4 4 0 018 0v1h1a1 1 0 011 1v8a1 1 0 01-1 1H3a1 1 0 01-1-1V4a1 1 0 011-1z"/>
            </svg>
            편집 중
          </button>
        ) : (
          <div className="lock-status">
            <svg width="16" height="16" viewBox="0 0 16 16">
              <path d="M3 5v6h10V5H3zm5-3a2 2 0 00-2 2v1H4V4a4 4 0 018 0v1h-2V4a2 2 0 00-2-2z"/>
            </svg>
            {lockStatus.lockedBy}님이 편집 중
          </div>
        )
      ) : (
        <button className="btn-lock" onClick={onRequestLock}>
          <svg width="16" height="16" viewBox="0 0 16 16">
            <path d="M3 7v6h10V7H3zm5-5a2 2 0 00-2 2v3H4V4a4 4 0 018 0v3h-2V4a2 2 0 00-2-2z"/>
          </svg>
          편집 시작
        </button>
      )}
    </div>
  );
}

// 노드 속성 편집기
function NodeProperties({ node, onChange, disabled }) {
  return (
    <div className="node-properties">
      <div className="property-group">
        <label>텍스트</label>
        <input 
          type="text" 
          value={node.text || ''} 
          onChange={(e) => onChange(node.id, { text: e.target.value })}
          disabled={disabled}
        />
      </div>
      
      <div className="property-group">
        <label>채우기</label>
        <ColorPicker 
          value={node.fill || '#e0e0e0'}
          onChange={(color) => onChange(node.id, { fill: color })}
          disabled={disabled}
        />
      </div>
      
      <div className="property-group">
        <label>테두리</label>
        <div className="border-controls">
          <select 
            value={node.strokeStyle || 'solid'}
            onChange={(e) => onChange(node.id, { strokeStyle: e.target.value })}
            disabled={disabled}
          >
            <option value="solid">실선</option>
            <option value="dashed">점선</option>
            <option value="dotted">점</option>
          </select>
          <input 
            type="number" 
            value={node.strokeWidth || 1}
            min="1" 
            max="10"
            onChange={(e) => onChange(node.id, { strokeWidth: e.target.value })}
            disabled={disabled}
          />
        </div>
      </div>
      
      <div className="property-group">
        <label>크기</label>
        <div className="size-controls">
          <input 
            type="number" 
            value={node.width || 100}
            onChange={(e) => onChange(node.id, { width: parseInt(e.target.value) })}
            disabled={disabled}
          />
          <span>×</span>
          <input 
            type="number" 
            value={node.height || 50}
            onChange={(e) => onChange(node.id, { height: parseInt(e.target.value) })}
            disabled={disabled}
          />
        </div>
      </div>
    </div>
  );
}

// 색상 선택기
function ColorPicker({ value, onChange, disabled }) {
  const colors = [
    '#E3F2FD', '#E8F5E9', '#FFF9C4', 
    '#FFE0B2', '#F3E5F5', '#F5F5F5',
    '#BBDEFB', '#C8E6C9', '#FFF59D',
    '#FFCCBC', '#E1BEE7', '#E0E0E0'
  ];
  
  return (
    <div className="color-picker">
      <button 
        className="color-swatch current" 
        style={{ backgroundColor: value }}
        disabled={disabled}
      />
      <div className="color-grid">
        {colors.map(color => (
          <button
            key={color}
            className="color-swatch"
            style={{ backgroundColor: color }}
            onClick={() => onChange(color)}
            disabled={disabled}
          />
        ))}
      </div>
    </div>
  );
}

// 줌 컨트롤
function ZoomControl({ zoom, onZoomChange }) {
  return (
    <div className="zoom-control">
      <button onClick={() => onZoomChange(Math.max(25, zoom - 25))}>−</button>
      <span>{zoom}%</span>
      <button onClick={() => onZoomChange(Math.min(200, zoom + 25))}>+</button>
      <button onClick={() => onZoomChange(100)}>맞춤</button>
    </div>
  );
}

// 미니맵
function MiniMap({ nodes }) {
  return (
    <div className="minimap">
      <canvas width="120" height="80" />
    </div>
  );
}

// 좌표 표시
function CoordinateDisplay() {
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  
  return (
    <div className="coordinate-display">
      X: {coords.x} Y: {coords.y}
    </div>
  );
}

// 편집 중 표시기
function EditingIndicator() {
  return (
    <div className="editing-indicator">
      <span className="pulse-dot" />
      편집 중
    </div>
  );
}

// 캔버스 컴포넌트 (React Konva 사용)
const Canvas = React.forwardRef(({ 
  nodes, 
  selectedNode, 
  tool, 
  zoom, 
  isLocked,
  onNodeSelect,
  onNodeChange,
  onNodesChange 
}, ref) => {
  // 캔버스 로직은 기존 구현 활용
  return (
    <div className="canvas-container">
      <div 
        className={`canvas ${isLocked ? 'editable' : 'readonly'}`}
        style={{ transform: `scale(${zoom / 100})` }}
      >
        {/* Konva Stage 구현 */}
      </div>
    </div>
  );
});