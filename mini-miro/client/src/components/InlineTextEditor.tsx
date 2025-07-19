import React, { useState, useEffect, useRef } from 'react';
import './InlineTextEditor.css';

interface Props {
  x: number;
  y: number;
  value: string;
  onSave: (value: string) => void;
  onCancel: () => void;
  placeholder?: string;
  maxLength?: number;
}

const InlineTextEditor: React.FC<Props> = ({
  x,
  y,
  value,
  onSave,
  onCancel,
  placeholder = "Enter text...",
  maxLength = 50
}) => {
  const [text, setText] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Focus input when component mounts
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, []);

  const handleSave = () => {
    onSave(text);
  };

  const handleCancel = () => {
    onCancel();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation(); // Prevent stage events
    
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  };

  const handleBlur = () => {
    // Save when clicking outside
    handleSave();
  };

  return (
    <div 
      className="inline-text-editor"
      style={{
        position: 'absolute',
        left: x - 60, // Center the input
        top: y - 12,  // Center vertically
        zIndex: 10000
      }}
    >
      <input
        ref={inputRef}
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        placeholder={placeholder}
        maxLength={maxLength}
        className="inline-input"
      />
      <div className="input-actions">
        <button 
          className="action-btn save" 
          onClick={handleSave}
          title="Save (Enter)"
        >
          ✓
        </button>
        <button 
          className="action-btn cancel" 
          onClick={handleCancel}
          title="Cancel (Esc)"
        >
          ✕
        </button>
      </div>
    </div>
  );
};

export default InlineTextEditor;