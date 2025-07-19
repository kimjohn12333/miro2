# Mini-Miro System Architecture - 사내 단일 서버 버전

## 시스템 개요
- **배포 환경**: 사내 단일 서버 (온프레미스)
- **클라이언트**: 웹 브라우저 전용
- **편집 방식**: 단일 사용자 편집 (잠금 기반)
- **데이터베이스**: 서버 내장 DB

## 간소화된 아키텍처

```
┌─────────────────────────────────────────────────────────────────┐
│                      웹 브라우저 (클라이언트)                      │
│                         React SPA                                │
└─────────────────────────────────────────────────────────────────┘
                                │
                          HTTPS / WebSocket
                                │
┌─────────────────────────────────────────────────────────────────┐
│                        단일 서버 (On-Premise)                     │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    Nginx (Reverse Proxy)                 │   │
│  │              - Static File Serving (React App)          │   │
│  │              - API Routing                              │   │
│  │              - WebSocket Proxy                          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                 Node.js Application Server               │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │  • REST API (Express.js)                                │   │
│  │  • WebSocket Server (Socket.io)                         │   │
│  │  • 편집 잠금 관리 (Lock Manager)                          │   │
│  │  • 세션 관리                                            │   │
│  │  • 비즈니스 로직                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    데이터 저장소                          │   │
│  ├─────────────────────┬───────────────────────────────────┤   │
│  │     PostgreSQL      │        Redis (Optional)           │   │
│  │   - 사용자 정보      │      - 세션 캐시                  │   │
│  │   - 다이어그램 데이터 │      - 잠금 상태                  │   │
│  │   - 권한 정보        │      - 임시 데이터                 │   │
│  │   - 버전 이력        │                                  │   │
│  └─────────────────────┴───────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    파일 시스템                            │   │
│  │              - 내보내기 파일 임시 저장                     │   │
│  │              - 첨부 파일 저장                            │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## 핵심 기능 설계

### 1. 편집 잠금 시스템
```javascript
// 편집 잠금 메커니즘
{
  diagramId: "diagram-uuid",
  lockedBy: "user-id",
  lockedAt: "2024-01-20T10:00:00Z",
  expiresAt: "2024-01-20T10:05:00Z", // 5분 자동 해제
  lockToken: "unique-lock-token"
}
```

### 2. 실시간 뷰어 업데이트
- 편집자: 다이어그램 수정 권한
- 뷰어: 실시간 변경사항 확인만 가능
- WebSocket을 통한 변경사항 브로드캐스트

### 3. 데이터 모델

#### PostgreSQL 스키마
```sql
-- 사용자 테이블
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL, -- 'admin', 'editor', 'viewer'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 다이어그램 테이블
CREATE TABLE diagrams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(50) NOT NULL, -- 'flowchart', 'er', 'mindmap'
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_deleted BOOLEAN DEFAULT FALSE
);

-- 다이어그램 내용 (JSON 저장)
CREATE TABLE diagram_contents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    diagram_id UUID REFERENCES diagrams(id) ON DELETE CASCADE,
    content JSONB NOT NULL, -- 노드, 엣지, 스타일 등
    version INTEGER NOT NULL DEFAULT 1,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 편집 잠금 테이블
CREATE TABLE edit_locks (
    diagram_id UUID PRIMARY KEY REFERENCES diagrams(id) ON DELETE CASCADE,
    locked_by UUID REFERENCES users(id),
    locked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    lock_token VARCHAR(255) UNIQUE NOT NULL
);

-- 권한 테이블
CREATE TABLE permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    diagram_id UUID REFERENCES diagrams(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    permission_type VARCHAR(50) NOT NULL, -- 'view', 'edit', 'admin'
    granted_by UUID REFERENCES users(id),
    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(diagram_id, user_id)
);
```

### 4. API 설계

#### REST API 엔드포인트
```yaml
# 인증
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/auth/me

# 다이어그램
GET    /api/diagrams              # 목록 조회
POST   /api/diagrams              # 새 다이어그램 생성
GET    /api/diagrams/:id          # 다이어그램 조회
PUT    /api/diagrams/:id          # 다이어그램 수정
DELETE /api/diagrams/:id          # 다이어그램 삭제

# 편집 잠금
POST   /api/diagrams/:id/lock     # 편집 잠금 획득
DELETE /api/diagrams/:id/lock     # 편집 잠금 해제
GET    /api/diagrams/:id/lock     # 잠금 상태 확인

# 버전 관리
GET    /api/diagrams/:id/versions # 버전 목록
GET    /api/diagrams/:id/versions/:version # 특정 버전 조회
POST   /api/diagrams/:id/restore/:version  # 버전 복원

# 내보내기
POST   /api/diagrams/:id/export   # 다이어그램 내보내기

# 권한 관리
GET    /api/diagrams/:id/permissions
POST   /api/diagrams/:id/permissions
DELETE /api/diagrams/:id/permissions/:userId
```

#### WebSocket 이벤트
```javascript
// 클라이언트 → 서버
socket.emit('join-diagram', { diagramId, token });
socket.emit('leave-diagram', { diagramId });
socket.emit('request-lock', { diagramId });
socket.emit('release-lock', { diagramId });
socket.emit('update-diagram', { diagramId, changes, lockToken });

// 서버 → 클라이언트
socket.emit('lock-status', { locked, lockedBy, expiresAt });
socket.emit('diagram-updated', { changes, updatedBy });
socket.emit('user-joined', { userId, userName });
socket.emit('user-left', { userId });
socket.emit('lock-acquired', { lockToken, expiresAt });
socket.emit('lock-released', { releasedBy });
```

### 5. 프론트엔드 구조

```
src/
├── components/
│   ├── Canvas/          # 다이어그램 캔버스
│   ├── Toolbar/         # 도구 모음
│   ├── Sidebar/         # 속성 패널
│   └── LockIndicator/   # 잠금 상태 표시
├── features/
│   ├── auth/           # 인증 관련
│   ├── diagram/        # 다이어그램 CRUD
│   ├── collaboration/  # 실시간 협업
│   └── export/         # 내보내기 기능
├── hooks/
│   ├── useLock.js      # 편집 잠금 관리
│   ├── useWebSocket.js # WebSocket 연결
│   └── useDiagram.js   # 다이어그램 상태
└── utils/
    ├── api.js          # API 클라이언트
    └── diagram.js      # 다이어그램 유틸리티
```

### 6. 보안 설계

#### 인증 및 권한
- JWT 기반 인증
- 역할 기반 접근 제어 (RBAC)
- 다이어그램별 세부 권한 설정

#### 보안 고려사항
- HTTPS 필수
- SQL Injection 방지 (Prepared Statements)
- XSS 방지 (입력값 검증)
- CSRF 토큰 사용
- Rate Limiting

### 7. 배포 및 운영

#### 시스템 요구사항
- **OS**: Ubuntu 20.04 LTS / CentOS 8
- **CPU**: 4 Core 이상
- **RAM**: 16GB 이상
- **Storage**: 100GB SSD
- **Node.js**: 18.x LTS
- **PostgreSQL**: 14.x
- **Redis**: 6.x (선택사항)

#### 설치 스크립트
```bash
#!/bin/bash
# 의존성 설치
sudo apt update
sudo apt install -y nodejs npm postgresql nginx redis-server

# 애플리케이션 설치
git clone https://github.com/company/mini-miro.git
cd mini-miro
npm install
npm run build

# 환경 설정
cp .env.example .env
# .env 파일 수정

# 데이터베이스 초기화
npm run db:migrate
npm run db:seed

# 서비스 시작
npm run start:prod
```

#### 모니터링
- PM2를 통한 프로세스 관리
- 로그 수집 및 분석
- 성능 메트릭 수집
- 에러 알림 설정

### 8. 성능 최적화

#### 캔버스 렌더링
- Virtual scrolling
- Canvas element pooling
- Debounced updates
- WebGL 가속 (선택사항)

#### 데이터 최적화
- 변경사항만 전송 (Delta updates)
- 데이터 압축 (gzip)
- 캐싱 전략
- 인덱싱 최적화

#### 확장성 고려사항
- 향후 다중 서버 확장 가능한 구조
- 데이터베이스 샤딩 준비
- 마이크로서비스 전환 가능한 모듈화