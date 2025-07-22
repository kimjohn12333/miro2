import React, { useRef, useState, useCallback } from 'react';
import './ToolPanel.css';

interface Props {
  currentTool: string;
  onToolChange: (tool: string) => void;
  canEdit: boolean;
  onDelete: (forceShapeDelete?: boolean) => void;
  hasSelection: boolean;
  onMermaidImport: () => void;
}

const ToolPanel: React.FC<Props> = ({ 
  currentTool, 
  onToolChange, 
  canEdit, 
  onDelete, 
  hasSelection,
  onMermaidImport 
}) => {
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const toolPanelRef = useRef<HTMLDivElement>(null);

  const tools = [
    { id: 'select', icon: '🔍', name: '선택', key: 'V' },
    { id: 'rectangle', icon: '⬜', name: '사각형', key: 'R' },
    { id: 'ellipse', icon: '⭕', name: '원', key: 'O' },
    { id: 'text', icon: '📝', name: '텍스트', key: 'T' },
    { id: 'arrow', icon: '↗️', name: '연결선', key: 'A' },
    { id: 'hand', icon: '🤚', name: '이동', key: 'H' }
  ];

  const calculateTooltipPosition = useCallback((buttonElement: HTMLButtonElement) => {
    const rect = buttonElement.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // Default position: to the right of the button
    let x = rect.right + 8;
    let y = rect.top + rect.height / 2;
    
    // Check if tooltip would go off the right edge (assume max tooltip width of 200px)
    if (x + 200 > viewportWidth) {
      // Position above or below instead
      x = rect.left + rect.width / 2;
      if (rect.top > viewportHeight / 2) {
        // Upper half - show above
        y = rect.top - 8;
      } else {
        // Lower half - show below
        y = rect.bottom + 8;
      }
    }
    
    return { x, y };
  }, []);

  const handleMouseEnter = useCallback((e: React.MouseEvent<HTMLButtonElement>, toolId: string, toolName: string, key: string) => {
    const position = calculateTooltipPosition(e.currentTarget);
    setTooltipPosition(position);
    setActiveTooltip(`${toolName} (${key})`);
  }, [calculateTooltipPosition]);

  const handleMouseLeave = useCallback(() => {
    setActiveTooltip(null);
  }, []);

  // 키보드 단축키 처리
  React.useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // 입력 필드에 포커스가 있을 때는 단축키 비활성화
      if (e.target instanceof HTMLInputElement || 
          e.target instanceof HTMLTextAreaElement) {
        return;
      }
      
      const key = e.key.toLowerCase();
      const toolMap: { [key: string]: string } = {
        'v': 'select',
        'r': 'rectangle',
        'o': 'ellipse',
        't': 'text',
        'a': 'arrow',
        'h': 'hand'
      };
      
      // 도구 변경은 항상 가능 (잠금 여부와 무관)
      if (toolMap[key]) {
        onToolChange(toolMap[key]);
      }
      
      // 삭제 작업은 편집 권한이 있을 때만 가능
      if ((e.key === 'Delete' || e.key === 'Backspace') && hasSelection && canEdit) {
        // Shift + Delete/Backspace = 도형 전체 삭제
        // Delete/Backspace만 = 텍스트만 지우기
        const forceShapeDelete = e.shiftKey;
        onDelete(forceShapeDelete);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [canEdit, hasSelection, onToolChange, onDelete]);

  return (
    <div className="tool-panel" ref={toolPanelRef}>
      <div className="tool-group">
        {tools.map(tool => (
          <button
            key={tool.id}
            className={`tool ${currentTool === tool.id ? 'active' : ''} ${!canEdit && tool.id !== 'select' && tool.id !== 'hand' ? 'disabled' : ''}`}
            onClick={() => onToolChange(tool.id)}
            disabled={!canEdit && tool.id !== 'select' && tool.id !== 'hand'}
            onMouseEnter={(e) => handleMouseEnter(e, tool.id, tool.name, tool.key)}
            onMouseLeave={handleMouseLeave}
          >
            <span className="tool-icon">{tool.icon}</span>
            <span className="tool-shortcut">{tool.key}</span>
          </button>
        ))}
      </div>
      
      <div className="tool-divider"></div>
      
      <div className="tool-group">
        <button
          className={`tool ${!canEdit || !hasSelection ? 'disabled' : ''}`}
          onClick={(e) => {
            // Shift + 클릭 = 도형 전체 삭제, 일반 클릭 = 텍스트만 지우기
            const forceShapeDelete = e.shiftKey;
            onDelete(forceShapeDelete);
          }}
          disabled={!canEdit || !hasSelection}
          onMouseEnter={(e) => handleMouseEnter(e, 'delete', '텍스트 지우기 (Shift+클릭: 도형 삭제)', 'Delete')}
          onMouseLeave={handleMouseLeave}
        >
          <span className="tool-icon">🗑️</span>
          <span className="tool-shortcut">Del</span>
        </button>
      </div>
      
      <div className="tool-divider"></div>
      
      <div className="tool-group">
        <button
          className="tool"
          onClick={onMermaidImport}
          title="Mermaid 가져오기"
        >
          <span className="tool-icon">📊</span>
        </button>
      </div>
      
      {!canEdit && (
        <div className="tool-notice">
          <span>읽기 전용</span>
        </div>
      )}
      
      {/* Smart positioned tooltip */}
      {activeTooltip && (
        <div 
          className="smart-tooltip"
          style={{
            position: 'fixed',
            left: tooltipPosition.x,
            top: tooltipPosition.y,
            transform: tooltipPosition.x > window.innerWidth / 2 ? 'translateX(-100%)' : 'translateY(-50%)',
            zIndex: 10001
          }}
        >
          {activeTooltip}
        </div>
      )}
    </div>
  );
};

export default ToolPanel;