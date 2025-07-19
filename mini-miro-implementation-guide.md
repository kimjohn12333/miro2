# Mini-Miro 구현 가이드

## 프로젝트 구조

```
mini-miro/
├── client/                 # React 프론트엔드
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   ├── features/
│   │   ├── hooks/
│   │   ├── utils/
│   │   └── App.js
│   └── package.json
├── server/                 # Node.js 백엔드
│   ├── src/
│   │   ├── controllers/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── middleware/
│   │   └── app.js
│   └── package.json
├── database/              # DB 스크립트
│   ├── migrations/
│   └── seeds/
├── docker-compose.yml     # 개발 환경
└── README.md
```

## 백엔드 구현 예제

### 편집 잠금 서비스 (server/src/services/lockService.js)
```javascript
const { v4: uuidv4 } = require('uuid');
const redis = require('../config/redis');
const db = require('../config/database');

class LockService {
  constructor() {
    this.lockDuration = 5 * 60 * 1000; // 5분
    this.extendThreshold = 30 * 1000; // 30초
  }

  async acquireLock(diagramId, userId) {
    const lockKey = `lock:diagram:${diagramId}`;
    
    // 현재 잠금 상태 확인
    const existingLock = await redis.get(lockKey);
    if (existingLock) {
      const lock = JSON.parse(existingLock);
      if (lock.userId !== userId && new Date(lock.expiresAt) > new Date()) {
        throw new Error('Diagram is locked by another user');
      }
    }

    // 새 잠금 생성
    const lockToken = uuidv4();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.lockDuration);
    
    const lock = {
      diagramId,
      userId,
      lockToken,
      lockedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString()
    };

    // Redis에 저장 (TTL 설정)
    await redis.setex(lockKey, this.lockDuration / 1000, JSON.stringify(lock));
    
    // DB에도 기록
    await db.query(
      `INSERT INTO edit_locks (diagram_id, locked_by, locked_at, expires_at, lock_token)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (diagram_id) 
       DO UPDATE SET locked_by = $2, locked_at = $3, expires_at = $4, lock_token = $5`,
      [diagramId, userId, now, expiresAt, lockToken]
    );

    return lock;
  }

  async releaseLock(diagramId, userId, lockToken) {
    const lockKey = `lock:diagram:${diagramId}`;
    const existingLock = await redis.get(lockKey);
    
    if (!existingLock) {
      return false;
    }

    const lock = JSON.parse(existingLock);
    if (lock.userId !== userId || lock.lockToken !== lockToken) {
      throw new Error('Invalid lock token or user');
    }

    // Redis와 DB에서 삭제
    await redis.del(lockKey);
    await db.query('DELETE FROM edit_locks WHERE diagram_id = $1', [diagramId]);
    
    return true;
  }

  async extendLock(diagramId, userId, lockToken) {
    const lockKey = `lock:diagram:${diagramId}`;
    const existingLock = await redis.get(lockKey);
    
    if (!existingLock) {
      throw new Error('Lock not found');
    }

    const lock = JSON.parse(existingLock);
    if (lock.userId !== userId || lock.lockToken !== lockToken) {
      throw new Error('Invalid lock token or user');
    }

    // 잠금 연장
    const newExpiresAt = new Date(Date.now() + this.lockDuration);
    lock.expiresAt = newExpiresAt.toISOString();
    
    await redis.setex(lockKey, this.lockDuration / 1000, JSON.stringify(lock));
    await db.query(
      'UPDATE edit_locks SET expires_at = $1 WHERE diagram_id = $2',
      [newExpiresAt, diagramId]
    );

    return lock;
  }

  async getLockStatus(diagramId) {
    const lockKey = `lock:diagram:${diagramId}`;
    const lock = await redis.get(lockKey);
    
    if (!lock) {
      return { locked: false };
    }

    const lockData = JSON.parse(lock);
    if (new Date(lockData.expiresAt) < new Date()) {
      // 만료된 잠금 정리
      await this.cleanupExpiredLock(diagramId);
      return { locked: false };
    }

    return {
      locked: true,
      lockedBy: lockData.userId,
      expiresAt: lockData.expiresAt
    };
  }

  async cleanupExpiredLock(diagramId) {
    const lockKey = `lock:diagram:${diagramId}`;
    await redis.del(lockKey);
    await db.query('DELETE FROM edit_locks WHERE diagram_id = $1', [diagramId]);
  }
}

module.exports = new LockService();
```

### WebSocket 핸들러 (server/src/services/socketService.js)
```javascript
const socketIO = require('socket.io');
const jwt = require('jsonwebtoken');
const lockService = require('./lockService');
const diagramService = require('./diagramService');

class SocketService {
  constructor(server) {
    this.io = socketIO(server, {
      cors: {
        origin: process.env.CLIENT_URL,
        credentials: true
      }
    });

    this.setupMiddleware();
    this.setupHandlers();
  }

  setupMiddleware() {
    // 인증 미들웨어
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token;
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.userId = decoded.userId;
        socket.userName = decoded.userName;
        next();
      } catch (err) {
        next(new Error('Authentication failed'));
      }
    });
  }

  setupHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`User ${socket.userId} connected`);

      socket.on('join-diagram', async (data) => {
        const { diagramId } = data;
        socket.join(`diagram:${diagramId}`);
        
        // 현재 사용자들에게 알림
        socket.to(`diagram:${diagramId}`).emit('user-joined', {
          userId: socket.userId,
          userName: socket.userName
        });

        // 현재 잠금 상태 전송
        const lockStatus = await lockService.getLockStatus(diagramId);
        socket.emit('lock-status', lockStatus);
      });

      socket.on('leave-diagram', (data) => {
        const { diagramId } = data;
        socket.leave(`diagram:${diagramId}`);
        
        socket.to(`diagram:${diagramId}`).emit('user-left', {
          userId: socket.userId
        });
      });

      socket.on('request-lock', async (data) => {
        const { diagramId } = data;
        try {
          const lock = await lockService.acquireLock(diagramId, socket.userId);
          
          // 요청자에게 잠금 토큰 전송
          socket.emit('lock-acquired', {
            lockToken: lock.lockToken,
            expiresAt: lock.expiresAt
          });

          // 다른 사용자들에게 잠금 상태 알림
          socket.to(`diagram:${diagramId}`).emit('lock-status', {
            locked: true,
            lockedBy: socket.userId,
            expiresAt: lock.expiresAt
          });
        } catch (error) {
          socket.emit('lock-error', { message: error.message });
        }
      });

      socket.on('release-lock', async (data) => {
        const { diagramId, lockToken } = data;
        try {
          await lockService.releaseLock(diagramId, socket.userId, lockToken);
          
          // 모든 사용자에게 잠금 해제 알림
          this.io.to(`diagram:${diagramId}`).emit('lock-released', {
            releasedBy: socket.userId
          });
        } catch (error) {
          socket.emit('lock-error', { message: error.message });
        }
      });

      socket.on('update-diagram', async (data) => {
        const { diagramId, changes, lockToken } = data;
        
        try {
          // 잠금 확인
          const lockStatus = await lockService.getLockStatus(diagramId);
          if (!lockStatus.locked || lockStatus.lockedBy !== socket.userId) {
            throw new Error('No valid lock for this diagram');
          }

          // 변경사항 저장
          await diagramService.updateDiagram(diagramId, changes, socket.userId);
          
          // 다른 사용자들에게 변경사항 브로드캐스트
          socket.to(`diagram:${diagramId}`).emit('diagram-updated', {
            changes,
            updatedBy: socket.userId
          });

          // 잠금 자동 연장 (필요시)
          await lockService.extendLock(diagramId, socket.userId, lockToken);
        } catch (error) {
          socket.emit('update-error', { message: error.message });
        }
      });

      socket.on('disconnect', () => {
        console.log(`User ${socket.userId} disconnected`);
        // 필요시 잠금 해제 로직 추가
      });
    });
  }
}

module.exports = SocketService;
```

## 프론트엔드 구현 예제

### 편집 잠금 Hook (client/src/hooks/useLock.js)
```javascript
import { useState, useEffect, useCallback, useRef } from 'react';
import { useSocket } from './useWebSocket';

export function useLock(diagramId, userId) {
  const [lockStatus, setLockStatus] = useState({
    locked: false,
    lockedBy: null,
    expiresAt: null,
    isMyLock: false
  });
  const [lockToken, setLockToken] = useState(null);
  const socket = useSocket();
  const lockTimerRef = useRef(null);

  // 잠금 상태 업데이트
  useEffect(() => {
    if (!socket) return;

    const handleLockStatus = (status) => {
      setLockStatus({
        ...status,
        isMyLock: status.lockedBy === userId
      });
    };

    const handleLockAcquired = (data) => {
      setLockToken(data.lockToken);
      setLockStatus({
        locked: true,
        lockedBy: userId,
        expiresAt: data.expiresAt,
        isMyLock: true
      });
      
      // 자동 연장 타이머 설정
      startAutoExtend(data.expiresAt);
    };

    const handleLockReleased = () => {
      setLockStatus({
        locked: false,
        lockedBy: null,
        expiresAt: null,
        isMyLock: false
      });
      setLockToken(null);
      stopAutoExtend();
    };

    socket.on('lock-status', handleLockStatus);
    socket.on('lock-acquired', handleLockAcquired);
    socket.on('lock-released', handleLockReleased);

    return () => {
      socket.off('lock-status', handleLockStatus);
      socket.off('lock-acquired', handleLockAcquired);
      socket.off('lock-released', handleLockReleased);
    };
  }, [socket, userId]);

  // 잠금 요청
  const requestLock = useCallback(() => {
    if (socket && diagramId) {
      socket.emit('request-lock', { diagramId });
    }
  }, [socket, diagramId]);

  // 잠금 해제
  const releaseLock = useCallback(() => {
    if (socket && diagramId && lockToken) {
      socket.emit('release-lock', { diagramId, lockToken });
    }
  }, [socket, diagramId, lockToken]);

  // 자동 연장 로직
  const startAutoExtend = (expiresAt) => {
    stopAutoExtend();
    
    const timeUntilExpire = new Date(expiresAt) - new Date();
    const extendTime = timeUntilExpire - 30000; // 만료 30초 전

    if (extendTime > 0) {
      lockTimerRef.current = setTimeout(() => {
        if (socket && lockToken) {
          socket.emit('extend-lock', { diagramId, lockToken });
        }
      }, extendTime);
    }
  };

  const stopAutoExtend = () => {
    if (lockTimerRef.current) {
      clearTimeout(lockTimerRef.current);
      lockTimerRef.current = null;
    }
  };

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      stopAutoExtend();
      if (lockStatus.isMyLock) {
        releaseLock();
      }
    };
  }, []);

  return {
    lockStatus,
    lockToken,
    requestLock,
    releaseLock,
    canEdit: lockStatus.isMyLock
  };
}
```

### 다이어그램 캔버스 컴포넌트 (client/src/components/Canvas/DiagramCanvas.js)
```javascript
import React, { useRef, useEffect, useState } from 'react';
import { Stage, Layer, Rect, Circle, Line, Text } from 'react-konva';
import { useLock } from '../../hooks/useLock';
import { useSocket } from '../../hooks/useWebSocket';
import LockIndicator from '../LockIndicator/LockIndicator';

function DiagramCanvas({ diagramId, userId, initialData = {} }) {
  const [nodes, setNodes] = useState(initialData.nodes || []);
  const [edges, setEdges] = useState(initialData.edges || []);
  const [selectedNode, setSelectedNode] = useState(null);
  
  const { lockStatus, lockToken, requestLock, releaseLock, canEdit } = useLock(diagramId, userId);
  const socket = useSocket();
  const stageRef = useRef();

  // 실시간 업데이트 수신
  useEffect(() => {
    if (!socket) return;

    const handleDiagramUpdate = ({ changes }) => {
      if (changes.nodes) {
        setNodes(prevNodes => applyNodeChanges(prevNodes, changes.nodes));
      }
      if (changes.edges) {
        setEdges(prevEdges => applyEdgeChanges(prevEdges, changes.edges));
      }
    };

    socket.on('diagram-updated', handleDiagramUpdate);
    return () => socket.off('diagram-updated', handleDiagramUpdate);
  }, [socket]);

  // 노드 추가
  const addNode = (pos) => {
    if (!canEdit) {
      alert('다이어그램을 편집하려면 먼저 잠금을 획득하세요.');
      return;
    }

    const newNode = {
      id: `node-${Date.now()}`,
      type: 'rectangle',
      x: pos.x,
      y: pos.y,
      width: 100,
      height: 50,
      text: 'New Node',
      fill: '#ddd'
    };

    setNodes([...nodes, newNode]);
    emitChange({ nodes: { added: [newNode] } });
  };

  // 노드 이동
  const moveNode = (nodeId, newPos) => {
    if (!canEdit) return;

    setNodes(nodes.map(node => 
      node.id === nodeId ? { ...node, x: newPos.x, y: newPos.y } : node
    ));

    emitChange({ 
      nodes: { 
        updated: [{ id: nodeId, x: newPos.x, y: newPos.y }] 
      } 
    });
  };

  // 변경사항 전송
  const emitChange = (changes) => {
    if (socket && lockToken) {
      socket.emit('update-diagram', {
        diagramId,
        changes,
        lockToken
      });
    }
  };

  // 스테이지 클릭 핸들러
  const handleStageClick = (e) => {
    const pos = e.target.getStage().getPointerPosition();
    
    if (e.target === e.target.getStage()) {
      if (canEdit) {
        addNode(pos);
      }
      setSelectedNode(null);
    }
  };

  return (
    <div className="diagram-canvas-container">
      <LockIndicator 
        lockStatus={lockStatus}
        onRequestLock={requestLock}
        onReleaseLock={releaseLock}
      />
      
      <Stage
        ref={stageRef}
        width={window.innerWidth}
        height={window.innerHeight - 100}
        onClick={handleStageClick}
        className={canEdit ? 'editable' : 'readonly'}
      >
        <Layer>
          {/* 엣지 렌더링 */}
          {edges.map(edge => (
            <Line
              key={edge.id}
              points={calculateEdgePoints(edge, nodes)}
              stroke="#999"
              strokeWidth={2}
            />
          ))}
          
          {/* 노드 렌더링 */}
          {nodes.map(node => (
            <NodeComponent
              key={node.id}
              node={node}
              isSelected={selectedNode === node.id}
              canEdit={canEdit}
              onMove={(newPos) => moveNode(node.id, newPos)}
              onClick={() => setSelectedNode(node.id)}
            />
          ))}
        </Layer>
      </Stage>
    </div>
  );
}

// 노드 컴포넌트
function NodeComponent({ node, isSelected, canEdit, onMove, onClick }) {
  const handleDragEnd = (e) => {
    if (canEdit) {
      onMove({ x: e.target.x(), y: e.target.y() });
    }
  };

  return (
    <>
      <Rect
        x={node.x}
        y={node.y}
        width={node.width}
        height={node.height}
        fill={node.fill}
        stroke={isSelected ? '#0066cc' : '#666'}
        strokeWidth={isSelected ? 3 : 1}
        draggable={canEdit}
        onDragEnd={handleDragEnd}
        onClick={onClick}
        cornerRadius={5}
      />
      <Text
        x={node.x}
        y={node.y + node.height / 2 - 8}
        width={node.width}
        text={node.text}
        align="center"
        listening={false}
      />
    </>
  );
}

export default DiagramCanvas;
```

## 배포 스크립트

### Docker Compose (개발 환경)
```yaml
version: '3.8'

services:
  postgres:
    image: postgres:14
    environment:
      POSTGRES_DB: minimiro
      POSTGRES_USER: minimiro
      POSTGRES_PASSWORD: minimiro123
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:6-alpine
    ports:
      - "6379:6379"

  server:
    build: ./server
    environment:
      NODE_ENV: development
      DATABASE_URL: postgresql://minimiro:minimiro123@postgres:5432/minimiro
      REDIS_URL: redis://redis:6379
      JWT_SECRET: your-secret-key
      CLIENT_URL: http://localhost:3000
    volumes:
      - ./server:/app
      - /app/node_modules
    ports:
      - "5000:5000"
    depends_on:
      - postgres
      - redis

  client:
    build: ./client
    environment:
      REACT_APP_API_URL: http://localhost:5000
      REACT_APP_WS_URL: ws://localhost:5000
    volumes:
      - ./client:/app
      - /app/node_modules
    ports:
      - "3000:3000"

volumes:
  postgres_data:
```

### 프로덕션 배포 스크립트 (deploy.sh)
```bash
#!/bin/bash

# 환경 변수 설정
export NODE_ENV=production
export PM2_HOME=/var/pm2

# 코드 업데이트
cd /opt/mini-miro
git pull origin main

# 의존성 설치 및 빌드
cd client
npm ci
npm run build

cd ../server
npm ci

# 데이터베이스 마이그레이션
npm run db:migrate

# 정적 파일 복사
cp -r ../client/build/* /var/www/mini-miro/

# Nginx 재시작
sudo systemctl reload nginx

# PM2로 서버 재시작
pm2 reload mini-miro

echo "Deployment completed successfully!"
```

이 설계는 사내 단일 서버 환경에 최적화되어 있으며, 편집 잠금 메커니즘을 통해 안정적인 협업을 지원합니다.