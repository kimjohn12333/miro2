# Mini-Miro Docker 컨테이너화 가이드

## 📋 개요

Mini-Miro 다이어그램 앱의 Docker 컨테이너화 설계 및 운영 가이드입니다.

## 🏗️ 아키텍처

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Nginx Proxy   │    │   React Client  │    │  Node.js API    │
│   (Port 80)     │◄───┤   (Port 3000)   │◄───┤   (Port 5000)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
          │                       │                       │
          ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Load Balance   │    │   Static Files  │    │  SQLite Volume  │
│  SSL Terminate  │    │   Hot Reload    │    │  Data Persist   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🚀 빠른 시작

### 개발 환경

```bash
# 개발 환경 시작
./scripts/dev.sh start

# 로그 확인
./scripts/dev.sh logs

# 종료
./scripts/dev.sh stop
```

### 프로덕션 배포

```bash
# 환경 설정
cp .env.example .env
# .env 파일 수정 필요

# 프로덕션 배포
./scripts/deploy.sh
```

## 📦 서비스 구성

### Frontend (React + Nginx)
- **개발**: Hot reload 지원, 포트 3000
- **프로덕션**: Nginx 정적 서빙, 포트 80
- **기능**: React Router 지원, API 프록시, 정적 자산 캐싱

### Backend (Node.js + Express)
- **API**: RESTful API 및 Socket.IO
- **데이터베이스**: SQLite with 볼륨 지속성
- **모니터링**: 헬스체크 및 로깅

### 네트워크 및 볼륨
- **네트워크**: 격리된 브리지 네트워크
- **볼륨**: 데이터베이스 지속성, 로그 저장
- **백업**: 자동 일일 백업 서비스

## 🛠️ 개발 환경

### 로컬 개발 시작
```bash
# 의존성 설치
./scripts/dev.sh install

# 개발 서버 시작 (Hot Reload)
./scripts/dev.sh start
```

### 접근 URL
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000
- **Database Viewer**: http://localhost:8080
- **Debug Port**: 9229

### 테스트 실행
```bash
# 테스트 실행
./scripts/dev.sh test

# 특정 서비스 로그
./scripts/dev.sh logs frontend
./scripts/dev.sh logs backend
```

## 🚀 프로덕션 배포

### 사전 요구사항
- Docker Engine 20.10+
- Docker Compose 2.0+
- 80/443 포트 사용 가능

### 배포 과정
1. **환경 설정**: `.env` 파일 구성
2. **백업 생성**: 기존 데이터 자동 백업
3. **이미지 빌드**: 최적화된 프로덕션 빌드
4. **서비스 배포**: 무중단 배포
5. **헬스체크**: 자동 상태 확인

### 환경 변수
```bash
# 필수 설정
NODE_ENV=production
PORT=5000
DB_PATH=/app/data/minimiro.db

# 보안 설정
SESSION_SECRET=your-secure-session-secret
JWT_SECRET=your-secure-jwt-secret
CORS_ORIGIN=https://yourdomain.com
```

## 🔧 운영 관리

### 컨테이너 상태 확인
```bash
# 프로덕션 상태
docker-compose -f docker-compose.prod.yml ps

# 개발 상태
./scripts/dev.sh status
```

### 로그 관리
```bash
# 실시간 로그
docker-compose -f docker-compose.prod.yml logs -f

# 특정 서비스 로그
docker-compose -f docker-compose.prod.yml logs backend
```

### 데이터베이스 관리
```bash
# 데이터베이스 백업
docker run --rm \
  -v mini-miro-database:/data:ro \
  -v $(pwd)/backups:/backup \
  alpine:latest \
  cp /data/minimiro.db /backup/manual-backup-$(date +%Y%m%d).db

# 데이터베이스 복원
docker run --rm \
  -v mini-miro-database:/data \
  -v $(pwd)/backups:/backup \
  alpine:latest \
  cp /backup/your-backup.db /data/minimiro.db
```

## 🔍 모니터링 및 진단

### 헬스체크
- **Backend**: `GET /health` (30초 간격)
- **Frontend**: HTTP 200 응답 확인
- **자동 재시작**: 3회 실패시 컨테이너 재시작

### 성능 모니터링
```bash
# 리소스 사용량
docker stats

# 컨테이너 상세 정보
docker inspect mini-miro-frontend
docker inspect mini-miro-backend
```

### 문제 해결
```bash
# 컨테이너 재시작
docker-compose -f docker-compose.prod.yml restart

# 로그 확인
docker-compose -f docker-compose.prod.yml logs --tail=100

# 컨테이너 내부 접근
docker exec -it mini-miro-backend sh
```

## 🔒 보안 고려사항

### 컨테이너 보안
- 비루트 사용자 실행 (nodejs 사용자)
- 최소 권한 원칙 적용
- 보안 헤더 자동 설정 (Nginx)

### 네트워크 보안
- 격리된 Docker 네트워크
- 필요한 포트만 외부 노출
- CORS 설정 및 리버스 프록시

### 데이터 보안
- 볼륨을 통한 데이터 지속성
- 자동 백업 및 보관 정책
- 환경 변수를 통한 민감정보 관리

## 📈 확장성 고려사항

### 수평 확장
- Load Balancer 추가 (Nginx, HAProxy)
- Database 클러스터링 (PostgreSQL 마이그레이션)
- Redis 세션 스토어

### 수직 확장
- 리소스 제한 설정
- 메모리 및 CPU 최적화
- 캐싱 전략 구현

## 🚨 운영 중 주의사항

1. **데이터베이스**: SQLite는 단일 연결 제한이 있으므로 고부하시 PostgreSQL 고려
2. **로그**: 로그 로테이션 설정으로 디스크 용량 관리
3. **백업**: 정기적인 백업 테스트 수행
4. **모니터링**: 자원 사용량 및 응답시간 모니터링 필수
5. **보안**: 정기적인 이미지 업데이트 및 취약점 스캔

## 📞 지원

문제 발생시 다음 정보와 함께 문의:
- Docker 및 Docker Compose 버전
- 운영 체제 정보
- 에러 로그 (docker-compose logs)
- 컨테이너 상태 (docker-compose ps)