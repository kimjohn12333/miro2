import React from 'react';
import { Node, Edge } from '../types';
import './PropertiesPanel.css';

interface Props {
  selectedNode: Node | null;
  selectedEdge: Edge | null;
  onNodeChange: (nodeId: string, changes: Partial<Node>) => void;
  onEdgeChange: (edgeId: string, changes: Partial<Edge>) => void;
  canEdit: boolean;
}

const PropertiesPanel: React.FC<Props> = ({ selectedNode, selectedEdge, onNodeChange, onEdgeChange, canEdit }) => {
  const colors = [
    '#E3F2FD', '#E8F5E9', '#FFF9C4', '#FFE0B2', '#F3E5F5', '#F5F5F5',
    '#BBDEFB', '#C8E6C9', '#FFF59D', '#FFCCBC', '#E1BEE7', '#E0E0E0',
    '#90CAF9', '#A5D6A7', '#FFF176', '#FFAB91', '#CE93D8', '#BDBDBD'
  ];

  if (!selectedNode && !selectedEdge) {
    return (
      <div className="properties-panel">
        <h3>속성</h3>
        <div className="empty-state">
          <div className="empty-icon">📝</div>
          <p>개체를 선택하면<br />속성을 편집할 수 있습니다</p>
        </div>
      </div>
    );
  }

  if (selectedEdge) {
    return (
      <div className="properties-panel">
        <h3>연결선 속성</h3>
        
        <div className="property-section">
          <div className="property-group">
            <label>레이블</label>
            <div className="text-input-group">
              <input
                type="text"
                value={selectedEdge.label || ''}
                onChange={(e) => onEdgeChange(selectedEdge.id, { label: e.target.value || undefined })}
                disabled={!canEdit}
                placeholder="레이블 텍스트 입력"
                maxLength={30}
              />
              {canEdit && (
                <button
                  className="clear-text-btn"
                  onClick={() => onEdgeChange(selectedEdge.id, { label: undefined })}
                  title="레이블 지우기"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          <div className="property-group">
            <label>선 굵기</label>
            <input
              type="number"
              value={selectedEdge.strokeWidth || 2}
              min="1"
              max="10"
              onChange={(e) => onEdgeChange(selectedEdge.id, { strokeWidth: parseInt(e.target.value) })}
              disabled={!canEdit}
            />
          </div>

          <div className="property-group">
            <label>선 스타일</label>
            <select
              value={selectedEdge.strokeStyle || 'solid'}
              onChange={(e) => onEdgeChange(selectedEdge.id, { strokeStyle: e.target.value as any })}
              disabled={!canEdit}
            >
              <option value="solid">실선</option>
              <option value="dashed">점선</option>
              <option value="dotted">점</option>
            </select>
          </div>

          <div className="property-group">
            <label>연결 형태</label>
            <select
              value={selectedEdge.edgeType || 'straight'}
              onChange={(e) => onEdgeChange(selectedEdge.id, { edgeType: e.target.value as any })}
              disabled={!canEdit}
            >
              <option value="straight">직선</option>
              <option value="curved">곡선</option>
              <option value="orthogonal">꺾은선</option>
            </select>
          </div>

          <div className="property-group">
            <label>화살표</label>
            <div className="checkbox-group">
              <label className="checkbox-option">
                <input
                  type="checkbox"
                  checked={selectedEdge.arrowStart || false}
                  onChange={(e) => onEdgeChange(selectedEdge.id, { arrowStart: e.target.checked })}
                  disabled={!canEdit}
                />
                <span>시작점 화살표</span>
              </label>
              <label className="checkbox-option">
                <input
                  type="checkbox"
                  checked={selectedEdge.arrowEnd || false}
                  onChange={(e) => onEdgeChange(selectedEdge.id, { arrowEnd: e.target.checked })}
                  disabled={!canEdit}
                />
                <span>끝점 화살표</span>
              </label>
            </div>
          </div>

          <div className="property-group">
            <label>색상</label>
            <div className="color-picker">
              <div 
                className="color-swatch current"
                style={{ backgroundColor: selectedEdge.stroke || '#666' }}
              />
              <div className="color-grid">
                {['#666666', '#ff6b35', '#0066cc', '#28a745', '#dc3545', '#6f42c1', '#fd7e14', '#20c997'].map(color => (
                  <button
                    key={color}
                    className="color-swatch"
                    style={{ backgroundColor: color }}
                    onClick={() => onEdgeChange(selectedEdge.id, { stroke: color })}
                    disabled={!canEdit}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
        
        {!canEdit && (
          <div className="edit-notice">
            편집하려면 먼저 잠금을 획득하세요
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="properties-panel">
      <h3>속성</h3>
      
      <div className="property-section">
        <div className="property-group">
          <label>텍스트</label>
          <div className="text-input-group">
            <input
              type="text"
              value={selectedNode?.text ?? ''}
              onChange={(e) => {
                if (selectedNode) {
                  // 빈 문자열도 허용하여 텍스트를 완전히 지울 수 있도록 함
                  onNodeChange(selectedNode.id, { text: e.target.value });
                }
              }}
              disabled={!canEdit}
              placeholder="텍스트 입력"
            />
            {canEdit && (
              <button
                className="clear-text-btn"
                onClick={() => {
                  if (selectedNode) {
                    // 텍스트를 빈 문자열로 완전히 지우기
                    onNodeChange(selectedNode.id, { text: '' });
                  }
                }}
                title="텍스트 지우기"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        <div className="property-group">
          <label>채우기 색상</label>
          <div className="color-picker">
            <div 
              className="color-swatch current"
              style={{ backgroundColor: selectedNode?.fill || '#fff' }}
            />
            <div className="color-grid">
              {colors.map(color => (
                <button
                  key={color}
                  className="color-swatch"
                  style={{ backgroundColor: color }}
                  onClick={() => selectedNode && onNodeChange(selectedNode.id, { fill: color })}
                  disabled={!canEdit}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="property-group">
          <label>테두리</label>
          <div className="border-controls">
            <select
              value={selectedNode?.strokeStyle || 'solid'}
              onChange={(e) => selectedNode && onNodeChange(selectedNode.id, { strokeStyle: e.target.value as any })}
              disabled={!canEdit}
            >
              <option value="solid">실선</option>
              <option value="dashed">점선</option>
              <option value="dotted">점</option>
            </select>
            <input
              type="number"
              value={selectedNode?.strokeWidth || 1}
              min="1"
              max="10"
              onChange={(e) => selectedNode && onNodeChange(selectedNode.id, { strokeWidth: parseInt(e.target.value) })}
              disabled={!canEdit}
            />
          </div>
        </div>

        <div className="property-group">
          <label>크기</label>
          <div className="size-controls">
            <input
              type="number"
              value={selectedNode?.width || 100}
              min="20"
              max="500"
              onChange={(e) => selectedNode && onNodeChange(selectedNode.id, { width: parseInt(e.target.value) })}
              disabled={!canEdit}
            />
            <span>×</span>
            <input
              type="number"
              value={selectedNode?.height || 60}
              min="20"
              max="500"
              onChange={(e) => selectedNode && onNodeChange(selectedNode.id, { height: parseInt(e.target.value) })}
              disabled={!canEdit}
            />
          </div>
        </div>

        <div className="property-group">
          <label>위치</label>
          <div className="position-controls">
            <div className="input-group">
              <span>X:</span>
              <input
                type="number"
                value={Math.round(selectedNode?.x || 0)}
                onChange={(e) => selectedNode && onNodeChange(selectedNode.id, { x: parseInt(e.target.value) })}
                disabled={!canEdit}
              />
            </div>
            <div className="input-group">
              <span>Y:</span>
              <input
                type="number"
                value={Math.round(selectedNode?.y || 0)}
                onChange={(e) => selectedNode && onNodeChange(selectedNode.id, { y: parseInt(e.target.value) })}
                disabled={!canEdit}
              />
            </div>
          </div>
        </div>

        <div className="property-group">
          <label>타입</label>
          <div className="type-indicator">
            <span className="type-badge">
              {selectedNode?.type === 'rectangle' ? '사각형' : 
               selectedNode?.type === 'ellipse' ? '원형' : '텍스트'}
            </span>
          </div>
        </div>
      </div>
      
      {!canEdit && (
        <div className="edit-notice">
          편집하려면 먼저 잠금을 획득하세요
        </div>
      )}
    </div>
  );
};

export default PropertiesPanel;