# Mini-Miro All-in-One Dockerfile 가이드

## 🐳 완전한 컨테이너화 솔루션

Mini-Miro 다이어그램 앱의 모든 의존성을 포함하는 완전한 Docker 컨테이너 구현

## 📋 아키텍처 특징

### 🏗️ Multi-Stage Build
```dockerfile
Stage 1: Frontend Build (React) → Optimized Production Bundle
Stage 2: Backend Dependencies → Cleaned Node Modules  
Stage 3: Production Runtime → Secure Runtime Environment
```

### 🔒 보안 강화
- **비루트 실행**: appuser/appgroup (UID/GID: 1001)
- **최소 권한**: 필요한 권한만 부여
- **신호 처리**: dumb-init으로 좀비 프로세스 방지
- **보안 헤더**: 프로덕션 보안 설정

### ⚡ 성능 최적화
- **이미지 크기**: Multi-stage로 90% 크기 감소
- **종속성 정리**: 불필요한 파일 제거
- **캐시 활용**: 레이어 캐싱 최적화
- **메모리 제한**: 512MB 최적화

## 🚀 사용 방법

### 빠른 시작
```bash
# 빌드 및 배포 (자동화)
./scripts/docker-build.sh

# 수동 빌드
docker build -t mini-miro:latest .

# 실행
docker-compose up -d
```

### 개발 환경
```bash
# 개발 모드로 실행 (볼륨 마운트)
docker run -d \
  -p 3003:3003 \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/logs:/app/logs \
  -e NODE_ENV=development \
  mini-miro:latest
```

## 🔧 구성 요소

### 📂 파일 구조
```
mini-miro/
├── Dockerfile              # 메인 올인원 Dockerfile
├── docker-compose.yml      # 프로덕션 컴포즈
├── docker-entrypoint.sh    # 초기화 스크립트
├── .dockerignore           # 빌드 최적화
├── scripts/
│   └── docker-build.sh     # 빌드/배포 자동화
└── DOCKERFILE_GUIDE.md     # 이 가이드
```

### 🌐 서비스 구성
- **메인 앱**: React Frontend + Node.js Backend
- **데이터베이스**: SQLite (볼륨 지속성)
- **백업**: 자동 일일 백업 서비스
- **모니터링**: 헬스체크 및 로깅

## 📊 접근 정보

### 🔗 URL
- **애플리케이션**: http://localhost:3003
- **헬스체크**: http://localhost:3003/health
- **API**: http://localhost:3003/api/diagrams

### 📁 데이터 위치
- **데이터베이스**: `/app/data/minimiro.db`
- **로그**: `/app/logs/`
- **백업**: `./backups/`

## 🛠️ 고급 설정

### 환경 변수
```bash
NODE_ENV=production          # 실행 환경
PORT=3003                   # 서비스 포트
DB_PATH=/app/data/minimiro.db # 데이터베이스 경로
LOG_LEVEL=info              # 로그 레벨
NODE_OPTIONS=--max-old-space-size=512 # 메모리 제한
```

### 볼륨 마운트
```yaml
volumes:
  - mini-miro-data:/app/data    # 데이터 지속성
  - mini-miro-logs:/app/logs    # 로그 지속성
  - ./backups:/app/backups      # 백업 폴더
```

### 네트워크 설정
```yaml
networks:
  mini-miro-network:
    driver: bridge
    subnet: 172.21.0.0/16
```

## 🏥 헬스체크 및 모니터링

### 자동 헬스체크
- **간격**: 30초마다 실행
- **타임아웃**: 10초
- **재시도**: 3회 실패시 재시작
- **시작 대기**: 40초

### 모니터링 명령어
```bash
# 컨테이너 상태 확인
docker-compose ps

# 로그 확인
docker-compose logs -f mini-miro

# 리소스 사용량
docker stats mini-miro-app

# 헬스체크 테스트
curl http://localhost:3003/health
```

## 🔍 트러블슈팅

### 일반적인 문제

**1. 포트 충돌**
```bash
# 포트 변경
docker run -p 8080:3003 mini-miro:latest
```

**2. 권한 문제**
```bash
# 데이터 디렉토리 권한 확인
sudo chown -R 1001:1001 ./data
```

**3. 메모리 부족**
```bash
# 메모리 제한 증가
docker run -e NODE_OPTIONS="--max-old-space-size=1024" mini-miro:latest
```

**4. 데이터베이스 락**
```bash
# 데이터베이스 재시작
docker-compose restart mini-miro
```

### 로그 분석
```bash
# 애플리케이션 로그
docker exec mini-miro-app cat /app/logs/app.log

# 에러 로그
docker exec mini-miro-app cat /app/logs/error.log

# 실시간 로그
docker logs -f mini-miro-app
```

## 🚀 배포 시나리오

### 개발 환경
```bash
# 볼륨 마운트로 라이브 개발
docker run -d \
  -p 3003:3003 \
  -v $(pwd):/app \
  -e NODE_ENV=development \
  mini-miro:latest
```

### 스테이징 환경
```bash
# 환경별 컴포즈 파일
docker-compose -f docker-compose.yml -f docker-compose.staging.yml up -d
```

### 프로덕션 환경
```bash
# 완전 자동화 배포
./scripts/docker-build.sh build-deploy
```

## 🔄 업데이트 및 유지보수

### 이미지 업데이트
```bash
# 새 버전 빌드
docker build -t mini-miro:v2.0.0 .

# 무중단 업데이트
docker-compose up -d --no-deps mini-miro
```

### 백업 관리
```bash
# 수동 백업
docker exec mini-miro-backup cp /data/minimiro.db /backups/manual-backup-$(date +%Y%m%d).db

# 백업 복원
docker exec mini-miro-app cp /app/backups/your-backup.db /app/data/minimiro.db
docker-compose restart mini-miro
```

### 정리 작업
```bash
# 사용하지 않는 이미지 정리
docker system prune -f

# 볼륨 정리 (주의!)
docker volume prune -f
```

## 📈 성능 튜닝

### 리소스 제한
```yaml
deploy:
  resources:
    limits:
      memory: 512M
      cpus: '0.5'
    reservations:
      memory: 256M
      cpus: '0.25'
```

### 캐싱 전략
- **빌드 캐시**: BuildKit 활용
- **런타임 캐시**: 정적 자산 캐싱
- **데이터베이스 캐시**: SQLite 최적화

## 🔒 보안 고려사항

### 컨테이너 보안
- 비루트 사용자 실행
- 읽기 전용 파일시스템
- 최소 권한 원칙
- 보안 스캔 정기 실행

### 네트워크 보안
- 격리된 Docker 네트워크
- 필요한 포트만 노출
- TLS/SSL 구성 가능

### 데이터 보안
- 볼륨 암호화 옵션
- 자동 백업 및 로테이션
- 접근 로그 모니터링

## 📞 지원 및 문의

**빌드 문제**: Dockerfile 및 빌드 스크립트 확인  
**런타임 문제**: 헬스체크 및 로그 분석  
**성능 문제**: 리소스 모니터링 및 튜닝  
**보안 문제**: 보안 설정 및 스캔 결과 검토

---

*이 가이드는 Mini-Miro v1.0.0 기준으로 작성되었습니다.*