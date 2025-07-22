const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: ["http://localhost:3000", "http://localhost:3003"],
    methods: ["GET", "POST"],
    credentials: true
  },
  allowEIO3: true,
  transports: ['polling', 'websocket']
});

const PORT = process.env.PORT || 3003;

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0',
    database: 'connected'
  });
});

// 미들웨어
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client/build')));

// SQLite 데이터베이스 초기화
const dbPath = process.env.DB_PATH || './minimiro.db';
console.log(`Using database path: ${dbPath}`);
const db = new sqlite3.Database(dbPath);

// 테이블 생성
db.serialize(() => {
  // 다이어그램 테이블
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

  // 다이어그램 내용 테이블
  db.run(`
    CREATE TABLE IF NOT EXISTS diagram_contents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      diagram_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      version INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (diagram_id) REFERENCES diagrams(id) ON DELETE CASCADE
    )
  `);

  // 사용자 테이블
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 샘플 데이터 삽입
  db.get("SELECT COUNT(*) as count FROM diagrams", (err, row) => {
    if (row.count === 0) {
      db.run(
        "INSERT INTO diagrams (title, description) VALUES (?, ?)",
        ["샘플 다이어그램", "테스트용 다이어그램입니다"],
        function(err) {
          if (!err) {
            const sampleContent = JSON.stringify({
              nodes: [
                {
                  id: 'node-1',
                  x: 100,
                  y: 100,
                  width: 120,
                  height: 60,
                  text: '시작',
                  fill: '#E3F2FD',
                  type: 'rectangle'
                },
                {
                  id: 'node-2',
                  x: 300,
                  y: 100,
                  width: 120,
                  height: 60,
                  text: '처리',
                  fill: '#E8F5E9',
                  type: 'rectangle'
                }
              ],
              edges: [
                {
                  id: 'edge-1',
                  from: 'node-1',
                  to: 'node-2',
                  points: [220, 130, 300, 130]
                }
              ]
            });
            
            db.run(
              "INSERT INTO diagram_contents (diagram_id, content) VALUES (?, ?)",
              [this.lastID, sampleContent]
            );
          }
        }
      );
    }
  });
});

// 메모리 기반 잠금 관리
const locks = new Map();
const connectedUsers = new Map();

// API 라우트
// 다이어그램 목록 조회
app.get('/api/diagrams', (req, res) => {
  db.all(
    'SELECT * FROM diagrams ORDER BY updated_at DESC',
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json(rows);
    }
  );
});

// 다이어그램 상세 조회
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
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (!row) {
        return res.status(404).json({ error: 'Diagram not found' });
      }
      
      res.json({
        ...row,
        content: row.content ? JSON.parse(row.content) : { nodes: [], edges: [] }
      });
    }
  );
});

// 새 다이어그램 생성
app.post('/api/diagrams', (req, res) => {
  const { title, description, type = 'flowchart' } = req.body;
  
  if (!title) {
    return res.status(400).json({ error: 'Title is required' });
  }
  
  db.run(
    'INSERT INTO diagrams (title, description, type) VALUES (?, ?, ?)',
    [title, description, type],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      const diagramId = this.lastID;
      const initialContent = JSON.stringify({ nodes: [], edges: [] });
      
      db.run(
        'INSERT INTO diagram_contents (diagram_id, content) VALUES (?, ?)',
        [diagramId, initialContent],
        (err) => {
          if (err) {
            return res.status(500).json({ error: err.message });
          }
          res.json({ 
            id: diagramId, 
            title, 
            description, 
            type,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        }
      );
    }
  );
});

// 다이어그램 삭제
app.delete('/api/diagrams/:id', (req, res) => {
  const { id } = req.params;
  
  db.run('DELETE FROM diagrams WHERE id = ?', [id], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Diagram not found' });
    }
    res.json({ message: 'Diagram deleted successfully' });
  });
});

// Socket.io 연결 처리
io.on('connection', (socket) => {
  console.log('🔗 [Server] New socket connection:', socket.id, 'at', new Date().toISOString());
  
  let currentUser = null;
  let currentDiagram = null;

  // 사용자 식별
  socket.on('identify', (data) => {
    currentUser = data.userName || `User-${socket.id.substr(0, 6)}`;
    connectedUsers.set(socket.id, currentUser);
    console.log('👤 [Server] User identified:', currentUser, 'socket:', socket.id);
  });

  // 다이어그램 참여
  socket.on('join-diagram', (data) => {
    const { diagramId } = data;
    currentDiagram = diagramId;
    socket.join(`diagram:${diagramId}`);
    
    console.log('📥 [Server] User', currentUser, 'joined diagram', diagramId);
    
    // 현재 잠금 상태 전송
    const lock = locks.get(diagramId);
    const lockStatus = {
      locked: !!lock && lock.expiresAt > Date.now(),
      lockedBy: lock?.userName,
      expiresAt: lock?.expiresAt
    };
    
    console.log('📤 [Server] Sending lock-status to user:', currentUser, 'status:', lockStatus);
    socket.emit('lock-status', lockStatus);
    
    // 다른 사용자들에게 알림
    socket.to(`diagram:${diagramId}`).emit('user-joined', {
      userName: currentUser
    });
  });

  // 다이어그램 나가기
  socket.on('leave-diagram', (data) => {
    const { diagramId } = data;
    socket.leave(`diagram:${diagramId}`);
    
    socket.to(`diagram:${diagramId}`).emit('user-left', {
      userName: currentUser
    });
  });

  // 편집 잠금 요청
  socket.on('request-lock', (data) => {
    console.log('🔐 [Server] Received request-lock event from:', currentUser, 'socket:', socket.id);
    console.log('📋 [Server] Request data:', data);
    
    const { diagramId } = data;
    const existingLock = locks.get(diagramId);
    
    console.log('🔍 [Server] Checking existing lock for diagram:', diagramId);
    console.log('🔒 [Server] Existing lock:', existingLock);
    
    // 기존 잠금 확인
    if (existingLock && existingLock.expiresAt > Date.now()) {
      console.log('❌ [Server] Lock already exists, sending lock-error to:', currentUser);
      socket.emit('lock-error', { 
        message: `${existingLock.userName}님이 편집 중입니다` 
      });
      return;
    }
    
    // 새 잠금 생성 (5분)
    const lock = {
      socketId: socket.id,
      userName: currentUser,
      expiresAt: Date.now() + 5 * 60 * 1000
    };
    
    console.log('✅ [Server] Creating new lock:', lock);
    locks.set(diagramId, lock);
    
    console.log('🎉 [Server] Lock acquired by:', currentUser, 'for diagram:', diagramId);
    
    console.log('📤 [Server] Sending lock-acquired to requesting user:', currentUser);
    socket.emit('lock-acquired', { expiresAt: lock.expiresAt });
    
    console.log('📢 [Server] Broadcasting lock-status to other users in diagram:', diagramId);
    socket.to(`diagram:${diagramId}`).emit('lock-status', {
      locked: true,
      lockedBy: currentUser,
      expiresAt: lock.expiresAt
    });
    
    // 자동 해제 타이머
    setTimeout(() => {
      const currentLock = locks.get(diagramId);
      if (currentLock && currentLock.socketId === socket.id) {
        console.log('⏰ [Server] Auto-releasing lock for:', currentUser, 'diagram:', diagramId);
        locks.delete(diagramId);
        io.to(`diagram:${diagramId}`).emit('lock-released', {
          releasedBy: currentUser
        });
      }
    }, 5 * 60 * 1000);
  });

  // 편집 잠금 해제
  socket.on('release-lock', (data) => {
    const { diagramId } = data;
    const lock = locks.get(diagramId);
    
    if (lock && lock.socketId === socket.id) {
      locks.delete(diagramId);
      console.log(`${currentUser} released lock for diagram ${diagramId}`);
      
      io.to(`diagram:${diagramId}`).emit('lock-released', {
        releasedBy: currentUser
      });
    }
  });

  // 다이어그램 업데이트
  socket.on('update-diagram', (data) => {
    const { diagramId, changes } = data;
    const lock = locks.get(diagramId);
    
    // 잠금 확인
    if (!lock || lock.socketId !== socket.id || lock.expiresAt < Date.now()) {
      socket.emit('update-error', { message: '편집 권한이 없습니다' });
      return;
    }
    
    // 현재 내용 조회
    db.get(
      'SELECT content, version FROM diagram_contents WHERE diagram_id = ? ORDER BY version DESC LIMIT 1',
      [diagramId],
      (err, row) => {
        if (err) {
          socket.emit('update-error', { message: err.message });
          return;
        }
        
        const currentContent = row ? JSON.parse(row.content) : { nodes: [], edges: [] };
        const newContent = applyChanges(currentContent, changes);
        const newVersion = (row?.version || 0) + 1;
        
        // 새 버전 저장
        db.run(
          'INSERT INTO diagram_contents (diagram_id, content, version) VALUES (?, ?, ?)',
          [diagramId, JSON.stringify(newContent), newVersion],
          (err) => {
            if (err) {
              socket.emit('update-error', { message: err.message });
              return;
            }
            
            // 다이어그램 updated_at 갱신
            db.run(
              'UPDATE diagrams SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
              [diagramId]
            );
            
            console.log(`${currentUser} updated diagram ${diagramId}`);
            
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

  // 연결 해제
  socket.on('disconnect', () => {
    console.log('🔌 [Server] Socket disconnected:', socket.id, 'user:', currentUser, 'at:', new Date().toISOString());
    
    // 해당 소켓이 가진 잠금 해제
    for (const [diagramId, lock] of locks.entries()) {
      if (lock.socketId === socket.id) {
        locks.delete(diagramId);
        io.to(`diagram:${diagramId}`).emit('lock-released', {
          releasedBy: currentUser
        });
      }
    }
    
    // 다이어그램에서 나가기 알림
    if (currentDiagram) {
      socket.to(`diagram:${currentDiagram}`).emit('user-left', {
        userName: currentUser
      });
    }
    
    connectedUsers.delete(socket.id);
  });
});

// 변경사항 적용 함수
function applyChanges(content, changes) {
  const result = { ...content };
  
  if (changes.nodes) {
    result.nodes = [...(result.nodes || [])];
    
    if (changes.nodes.added) {
      result.nodes.push(...changes.nodes.added);
    }
    
    if (changes.nodes.updated) {
      changes.nodes.updated.forEach(update => {
        const index = result.nodes.findIndex(node => node.id === update.id);
        if (index !== -1) {
          result.nodes[index] = { ...result.nodes[index], ...update };
        }
      });
    }
    
    if (changes.nodes.deleted) {
      result.nodes = result.nodes.filter(node => 
        !changes.nodes.deleted.includes(node.id)
      );
    }
  }
  
  if (changes.edges) {
    result.edges = [...(result.edges || [])];
    
    if (changes.edges.added) {
      result.edges.push(...changes.edges.added);
    }
    
    if (changes.edges.updated) {
      changes.edges.updated.forEach(update => {
        const index = result.edges.findIndex(edge => edge.id === update.id);
        if (index !== -1) {
          result.edges[index] = { ...result.edges[index], ...update };
        }
      });
    }
    
    if (changes.edges.deleted) {
      result.edges = result.edges.filter(edge => 
        !changes.edges.deleted.includes(edge.id)
      );
    }
  }
  
  return result;
}

// React 앱 서빙 (프로덕션)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/build', 'index.html'));
});

// 서버 시작
server.listen(PORT, () => {
  console.log(`FlowChart Studio server running on port ${PORT}`);
});

// 정리 함수
process.on('SIGINT', () => {
  console.log('\nShutting down gracefully...');
  db.close((err) => {
    if (err) {
      console.error(err.message);
    }
    console.log('Database connection closed.');
    process.exit(0);
  });
});