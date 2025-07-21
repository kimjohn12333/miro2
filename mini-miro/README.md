# Mini-Miro - 사내 협업용 다이어그램 툴 🎨

간단하고 직관적한 화이트보드 스타일의 다이어그램 협업 도구입니다.

![Mini-Miro Demo](https://img.shields.io/badge/Status-Production%20Ready-brightgreen) ![Docker](https://img.shields.io/badge/Docker-Supported-blue) ![Version](https://img.shields.io/badge/Version-1.0.0-orange)

## 🚀 빠른 시작 (Docker 권장)

### 📦 Docker로 바로 실행하기

```bash
# Docker Compose 사용 (가장 간편)
git clone https://github.com/kimjohn12333/miro2.git
cd miro2
docker-compose up -d

# 브라우저에서 접속
# http://localhost:3003
```

## 🐳 Docker 설치 가이드

### Windows 사용자

#### 1단계: Docker Desktop 설치
1. [Docker Desktop for Windows](https://docs.docker.com/desktop/windows/install/) 다운로드
2. 시스템 요구사항 확인:
   - Windows 10 64-bit: Pro, Enterprise, Education (Build 19041 이상)
   - WSL 2 활성화 필요
3. 설치 파일 실행 후 재부팅
4. Docker Desktop 시작 후 WSL 2 백엔드 활성화

#### 2단계: WSL 2 설정 (필요시)
```powershell
# PowerShell을 관리자 권한으로 실행
wsl --install

# 재부팅 후
wsl --set-default-version 2
```

#### 3단계: Mini-Miro 실행
```powershell
# PowerShell에서 실행
git clone https://github.com/kimjohn12333/miro2.git
cd miro2
docker-compose up -d

# 상태 확인
docker ps

# 접속: http://localhost:3003
```

### Linux 사용자 (Ubuntu/Debian)

#### 1단계: Docker Engine 설치
```bash
# 기존 패키지 제거
sudo apt-get remove docker docker-engine docker.io containerd runc

# 저장소 설정
sudo apt-get update
sudo apt-get install ca-certificates curl gnupg lsb-release

# Docker GPG 키 추가
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# 저장소 추가
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Docker Engine 설치
sudo apt-get update
sudo apt-get install docker-ce docker-ce-cli containerd.io docker-compose-plugin
```

#### 2단계: Docker Compose 설치
```bash
# Docker Compose V2 (권장)
sudo apt-get install docker-compose-plugin

# 또는 독립 실행형 설치
sudo curl -L "https://github.com/docker/compose/releases/download/v2.16.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

#### 3단계: 사용자 권한 설정
```bash
# Docker 그룹에 사용자 추가
sudo usermod -aG docker $USER

# 재로그인 또는
newgrp docker

# 권한 확인
docker run hello-world
```

#### 4단계: Mini-Miro 실행
```bash
# 프로젝트 클론
git clone https://github.com/kimjohn12333/miro2.git
cd miro2

# Docker Compose 실행
docker-compose up -d

# 상태 확인
docker ps

# 로그 확인
docker-compose logs -f

# 접속: http://localhost:3003
```

### CentOS/RHEL 사용자

#### Docker Engine 설치
```bash
# 기존 패키지 제거
sudo yum remove docker docker-client docker-client-latest docker-common docker-latest

# 저장소 추가
sudo yum install -y yum-utils
sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo

# Docker 설치
sudo yum install docker-ce docker-ce-cli containerd.io docker-compose-plugin

# 서비스 시작
sudo systemctl start docker
sudo systemctl enable docker

# 사용자 권한 설정
sudo usermod -aG docker $USER
```

## 🛠️ 실행 옵션

### 옵션 1: Docker Compose (권장)
```bash
# 백그라운드 실행
docker-compose up -d

# 로그 실시간 확인
docker-compose logs -f

# 중지
docker-compose down

# 데이터 포함 완전 제거
docker-compose down -v
```

### 옵션 2: Docker Run (단순 실행)
```bash
# 기본 실행
docker run -d -p 3003:3003 --name mini-miro mini-miro:latest

# 데이터 볼륨 포함
docker run -d \
  -p 3003:3003 \
  -v mini-miro-data:/app/data \
  --name mini-miro \
  mini-miro:latest
```

### 옵션 3: 개발 모드
```bash
# 개발용 설정으로 실행
docker-compose -f docker-compose.dev.yml up -d

# 프로덕션 모드
docker-compose -f docker-compose.prod.yml up -d
```

## 🎯 주요 특징

- 🎨 **직관적인 UI**: 배우기 쉬운 화이트보드 인터페이스
- 🔒 **편집 잠금**: 한 번에 한 명만 편집 가능한 안전한 협업
- ⚡ **실시간 동기화**: WebSocket 기반 실시간 업데이트
- 💾 **자동 저장**: 변경사항 즉시 저장
- 📱 **반응형**: 태블릿까지 지원하는 반응형 디자인
- 🐳 **Docker 지원**: 컨테이너 기반 간편 배포
- 📊 **자동 백업**: 일일 자동 백업 시스템
- 🔍 **헬스 체크**: 서비스 상태 모니터링

## 🏗️ 기술 스택

### 백엔드
- **Node.js 20** + **Express.js**: 웹 서버
- **Socket.io**: 실시간 통신
- **SQLite**: 경량 데이터베이스
- **CORS**: 크로스 오리진 지원

### 프론트엔드
- **React 19** + **TypeScript**: UI 프레임워크
- **React Konva**: 캔버스 렌더링
- **Socket.io Client**: 실시간 통신

### 인프라
- **Docker**: 컨테이너화
- **Docker Compose**: 오케스트레이션
- **Nginx**: 리버스 프록시 (옵션)
- **SQLite**: 데이터 영속성

## 📱 사용법

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

## 🐳 Docker 구성

### 컨테이너 구성
```yaml
services:
  mini-miro:      # 메인 애플리케이션
    port: 3003
    volumes: 
      - data (SQLite 데이터베이스)
      - logs (애플리케이션 로그)
  
  backup:         # 자동 백업 서비스
    schedule: 매일 자정
    retention: 7일
```

### 데이터 영속성
```bash
# 데이터 백업
docker cp mini-miro-app:/app/data ./backup/

# 데이터 복원
docker cp ./backup/ mini-miro-app:/app/data/

# 볼륨 확인
docker volume ls | grep mini-miro
```

## 🔧 환경 설정

### 환경 변수
```bash
# .env 파일 생성
NODE_ENV=production
PORT=3003
DB_PATH=/app/data/minimiro.db
LOG_LEVEL=info

# React 앱 설정
REACT_APP_API_URL=""  # 상대 URL 사용
```

### 포트 설정
```bash
# 다른 포트로 실행
docker run -d -p 8080:3003 --name mini-miro mini-miro:latest

# 여러 포트 바인딩
docker run -d -p 3003:3003 -p 8080:3003 --name mini-miro mini-miro:latest
```

## 🚨 문제 해결

### Windows 문제 해결

#### Docker Desktop 시작 안됨
```powershell
# WSL 2 재설치
wsl --install --distribution Ubuntu
wsl --set-default-version 2

# Docker Desktop 재시작
```

#### 권한 오류
```powershell
# PowerShell 관리자 권한으로 실행
Add-LocalGroupMember -Group "docker-users" -Member $env:USERNAME

# 로그아웃 후 재로그인
```

#### 방화벽 문제
```powershell
# Windows Defender 방화벽에서 Docker Desktop 허용
# 포트 3003 인바운드 규칙 추가
```

### Linux 문제 해결

#### Docker 권한 오류
```bash
# Docker 그룹에 사용자 추가 후 재로그인
sudo usermod -aG docker $USER
newgrp docker

# Docker 소켓 권한 확인
sudo chown root:docker /var/run/docker.sock
sudo chmod 664 /var/run/docker.sock
```

#### 포트 충돌
```bash
# 포트 사용 확인
sudo netstat -tlnp | grep :3003

# 프로세스 종료
sudo kill -9 $(sudo lsof -ti:3003)
```

#### 메모리 부족
```bash
# 시스템 리소스 확인
free -h
docker system df

# 미사용 이미지/컨테이너 정리
docker system prune -a
```

### 일반적인 문제

#### 컨테이너 상태 확인
```bash
# 컨테이너 상태 확인
docker ps -a

# 로그 확인
docker logs mini-miro-app

# 컨테이너 내부 접속
docker exec -it mini-miro-app sh
```

#### 네트워크 문제
```bash
# 네트워크 확인
docker network ls

# 컨테이너 IP 확인
docker inspect mini-miro-app | grep IPAddress

# 헬스 체크
curl http://localhost:3003/health
```

#### 데이터베이스 문제
```bash
# 데이터베이스 파일 확인
docker exec mini-miro-app ls -la /app/data/

# 백업에서 복원
docker cp backup/minimiro.db mini-miro-app:/app/data/
```

## 📊 모니터링 & 로그

### 로그 관리
```bash
# 실시간 로그 확인
docker-compose logs -f mini-miro

# 특정 시간 범위 로그
docker logs --since="2024-01-01" --until="2024-01-02" mini-miro-app

# 로그 파일 위치
docker exec mini-miro-app ls -la /app/logs/
```

### 헬스 체크
```bash
# 헬스 상태 확인
curl http://localhost:3003/health

# 상세 상태 정보
docker inspect --format='{{json .State.Health}}' mini-miro-app
```

### 성능 모니터링
```bash
# 리소스 사용량
docker stats mini-miro-app

# 컨테이너 정보
docker inspect mini-miro-app
```

## 🎯 프로덕션 배포

### 보안 설정
```bash
# SSL 인증서 적용 (Nginx 프록시)
docker-compose -f docker-compose.prod.yml up -d

# 환경 변수 보안
echo "NODE_ENV=production" > .env.prod
```

### 자동 업데이트
```bash
# Watchtower로 자동 업데이트 설정
docker run -d \
  --name watchtower \
  -v /var/run/docker.sock:/var/run/docker.sock \
  containrrr/watchtower \
  mini-miro-app
```

### 백업 전략
```bash
# 자동 백업 스크립트
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
docker cp mini-miro-app:/app/data/minimiro.db ./backups/minimiro-$DATE.db
find ./backups -name "minimiro-*.db" -mtime +7 -delete
```

## 🔗 API 엔드포인트

### REST API
- `GET /api/diagrams` - 다이어그램 목록 조회
- `POST /api/diagrams` - 새 다이어그램 생성
- `GET /api/diagrams/:id` - 다이어그램 상세 조회
- `DELETE /api/diagrams/:id` - 다이어그램 삭제
- `GET /health` - 헬스 체크

### WebSocket 이벤트
- `identify` - 사용자 식별
- `join-diagram` - 다이어그램 참여
- `request-lock` - 편집 잠금 요청
- `release-lock` - 편집 잠금 해제
- `update-diagram` - 다이어그램 업데이트

## 📋 시스템 요구사항

### Docker 환경
- **Docker Engine**: 20.10 이상
- **Docker Compose**: 2.0 이상
- **메모리**: 최소 1GB RAM
- **디스크**: 최소 2GB 여유 공간

### 브라우저 지원
- **Chrome**: 90+
- **Firefox**: 88+
- **Safari**: 14+
- **Edge**: 90+

### 네트워크
- **포트**: 3003 (기본값)
- **방화벽**: 인바운드 3003 포트 허용

## 📝 개발자 가이드

### 로컬 개발 설정
```bash
# 개발 환경 설정
git clone https://github.com/kimjohn12333/miro2.git
cd miro2

# 개발용 Docker Compose
docker-compose -f docker-compose.dev.yml up -d

# 개발 서버 접속
# http://localhost:3003
```

### 빌드 및 테스트
```bash
# Docker 이미지 빌드
docker build -t mini-miro:custom .

# E2E 테스트 실행
docker run --rm -v $(pwd):/workspace playwright-test

# 보안 스캔
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
  aquasec/trivy image mini-miro:latest
```

## 🤝 기여하기

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### 개발 환경
```bash
# 개발용 컨테이너 실행
docker-compose -f docker-compose.dev.yml up -d

# 코드 변경 사항 실시간 반영
docker exec -it mini-miro-app npm run dev
```

## 📄 라이선스

MIT License - [LICENSE](LICENSE) 파일을 참조하세요.

## 🔗 링크

- **Repository**: https://github.com/kimjohn12333/miro2
- **Issues**: https://github.com/kimjohn12333/miro2/issues
- **Docker Hub**: `mini-miro:latest`

## 📞 지원

문제가 발생하면 다음을 확인해주세요:

1. **Docker 상태**: `docker ps`
2. **로그 확인**: `docker logs mini-miro-app`
3. **헬스 체크**: `curl http://localhost:3003/health`
4. **포트 확인**: `netstat -an | grep 3003`

추가 지원이 필요하면 GitHub Issues에 문의해주세요.

---

**Mini-Miro** - 간단하고 강력한 협업 다이어그램 도구 🚀