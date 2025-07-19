import React from 'react';
import { Diagram } from '../types';
import './DiagramList.css';

interface Props {
  diagrams: Diagram[];
  onOpen: (id: number) => void;
  onDelete: (id: number) => void;
}

const DiagramList: React.FC<Props> = ({ diagrams, onOpen, onDelete }) => {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR') + ' ' + date.toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (diagrams.length === 0) {
    return (
      <div className="diagram-list-empty">
        <div className="empty-state">
          <div className="empty-icon">📋</div>
          <h3>아직 다이어그램이 없습니다</h3>
          <p>새 다이어그램을 만들어 시작해보세요!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="diagram-list">
      <div className="diagram-grid">
        {diagrams.map((diagram) => (
          <div key={diagram.id} className="diagram-card">
            <div className="diagram-preview">
              <div className="preview-placeholder">
                <span className="preview-icon">📊</span>
              </div>
            </div>
            
            <div className="diagram-info">
              <h3 className="diagram-title">{diagram.title}</h3>
              {diagram.description && (
                <p className="diagram-description">{diagram.description}</p>
              )}
              <div className="diagram-meta">
                <span className="diagram-type">{diagram.type}</span>
                <span className="diagram-date">
                  {formatDate(diagram.updated_at)}
                </span>
              </div>
            </div>
            
            <div className="diagram-actions">
              <button 
                className="btn-open"
                onClick={() => onOpen(diagram.id)}
              >
                열기
              </button>
              <button 
                className="btn-delete"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(diagram.id);
                }}
              >
                삭제
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DiagramList;