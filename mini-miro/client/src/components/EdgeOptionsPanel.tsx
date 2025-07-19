import React, { useState } from 'react';
import './EdgeOptionsPanel.css';

interface EdgeOptions {
  strokeWidth: number;
  strokeStyle: 'solid' | 'dashed' | 'dotted';
  edgeType: 'straight' | 'curved' | 'orthogonal';
  arrowStart: boolean;
  arrowEnd: boolean;
  stroke: string;
}

interface Props {
  isVisible: boolean;
  options: EdgeOptions;
  onOptionsChange: (options: EdgeOptions) => void;
  onClose: () => void;
}

const EdgeOptionsPanel: React.FC<Props> = ({ 
  isVisible, 
  options, 
  onOptionsChange, 
  onClose 
}) => {
  const [localOptions, setLocalOptions] = useState<EdgeOptions>(options);

  const handleOptionChange = (key: keyof EdgeOptions, value: any) => {
    const newOptions = { ...localOptions, [key]: value };
    setLocalOptions(newOptions);
    onOptionsChange(newOptions);
  };

  const colorOptions = [
    { value: '#666666', name: '기본 회색' },
    { value: '#ff6b35', name: '주황' },
    { value: '#0066cc', name: '파랑' },
    { value: '#28a745', name: '초록' },
    { value: '#dc3545', name: '빨강' },
    { value: '#6f42c1', name: '보라' },
    { value: '#fd7e14', name: '주황색' },
    { value: '#20c997', name: '청록' }
  ];

  if (!isVisible) return null;

  return (
    <div className="edge-options-overlay" onClick={onClose}>
      <div className="edge-options-panel" onClick={e => e.stopPropagation()}>
        <div className="edge-options-header">
          <h3>연결선 스타일</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        
        <div className="options-content">
          {/* 선 굵기 */}
          <div className="option-group">
            <label>선 굵기</label>
            <div className="stroke-width-options">
              {[1, 2, 3, 4, 6, 8].map(width => (
                <button
                  key={width}
                  className={`stroke-option ${localOptions.strokeWidth === width ? 'active' : ''}`}
                  onClick={() => handleOptionChange('strokeWidth', width)}
                >
                  <div 
                    className="stroke-preview" 
                    style={{ 
                      height: `${width}px`,
                      backgroundColor: localOptions.stroke 
                    }}
                  />
                  <span>{width}px</span>
                </button>
              ))}
            </div>
          </div>

          {/* 선 스타일 */}
          <div className="option-group">
            <label>선 스타일</label>
            <div className="stroke-style-options">
              <button
                className={`style-option ${localOptions.strokeStyle === 'solid' ? 'active' : ''}`}
                onClick={() => handleOptionChange('strokeStyle', 'solid')}
              >
                <div className="style-preview solid" />
                실선
              </button>
              <button
                className={`style-option ${localOptions.strokeStyle === 'dashed' ? 'active' : ''}`}
                onClick={() => handleOptionChange('strokeStyle', 'dashed')}
              >
                <div className="style-preview dashed" />
                점선
              </button>
              <button
                className={`style-option ${localOptions.strokeStyle === 'dotted' ? 'active' : ''}`}
                onClick={() => handleOptionChange('strokeStyle', 'dotted')}
              >
                <div className="style-preview dotted" />
                점점선
              </button>
            </div>
          </div>

          {/* 연결선 타입 */}
          <div className="option-group">
            <label>연결 형태</label>
            <div className="edge-type-options">
              <button
                className={`type-option ${localOptions.edgeType === 'straight' ? 'active' : ''}`}
                onClick={() => handleOptionChange('edgeType', 'straight')}
              >
                <svg width="40" height="20" viewBox="0 0 40 20">
                  <line x1="2" y1="10" x2="38" y2="10" stroke="currentColor" strokeWidth="2" />
                </svg>
                직선
              </button>
              <button
                className={`type-option ${localOptions.edgeType === 'curved' ? 'active' : ''}`}
                onClick={() => handleOptionChange('edgeType', 'curved')}
              >
                <svg width="40" height="20" viewBox="0 0 40 20">
                  <path d="M2,10 Q20,2 38,10" stroke="currentColor" strokeWidth="2" fill="none" />
                </svg>
                곡선
              </button>
              <button
                className={`type-option ${localOptions.edgeType === 'orthogonal' ? 'active' : ''}`}
                onClick={() => handleOptionChange('edgeType', 'orthogonal')}
              >
                <svg width="40" height="20" viewBox="0 0 40 20">
                  <path d="M2,10 L18,10 L18,6 L22,6 L22,10 L38,10" stroke="currentColor" strokeWidth="2" fill="none" />
                </svg>
                꺾은선
              </button>
            </div>
          </div>

          {/* 화살표 옵션 */}
          <div className="option-group">
            <label>화살표</label>
            <div className="arrow-options">
              <label className="checkbox-option">
                <input
                  type="checkbox"
                  checked={localOptions.arrowStart}
                  onChange={(e) => handleOptionChange('arrowStart', e.target.checked)}
                />
                <span>시작점 화살표</span>
              </label>
              <label className="checkbox-option">
                <input
                  type="checkbox"
                  checked={localOptions.arrowEnd}
                  onChange={(e) => handleOptionChange('arrowEnd', e.target.checked)}
                />
                <span>끝점 화살표</span>
              </label>
            </div>
          </div>

          {/* 색상 선택 */}
          <div className="option-group">
            <label>색상</label>
            <div className="color-options">
              {colorOptions.map(color => (
                <button
                  key={color.value}
                  className={`color-option ${localOptions.stroke === color.value ? 'active' : ''}`}
                  style={{ backgroundColor: color.value }}
                  onClick={() => handleOptionChange('stroke', color.value)}
                  title={color.name}
                />
              ))}
            </div>
          </div>
        </div>
        
        <div className="options-footer">
          <button className="btn-secondary" onClick={onClose}>
            완료
          </button>
        </div>
      </div>
    </div>
  );
};

export default EdgeOptionsPanel;