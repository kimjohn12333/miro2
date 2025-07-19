# Mini-Miro 화이트보드 UX 디자인

## 1. 디자인 원칙

### 핵심 가치
- **직관성**: 별도 학습 없이 즉시 사용 가능
- **단순함**: 필수 기능에 집중
- **효율성**: 최소 클릭으로 작업 완료
- **시각적 명확성**: 현재 상태를 한눈에 파악

## 2. 레이아웃 구조

```
┌────────────────────────────────────────────────────────────────┐
│  헤더 (60px)                                                    │
│  ┌─────────┬──────────────────────┬──────────────────────┐    │
│  │  로고   │   다이어그램 제목      │   사용자/잠금 상태    │    │
│  └─────────┴──────────────────────┴──────────────────────┘    │
├────────────────────────────────────────────────────────────────┤
│  ┌─────────┬──────────────────────────────────┬──────────┐    │
│  │         │                                   │          │    │
│  │  도구   │                                   │  속성    │    │
│  │  패널   │         캔버스 영역                │  패널    │    │
│  │  (80px) │      (무한 스크롤)                │ (280px)  │    │
│  │         │                                   │          │    │
│  │         │                                   │          │    │
│  └─────────┴──────────────────────────────────┴──────────┘    │
├────────────────────────────────────────────────────────────────┤
│  하단 바 (40px)                                                 │
│  ┌──────────────┬─────────────────┬──────────────────────┐    │
│  │  줌 컨트롤    │   미니맵        │    좌표/가이드        │    │
│  └──────────────┴─────────────────┴──────────────────────┘    │
└────────────────────────────────────────────────────────────────┘
```

## 3. 주요 UI 컴포넌트

### 헤더 영역
```html
<header class="app-header">
  <div class="header-left">
    <button class="btn-back">← 목록</button>
    <h1 class="diagram-title" contenteditable>제목 없음</h1>
  </div>
  
  <div class="header-center">
    <div class="auto-save-indicator">
      <span class="status-dot"></span>
      <span>자동 저장됨</span>
    </div>
  </div>
  
  <div class="header-right">
    <div class="user-presence">
      <div class="user-avatar">김</div>
      <span>김철수</span>
    </div>
    
    <div class="lock-control">
      <button class="btn-lock">
        <svg><!-- 잠금 아이콘 --></svg>
        편집 시작
      </button>
    </div>
  </div>
</header>
```

### 도구 패널
```html
<div class="tool-panel">
  <div class="tool-group">
    <button class="tool active" data-tool="select">
      <svg><!-- 선택 도구 --></svg>
      <span class="tooltip">선택 (V)</span>
    </button>
    
    <button class="tool" data-tool="rectangle">
      <svg><!-- 사각형 --></svg>
      <span class="tooltip">사각형 (R)</span>
    </button>
    
    <button class="tool" data-tool="ellipse">
      <svg><!-- 원 --></svg>
      <span class="tooltip">원 (O)</span>
    </button>
    
    <button class="tool" data-tool="text">
      <svg><!-- 텍스트 --></svg>
      <span class="tooltip">텍스트 (T)</span>
    </button>
    
    <button class="tool" data-tool="connector">
      <svg><!-- 연결선 --></svg>
      <span class="tooltip">연결선 (C)</span>
    </button>
  </div>
  
  <div class="tool-divider"></div>
  
  <div class="tool-group">
    <button class="tool" data-tool="hand">
      <svg><!-- 손 도구 --></svg>
      <span class="tooltip">이동 (H)</span>
    </button>
    
    <button class="tool" data-tool="zoom">
      <svg><!-- 확대 --></svg>
      <span class="tooltip">확대/축소 (Z)</span>
    </button>
  </div>
</div>
```

### 속성 패널
```html
<div class="properties-panel">
  <h3>속성</h3>
  
  <!-- 노드 선택 시 -->
  <div class="property-section" v-if="selectedNode">
    <div class="property-group">
      <label>텍스트</label>
      <input type="text" v-model="selectedNode.text" />
    </div>
    
    <div class="property-group">
      <label>채우기</label>
      <div class="color-picker">
        <button class="color-swatch" 
                :style="{background: selectedNode.fill}">
        </button>
        <input type="text" v-model="selectedNode.fill" />
      </div>
    </div>
    
    <div class="property-group">
      <label>테두리</label>
      <div class="border-controls">
        <select v-model="selectedNode.strokeStyle">
          <option value="solid">실선</option>
          <option value="dashed">점선</option>
          <option value="dotted">점</option>
        </select>
        <input type="number" 
               v-model="selectedNode.strokeWidth" 
               min="1" max="10" />
      </div>
    </div>
    
    <div class="property-group">
      <label>크기</label>
      <div class="size-controls">
        <input type="number" v-model="selectedNode.width" />
        <span>×</span>
        <input type="number" v-model="selectedNode.height" />
      </div>
    </div>
  </div>
  
  <!-- 아무것도 선택 안됨 -->
  <div class="empty-state" v-else>
    <p>개체를 선택하면 속성을 편집할 수 있습니다</p>
  </div>
</div>
```

## 4. 인터랙션 패턴

### 기본 인터랙션
```javascript
// 도구 선택
const TOOLS = {
  SELECT: 'select',
  RECTANGLE: 'rectangle',
  ELLIPSE: 'ellipse',
  TEXT: 'text',
  CONNECTOR: 'connector',
  HAND: 'hand',
  ZOOM: 'zoom'
};

// 키보드 단축키
const SHORTCUTS = {
  'v': TOOLS.SELECT,
  'r': TOOLS.RECTANGLE,
  'o': TOOLS.ELLIPSE,
  't': TOOLS.TEXT,
  'c': TOOLS.CONNECTOR,
  'h': TOOLS.HAND,
  'z': TOOLS.ZOOM,
  'Delete': 'delete',
  'Cmd+Z': 'undo',
  'Cmd+Y': 'redo',
  'Cmd+C': 'copy',
  'Cmd+V': 'paste',
  'Cmd+D': 'duplicate'
};

// 마우스 인터랙션
const MOUSE_ACTIONS = {
  click: 'select or create',
  drag: 'move or draw',
  doubleClick: 'edit text',
  rightClick: 'context menu',
  wheel: 'zoom',
  'space+drag': 'pan canvas'
};
```

### 편집 상태 표시
```css
/* 편집 가능 상태 */
.canvas.editable {
  cursor: crosshair;
}

.canvas.editable .node {
  cursor: move;
}

.canvas.editable .node:hover {
  outline: 2px solid #0066cc;
  outline-offset: 2px;
}

/* 읽기 전용 상태 */
.canvas.readonly {
  cursor: default;
  position: relative;
}

.canvas.readonly::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.5);
  pointer-events: none;
}

/* 편집 중 표시 */
.lock-indicator {
  position: fixed;
  top: 80px;
  right: 20px;
  background: #4CAF50;
  color: white;
  padding: 8px 16px;
  border-radius: 20px;
  display: flex;
  align-items: center;
  gap: 8px;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.8; }
}
```

## 5. 디자인 시스템

### 색상 팔레트
```css
:root {
  /* Primary Colors */
  --primary-blue: #0066cc;
  --primary-hover: #0052a3;
  
  /* Neutral Colors */
  --gray-900: #1a1a1a;
  --gray-700: #4a4a4a;
  --gray-500: #7a7a7a;
  --gray-300: #d4d4d4;
  --gray-100: #f5f5f5;
  --white: #ffffff;
  
  /* Semantic Colors */
  --success: #4CAF50;
  --warning: #FF9800;
  --error: #F44336;
  --info: #2196F3;
  
  /* Node Colors */
  --node-blue: #E3F2FD;
  --node-green: #E8F5E9;
  --node-yellow: #FFF9C4;
  --node-orange: #FFE0B2;
  --node-purple: #F3E5F5;
  --node-gray: #F5F5F5;
}
```

### 타이포그래피
```css
:root {
  --font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 
                 'Noto Sans KR', sans-serif;
  
  --text-xs: 12px;
  --text-sm: 14px;
  --text-base: 16px;
  --text-lg: 18px;
  --text-xl: 20px;
}
```

### 간격 시스템
```css
:root {
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --spacing-xl: 32px;
}
```

## 6. 반응형 디자인

### 브레이크포인트
```css
/* 태블릿 (768px - 1024px) */
@media (max-width: 1024px) {
  .properties-panel {
    position: absolute;
    right: -280px;
    transition: transform 0.3s ease;
  }
  
  .properties-panel.open {
    transform: translateX(-280px);
  }
}

/* 모바일은 지원하지 않음 - 최소 768px 필요 */
@media (max-width: 768px) {
  body::before {
    content: '화면이 너무 작습니다. 태블릿이나 PC에서 사용해주세요.';
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: white;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
  }
}
```

## 7. 접근성 고려사항

### 키보드 네비게이션
- Tab 키로 모든 UI 요소 접근 가능
- 화살표 키로 노드 이동 (선택 시)
- Enter 키로 텍스트 편집 모드 진입
- Esc 키로 편집 모드 종료

### 스크린 리더 지원
```html
<div role="application" aria-label="다이어그램 편집기">
  <canvas role="img" 
          aria-label="다이어그램 캔버스"
          aria-describedby="canvas-description">
  </canvas>
  <div id="canvas-description" class="sr-only">
    현재 3개의 노드와 2개의 연결선이 있습니다.
  </div>
</div>
```

### 색상 대비
- 모든 텍스트는 WCAG AA 기준 충족
- 색맹 사용자를 위한 패턴/아이콘 병행 사용

## 8. 애니메이션 및 트랜지션

### 부드러운 전환
```css
/* 노드 이동 */
.node {
  transition: transform 0.15s ease-out;
}

/* 도구 선택 */
.tool {
  transition: background-color 0.2s ease,
              transform 0.1s ease;
}

.tool:active {
  transform: scale(0.95);
}

/* 연결선 그리기 */
.connector {
  stroke-dasharray: 1000;
  stroke-dashoffset: 1000;
  animation: draw 0.3s ease-out forwards;
}

@keyframes draw {
  to {
    stroke-dashoffset: 0;
  }
}
```

## 9. 성능 최적화

### 렌더링 최적화
- Virtual DOM diffing으로 최소 업데이트
- 뷰포트 외부 요소는 렌더링 제외
- 이미지는 lazy loading
- 60fps 유지를 위한 requestAnimationFrame 사용

### 메모리 관리
- 삭제된 요소는 즉시 메모리에서 제거
- 대용량 다이어그램을 위한 가상화
- 이벤트 리스너 정리

이 디자인은 사용자가 학습 없이도 즉시 사용할 수 있는 직관적인 화이트보드 경험을 제공합니다.