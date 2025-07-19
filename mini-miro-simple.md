# Mini-Miro 간소화 버전 - SQLite 기반

## 시스템 개요
- **단일 서버**: 사내 온프레미스
- **데이터베이스**: SQLite (별도 DB 서버 불필요)
- **인증**: 없음 (사내망 전용)
- **편집**: 한 번에 한 명만 편집 가능

## 간소화된 아키텍처

```
┌─────────────────────────────────────────────────────────────────┐
│                      웹 브라우저 (클라이언트)                      │
│                         React SPA                                │
└─────────────────────────────────────────────────────────────────┘
                                │
                          HTTP / WebSocket
                                │
┌─────────────────────────────────────────────────────────────────┐
│                    단일 서버 (Node.js + Express)                  │
├─────────────────────────────────────────────────────────────────┤
│  • 정적 파일 서빙 (React 빌드 파일)                               │
│  • REST API                                                     │
│  • WebSocket (Socket.io)                                        │
│  • 편집 잠금 관리 (메모리)                                        │
│  • SQLite 데이터베이스                                           │
└─────────────────────────────────────────────────────────────────┘
```

## SQLite 스키마

```sql
-- 다이어그램 테이블
CREATE TABLE diagrams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    type TEXT DEFAULT 'flowchart',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 다이어그램 내용 (JSON 저장)
CREATE TABLE diagram_contents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    diagram_id INTEGER NOT NULL,
    content TEXT NOT NULL, -- JSON 문자열
    version INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (diagram_id) REFERENCES diagrams(id)
);

-- 사용자 정보 (간단한 식별용)
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## 백엔드 구현

### 서버 설정 (server.js)
```javascript
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const port = 3000;

// SQLite 데이터베이스
const db = new sqlite3.Database('./minimiro.db');

// 미들웨어
app.use(express.json());
app.use(express.static(path.join(__dirname, 'client/build')));

// 메모리 기반 잠금 관리
const locks = new Map();

// API 라우트
app.get('/api/diagrams', (req, res) => {
  db.all('SELECT * FROM diagrams ORDER BY updated_at DESC', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get('/api/diagrams/:id', (req, res) => {
  const { id } = req.params;
  
  db.get(
    `SELECT d.*, dc.content 
     FROM diagrams d 
     LEFT JOIN diagram_contents dc ON d.id = dc.diagram_id 
     WHERE d.id = ? 
     ORDER BY dc.version DESC 
     LIMIT 1`,
    [id],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!row) return res.status(404).json({ error: 'Diagram not found' });
      
      res.json({
        ...row,
        content: row.content ? JSON.parse(row.content) : { nodes: [], edges: [] }
      });
    }
  );
});

app.post('/api/diagrams', (req, res) => {
  const { title, description, type = 'flowchart' } = req.body;
  
  db.run(
    'INSERT INTO diagrams (title, description, type) VALUES (?, ?, ?)',
    [title, description, type],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      
      const diagramId = this.lastID;
      const initialContent = JSON.stringify({ nodes: [], edges: [] });
      
      db.run(
        'INSERT INTO diagram_contents (diagram_id, content) VALUES (?, ?)',
        [diagramId, initialContent],
        (err) => {
          if (err) return res.status(500).json({ error: err.message });
          res.json({ id: diagramId, title, description, type });
        }
      );
    }
  );
});

// Socket.io 설정
const server = app.listen(port, () => {
  console.log(`Mini-Miro server running at http://localhost:${port}`);
});

const io = new Server(server, {
  cors: { origin: '*' }
});

// WebSocket 핸들러
io.on('connection', (socket) => {
  let currentDiagram = null;
  let currentUser = null;

  socket.on('identify', (data) => {
    currentUser = data.userName || `User-${socket.id.substr(0, 6)}`;
    console.log(`${currentUser} connected`);
  });

  socket.on('join-diagram', (data) => {
    const { diagramId } = data;
    currentDiagram = diagramId;
    socket.join(`diagram:${diagramId}`);
    
    // 현재 잠금 상태 전송
    const lock = locks.get(diagramId);
    socket.emit('lock-status', {
      locked: !!lock,
      lockedBy: lock?.userName,
      expiresAt: lock?.expiresAt
    });
    
    // 다른 사용자들에게 알림
    socket.to(`diagram:${diagramId}`).emit('user-joined', {
      userName: currentUser
    });
  });

  socket.on('request-lock', (data) => {
    const { diagramId } = data;
    const existingLock = locks.get(diagramId);
    
    // 잠금 확인
    if (existingLock && existingLock.expiresAt > Date.now()) {
      socket.emit('lock-error', { 
        message: `${existingLock.userName}님이 편집 중입니다` 
      });
      return;
    }
    
    // 새 잠금 생성
    const lock = {
      socketId: socket.id,
      userName: currentUser,
      expiresAt: Date.now() + 5 * 60 * 1000 // 5분
    };
    
    locks.set(diagramId, lock);
    
    socket.emit('lock-acquired', { expiresAt: lock.expiresAt });
    socket.to(`diagram:${diagramId}`).emit('lock-status', {
      locked: true,
      lockedBy: currentUser,
      expiresAt: lock.expiresAt
    });
  });

  socket.on('release-lock', (data) => {
    const { diagramId } = data;
    const lock = locks.get(diagramId);
    
    if (lock && lock.socketId === socket.id) {
      locks.delete(diagramId);
      io.to(`diagram:${diagramId}`).emit('lock-released', {
        releasedBy: currentUser
      });
    }
  });

  socket.on('update-diagram', (data) => {
    const { diagramId, changes } = data;
    const lock = locks.get(diagramId);
    
    // 잠금 확인
    if (!lock || lock.socketId !== socket.id) {
      socket.emit('update-error', { message: '편집 권한이 없습니다' });
      return;
    }
    
    // 변경사항 저장
    db.get(
      'SELECT content FROM diagram_contents WHERE diagram_id = ? ORDER BY version DESC LIMIT 1',
      [diagramId],
      (err, row) => {
        if (err) {
          socket.emit('update-error', { message: err.message });
          return;
        }
        
        const currentContent = row ? JSON.parse(row.content) : { nodes: [], edges: [] };
        const newContent = applyChanges(currentContent, changes);
        
        db.run(
          'INSERT INTO diagram_contents (diagram_id, content, version) VALUES (?, ?, ?)',
          [diagramId, JSON.stringify(newContent), (row?.version || 0) + 1],
          (err) => {
            if (err) {
              socket.emit('update-error', { message: err.message });
              return;
            }
            
            // 다른 사용자들에게 브로드캐스트
            socket.to(`diagram:${diagramId}`).emit('diagram-updated', {
              changes,
              updatedBy: currentUser
            });
          }
        );
      }
    );
  });

  socket.on('disconnect', () => {
    // 해당 소켓이 가진 잠금 해제
    for (const [diagramId, lock] of locks.entries()) {
      if (lock.socketId === socket.id) {
        locks.delete(diagramId);
        io.to(`diagram:${diagramId}`).emit('lock-released', {
          releasedBy: currentUser
        });
      }
    }
    
    if (currentDiagram) {
      socket.to(`diagram:${currentDiagram}`).emit('user-left', {
        userName: currentUser
      });
    }
  });
});

// 변경사항 적용 함수
function applyChanges(content, changes) {
  const result = { ...content };
  
  if (changes.nodes) {
    if (changes.nodes.added) {
      result.nodes = [...result.nodes, ...changes.nodes.added];
    }
    if (changes.nodes.updated) {
      result.nodes = result.nodes.map(node => {
        const update = changes.nodes.updated.find(u => u.id === node.id);
        return update ? { ...node, ...update } : node;
      });
    }
    if (changes.nodes.deleted) {
      result.nodes = result.nodes.filter(node => 
        !changes.nodes.deleted.includes(node.id)
      );
    }
  }
  
  if (changes.edges) {
    // 동일한 로직으로 edges 처리
  }
  
  return result;
}

// 데이터베이스 초기화
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS diagrams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      type TEXT DEFAULT 'flowchart',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS diagram_contents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      diagram_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      version INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (diagram_id) REFERENCES diagrams(id)
    )
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
});
```

## 프론트엔드 구현

### 간소화된 App.js
```javascript
import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import DiagramList from './components/DiagramList';
import DiagramCanvas from './components/DiagramCanvas';
import './App.css';

function App() {
  const [socket, setSocket] = useState(null);
  const [userName, setUserName] = useState('');
  const [currentDiagram, setCurrentDiagram] = useState(null);
  const [diagrams, setDiagrams] = useState([]);

  useEffect(() => {
    // 간단한 사용자 이름 설정
    const name = localStorage.getItem('userName') || 
                 prompt('이름을 입력하세요:') || 
                 `User-${Math.random().toString(36).substr(2, 6)}`;
    
    localStorage.setItem('userName', name);
    setUserName(name);

    // Socket 연결
    const newSocket = io('http://localhost:3000');
    newSocket.emit('identify', { userName: name });
    setSocket(newSocket);

    // 다이어그램 목록 로드
    fetch('/api/diagrams')
      .then(res => res.json())
      .then(setDiagrams);

    return () => newSocket.close();
  }, []);

  const createNewDiagram = async () => {
    const title = prompt('다이어그램 제목:');
    if (!title) return;

    const response = await fetch('/api/diagrams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title })
    });

    const newDiagram = await response.json();
    setDiagrams([newDiagram, ...diagrams]);
  };

  const openDiagram = async (id) => {
    const response = await fetch(`/api/diagrams/${id}`);
    const diagram = await response.json();
    setCurrentDiagram(diagram);
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>Mini-Miro</h1>
        <span className="user-name">{userName}</span>
      </header>
      
      {!currentDiagram ? (
        <div className="diagram-list-container">
          <button onClick={createNewDiagram} className="new-diagram-btn">
            새 다이어그램
          </button>
          <DiagramList 
            diagrams={diagrams} 
            onSelect={openDiagram}
          />
        </div>
      ) : (
        <DiagramCanvas
          diagram={currentDiagram}
          socket={socket}
          userName={userName}
          onBack={() => setCurrentDiagram(null)}
        />
      )}
    </div>
  );
}

export default App;
```

### 간소화된 DiagramCanvas.js
```javascript
import React, { useState, useEffect, useRef } from 'react';
import { Stage, Layer, Rect, Text, Line } from 'react-konva';

function DiagramCanvas({ diagram, socket, userName, onBack }) {
  const [nodes, setNodes] = useState(diagram.content?.nodes || []);
  const [edges, setEdges] = useState(diagram.content?.edges || []);
  const [lockStatus, setLockStatus] = useState({ locked: false });
  const [selectedNode, setSelectedNode] = useState(null);
  
  const isLocked = lockStatus.locked && lockStatus.lockedBy === userName;

  useEffect(() => {
    if (!socket) return;

    // 다이어그램 참여
    socket.emit('join-diagram', { diagramId: diagram.id });

    // 이벤트 리스너
    socket.on('lock-status', setLockStatus);
    socket.on('lock-acquired', ({ expiresAt }) => {
      setLockStatus({ locked: true, lockedBy: userName, expiresAt });
    });
    socket.on('lock-released', () => {
      setLockStatus({ locked: false });
    });
    socket.on('diagram-updated', ({ changes }) => {
      applyChanges(changes);
    });

    return () => {
      socket.emit('leave-diagram', { diagramId: diagram.id });
      socket.off('lock-status');
      socket.off('lock-acquired');
      socket.off('lock-released');
      socket.off('diagram-updated');
    };
  }, [socket, diagram.id]);

  const requestLock = () => {
    socket.emit('request-lock', { diagramId: diagram.id });
  };

  const releaseLock = () => {
    socket.emit('release-lock', { diagramId: diagram.id });
  };

  const addNode = (pos) => {
    if (!isLocked) {
      alert('편집하려면 먼저 잠금을 획득하세요');
      return;
    }

    const newNode = {
      id: `node-${Date.now()}`,
      x: pos.x,
      y: pos.y,
      width: 100,
      height: 50,
      text: '새 노드',
      fill: '#e0e0e0'
    };

    setNodes([...nodes, newNode]);
    
    socket.emit('update-diagram', {
      diagramId: diagram.id,
      changes: { nodes: { added: [newNode] } }
    });
  };

  const moveNode = (nodeId, newPos) => {
    if (!isLocked) return;

    setNodes(nodes.map(node =>
      node.id === nodeId ? { ...node, ...newPos } : node
    ));

    socket.emit('update-diagram', {
      diagramId: diagram.id,
      changes: { nodes: { updated: [{ id: nodeId, ...newPos }] } }
    });
  };

  const applyChanges = (changes) => {
    if (changes.nodes?.added) {
      setNodes(prev => [...prev, ...changes.nodes.added]);
    }
    if (changes.nodes?.updated) {
      setNodes(prev => prev.map(node => {
        const update = changes.nodes.updated.find(u => u.id === node.id);
        return update ? { ...node, ...update } : node;
      }));
    }
  };

  return (
    <div className="diagram-canvas">
      <div className="toolbar">
        <button onClick={onBack}>← 목록으로</button>
        <h2>{diagram.title}</h2>
        <div className="lock-controls">
          {lockStatus.locked ? (
            <>
              <span className="lock-status">
                {lockStatus.lockedBy === userName ? '편집 중' : `${lockStatus.lockedBy}님이 편집 중`}
              </span>
              {lockStatus.lockedBy === userName && (
                <button onClick={releaseLock}>잠금 해제</button>
              )}
            </>
          ) : (
            <button onClick={requestLock}>편집 시작</button>
          )}
        </div>
      </div>

      <Stage
        width={window.innerWidth}
        height={window.innerHeight - 60}
        onClick={(e) => {
          if (e.target === e.target.getStage()) {
            const pos = e.target.getStage().getPointerPosition();
            addNode(pos);
          }
        }}
      >
        <Layer>
          {nodes.map(node => (
            <React.Fragment key={node.id}>
              <Rect
                x={node.x}
                y={node.y}
                width={node.width}
                height={node.height}
                fill={node.fill}
                stroke={selectedNode === node.id ? '#0066cc' : '#666'}
                strokeWidth={selectedNode === node.id ? 2 : 1}
                draggable={isLocked}
                onDragEnd={(e) => {
                  moveNode(node.id, { x: e.target.x(), y: e.target.y() });
                }}
                onClick={() => setSelectedNode(node.id)}
              />
              <Text
                x={node.x}
                y={node.y + 20}
                width={node.width}
                text={node.text}
                align="center"
                listening={false}
              />
            </React.Fragment>
          ))}
        </Layer>
      </Stage>
    </div>
  );
}

export default DiagramCanvas;
```

## 실행 방법

### 1. 설치
```bash
# 프로젝트 생성
mkdir mini-miro && cd mini-miro

# 서버 설정
npm init -y
npm install express sqlite3 socket.io

# React 앱 생성
npx create-react-app client
cd client
npm install socket.io-client konva react-konva
```

### 2. 실행
```bash
# 서버 실행 (루트 디렉토리에서)
node server.js

# 개발 모드에서는 별도 터미널에서 React 실행
cd client
npm start
```

### 3. 빌드 및 배포
```bash
# React 빌드
cd client
npm run build

# 서버만 실행하면 됨 (3000번 포트)
node server.js
```

## 특징
- **단순함**: SQLite 파일 하나로 모든 데이터 관리
- **설치 간편**: Node.js만 있으면 실행 가능
- **백업 간편**: SQLite 파일만 백업하면 됨
- **보안 없음**: 사내망 전용으로 인증 불필요
- **가벼움**: 별도 DB 서버나 Redis 불필요

이제 훨씬 간단해졌습니다!