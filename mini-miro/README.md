# Mini-Miro - 사내 협업용 다이어그램 툴

간단하고 직관적인 화이트보드 스타일의 다이어그램 협업 도구입니다.

## 주요 특징

- 🎨 **직관적인 UI**: 배우기 쉬운 화이트보드 인터페이스
- 🔒 **편집 잠금**: 한 번에 한 명만 편집 가능한 안전한 협업
- ⚡ **실시간 동기화**: WebSocket 기반 실시간 업데이트
- 💾 **자동 저장**: 변경사항 즉시 저장
- 📱 **반응형**: 태블릿까지 지원하는 반응형 디자인

## 기술 스택

### 백엔드
- **Node.js** + **Express.js**: 웹 서버
- **Socket.io**: 실시간 통신
- **SQLite**: 경량 데이터베이스
- **CORS**: 크로스 오리진 지원

### 프론트엔드
- **React 18** + **TypeScript**: UI 프레임워크
- **React Konva**: 캔버스 렌더링
- **Socket.io Client**: 실시간 통신

## 설치 및 실행

### 1. 의존성 설치
```bash
# 루트 디렉토리에서
npm run install:all
```

### 2. 개발 서버 실행
```bash
# 개발 모드 (서버 + 클라이언트 동시 실행)
npm run dev
```

### 3. 프로덕션 빌드
```bash
# 클라이언트 빌드
npm run build

# 프로덕션 서버 실행
npm start
```

## 사용법

### 1. 다이어그램 생성
- "새 다이어그램" 버튼을 클릭하여 다이어그램을 생성합니다.

### 2. 편집 시작
- 다이어그램을 열고 "편집 시작" 버튼을 클릭합니다.
- 한 번에 한 명만 편집할 수 있습니다.

### 3. 도구 사용
- **선택 도구 (V)**: 개체 선택 및 이동
- **사각형 (R)**: 사각형 노드 생성
- **원 (O)**: 원형 노드 생성
- **이동 (H)**: 캔버스 이동

### 4. 속성 편집
- 노드를 선택하면 우측 패널에서 속성을 편집할 수 있습니다.
- 텍스트, 색상, 크기, 위치 등을 조정할 수 있습니다.

### 5. 키보드 단축키
- `V`: 선택 도구
- `R`: 사각형 도구
- `O`: 원 도구
- `H`: 이동 도구
- `Delete`: 선택된 개체 삭제
- `마우스 휠`: 줌 인/아웃

## 프로젝트 구조

```
mini-miro/
├── server/                 # 백엔드 서버
│   ├── server.js           # 메인 서버 파일
│   └── package.json        # 서버 의존성
├── client/                 # React 프론트엔드
│   ├── src/
│   │   ├── components/     # React 컴포넌트
│   │   ├── types.ts        # TypeScript 타입 정의
│   │   └── App.tsx         # 메인 앱 컴포넌트
│   └── package.json        # 클라이언트 의존성
├── package.json            # 루트 스크립트
└── README.md
```

## API 엔드포인트

### REST API
- `GET /api/diagrams` - 다이어그램 목록 조회
- `POST /api/diagrams` - 새 다이어그램 생성
- `GET /api/diagrams/:id` - 다이어그램 상세 조회
- `DELETE /api/diagrams/:id` - 다이어그램 삭제

### WebSocket 이벤트
- `identify` - 사용자 식별
- `join-diagram` - 다이어그램 참여
- `request-lock` - 편집 잠금 요청
- `release-lock` - 편집 잠금 해제
- `update-diagram` - 다이어그램 업데이트

## 데이터베이스 스키마

### diagrams 테이블
```sql
CREATE TABLE diagrams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    type TEXT DEFAULT 'flowchart',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### diagram_contents 테이블
```sql
CREATE TABLE diagram_contents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    diagram_id INTEGER NOT NULL,
    content TEXT NOT NULL,  -- JSON 형태
    version INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (diagram_id) REFERENCES diagrams(id)
);
```

## 환경 변수

### 서버 (.env)
```
PORT=5000
NODE_ENV=production
```

### 클라이언트 (.env)
```
REACT_APP_API_URL=http://localhost:5000
```

## 시스템 요구사항

- **Node.js**: 16.x 이상
- **브라우저**: Chrome, Firefox, Safari, Edge (최신 버전)
- **화면**: 최소 768px 이상 (태블릿)

## 배포

### 단일 서버 배포
1. 서버에 코드 업로드
2. `npm run install:all` 실행
3. `npm run build` 실행
4. `npm start` 실행
5. 포트 5000으로 접속

### PM2 배포
```bash
# PM2 설치
npm install -g pm2

# 애플리케이션 시작
pm2 start server/server.js --name mini-miro

# 부팅시 자동 시작 설정
pm2 startup
pm2 save
```

## 문제 해결

### 자주 발생하는 문제

1. **포트 충돌**: 다른 애플리케이션이 5000번 포트를 사용 중인 경우
   ```bash
   lsof -ti:5000 | xargs kill -9
   ```

2. **의존성 설치 오류**: 캐시 삭제 후 재설치
   ```bash
   npm cache clean --force
   npm run install:all
   ```

3. **WebSocket 연결 실패**: 방화벽 또는 프록시 설정 확인

## 라이선스

MIT License

## 기여하기

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request