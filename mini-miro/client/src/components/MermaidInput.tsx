import React, { useState, useCallback } from 'react';
import { mermaidParser } from '../utils/mermaidParser';
import { Node, Edge } from '../types';
import './MermaidInput.css';

interface Props {
  onImport: (nodes: Node[], edges: Edge[]) => void;
  onClose: () => void;
}

const MermaidInput: React.FC<Props> = ({ onImport, onClose }) => {
  const [mermaidText, setMermaidText] = useState(`graph TD
    A[시작] --> B{조건 확인}
    B -->|Yes| C[프로세스 1]
    B -->|No| D[프로세스 2]
    C --> E[종료]
    D --> E`);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ nodes: Node[], edges: Edge[] } | null>(null);

  const handleParse = useCallback(() => {
    try {
      const result = mermaidParser.parse(mermaidText);
      setPreview(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '파싱 오류가 발생했습니다');
      setPreview(null);
    }
  }, [mermaidText]);

  const handleImport = useCallback(() => {
    if (preview) {
      onImport(preview.nodes, preview.edges);
      onClose();
    }
  }, [preview, onImport, onClose]);

  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMermaidText(e.target.value);
    setError(null);
    setPreview(null);
  }, []);

  const examples = [
    {
      name: '플로우차트',
      code: `graph TD
    A[시작] --> B{조건 확인}
    B -->|Yes| C[프로세스 1]
    B -->|No| D[프로세스 2]
    C --> E[종료]
    D --> E`
    },
    {
      name: '시퀀스',
      code: `graph LR
    A[사용자] --> B[시스템]
    B --> C[데이터베이스]
    C --> B
    B --> A`
    },
    {
      name: '프로세스',
      code: `graph TD
    Start((시작)) --> Input[입력 받기]
    Input --> Process{처리}
    Process -->|성공| Output[결과 출력]
    Process -->|실패| Error[에러 처리]
    Output --> End((종료))
    Error --> End`
    }
  ];

  return (
    <div className="mermaid-input-overlay">
      <div className="mermaid-input-container">
        <div className="mermaid-input-header">
          <h2>Mermaid 다이어그램 가져오기</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="mermaid-input-content">
          <div className="mermaid-input-section">
            <h3>Mermaid 코드 입력</h3>
            <div className="examples-bar">
              <span>예제:</span>
              {examples.map((example, index) => (
                <button
                  key={index}
                  className="example-btn"
                  onClick={() => setMermaidText(example.code)}
                >
                  {example.name}
                </button>
              ))}
            </div>
            <textarea
              value={mermaidText}
              onChange={handleTextChange}
              placeholder="Mermaid 문법을 입력하세요..."
              className="mermaid-textarea"
              spellCheck={false}
            />
            {error && (
              <div className="error-message">
                ⚠️ {error}
              </div>
            )}
          </div>

          <div className="mermaid-preview-section">
            <h3>미리보기</h3>
            <div className="preview-area">
              {preview ? (
                <div className="preview-stats">
                  <p>✅ 파싱 성공!</p>
                  <p>노드: {preview.nodes.length}개</p>
                  <p>연결선: {preview.edges.length}개</p>
                </div>
              ) : (
                <p className="preview-placeholder">
                  파싱 버튼을 클릭하면 미리보기가 표시됩니다
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="mermaid-input-footer">
          <button className="cancel-btn" onClick={onClose}>
            취소
          </button>
          <button className="parse-btn" onClick={handleParse}>
            파싱
          </button>
          <button 
            className="import-btn" 
            onClick={handleImport}
            disabled={!preview}
          >
            가져오기
          </button>
        </div>

        <div className="mermaid-help">
          <h4>지원되는 문법:</h4>
          <ul>
            <li><code>graph TD</code> - 위에서 아래로</li>
            <li><code>graph LR</code> - 왼쪽에서 오른쪽으로</li>
            <li><code>A[텍스트]</code> - 사각형 노드</li>
            <li><code>A((텍스트))</code> - 원형 노드</li>
            <li><code>A{'{'}텍스트{'}'}</code> - 다이아몬드 노드</li>
            <li><code>A --{'>'} B</code> - 화살표 연결</li>
            <li><code>A --{'>'} |레이블| B</code> - 레이블이 있는 화살표</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default MermaidInput;