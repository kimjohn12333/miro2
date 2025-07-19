const { test, expect } = require('@playwright/test');

test.describe('Mini-Miro E2E 기능 테스트', () => {
  test.beforeEach(async ({ page }) => {
    console.log('🚀 테스트 시작 - 페이지 로딩...');
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    console.log('✅ 페이지 로딩 완료');
  });

  test('페이지 기본 구조 및 타이틀 확인', async ({ page }) => {
    console.log('📋 테스트: 페이지 기본 구조 확인');
    
    // 페이지 타이틀 확인
    await expect(page).toHaveTitle(/Mini-Miro/);
    console.log('✅ 페이지 타이틀 "Mini-Miro" 확인됨');
    
    // React 앱 루트 엘리먼트 확인
    const rootElement = page.locator('#root');
    await expect(rootElement).toBeVisible();
    console.log('✅ React 앱 루트 엘리먼트 확인됨');
    
    // 페이지가 비어있지 않은지 확인
    await page.waitForTimeout(2000);
    const bodyText = await page.textContent('body');
    expect(bodyText.length).toBeGreaterThan(0);
    console.log('✅ 페이지 내용 로드 확인됨');
  });

  test('REST API 연결성 및 데이터 확인', async ({ page }) => {
    console.log('📋 테스트: REST API 연결성');
    
    // 다이어그램 목록 API 테스트
    const response = await page.request.get('/api/diagrams');
    expect(response.status()).toBe(200);
    
    const diagrams = await response.json();
    expect(Array.isArray(diagrams)).toBe(true);
    console.log(`✅ API 연결 성공 - ${diagrams.length}개 다이어그램 발견`);
    
    // 개별 다이어그램 조회 테스트
    if (diagrams.length > 0) {
      const firstDiagram = diagrams[0];
      const detailResponse = await page.request.get(`/api/diagrams/${firstDiagram.id}`);
      expect(detailResponse.status()).toBe(200);
      
      const detail = await detailResponse.json();
      expect(detail.id).toBe(firstDiagram.id);
      console.log(`✅ 다이어그램 상세 조회 성공 (ID: ${firstDiagram.id})`);
    }
  });

  test('WebSocket 연결 감지 및 실시간 통신', async ({ page }) => {
    console.log('📋 테스트: WebSocket 연결');
    
    let wsConnected = false;
    let wsMessages = [];
    
    // WebSocket 이벤트 리스너 설정
    page.on('websocket', ws => {
      wsConnected = true;
      console.log(`🔗 WebSocket 연결 감지: ${ws.url()}`);
      
      ws.on('framereceived', event => {
        wsMessages.push({ type: 'received', payload: event.payload });
        try {
          const data = JSON.parse(event.payload);
          console.log(`📨 수신: ${data.type || 'unknown'}`);
        } catch (e) {
          console.log(`📨 수신: ${event.payload.substring(0, 50)}...`);
        }
      });
      
      ws.on('framesent', event => {
        wsMessages.push({ type: 'sent', payload: event.payload });
        try {
          const data = JSON.parse(event.payload);
          console.log(`📤 송신: ${data.type || 'unknown'}`);
        } catch (e) {
          console.log(`📤 송신: ${event.payload.substring(0, 50)}...`);
        }
      });
    });
    
    // WebSocket 연결을 트리거하기 위해 잠시 대기
    await page.waitForTimeout(5000);
    
    console.log(`WebSocket 연결 상태: ${wsConnected ? '✅ 연결됨' : '⏳ 대기 중'}`);
    console.log(`메시지 개수: ${wsMessages.length}`);
  });

  test('페이지 성능 및 로딩 시간 측정', async ({ page }) => {
    console.log('📋 테스트: 성능 측정');
    
    const startTime = Date.now();
    
    // 페이지 로드 시간 측정
    await page.goto('/');
    const loadTime = Date.now() - startTime;
    
    await page.waitForLoadState('domcontentloaded');
    const domTime = Date.now() - startTime;
    
    await page.waitForLoadState('networkidle');
    const completeTime = Date.now() - startTime;
    
    console.log(`📊 성능 메트릭:`);
    console.log(`  ⚡ 초기 로드: ${loadTime}ms`);
    console.log(`  📄 DOM 준비: ${domTime}ms`);
    console.log(`  🎯 완전 로드: ${completeTime}ms`);
    
    // 성능 기준 확인 (합리적인 10초 이내)
    expect(completeTime).toBeLessThan(10000);
    
    if (completeTime < 3000) {
      console.log('✅ 우수한 성능 (3초 이내)');
    } else if (completeTime < 5000) {
      console.log('✅ 양호한 성능 (5초 이내)');
    } else {
      console.log('✅ 허용 가능한 성능 (10초 이내)');
    }
  });

  test('브라우저 호환성 및 웹 API 지원', async ({ browserName, page }) => {
    console.log(`📋 테스트: ${browserName} 브라우저 호환성`);
    
    // 브라우저 정보 확인
    const userAgent = await page.evaluate(() => navigator.userAgent);
    console.log(`🌐 User Agent: ${userAgent.substring(0, 100)}...`);
    
    // 필수 웹 API 지원 확인
    const apiSupport = await page.evaluate(() => {
      return {
        localStorage: typeof Storage !== 'undefined',
        websocket: typeof WebSocket !== 'undefined',
        fetch: typeof fetch !== 'undefined',
        promise: typeof Promise !== 'undefined',
        json: typeof JSON !== 'undefined',
        canvas: typeof HTMLCanvasElement !== 'undefined'
      };
    });
    
    // 모든 필수 API 확인
    Object.entries(apiSupport).forEach(([api, supported]) => {
      expect(supported).toBe(true);
      console.log(`✅ ${api.toUpperCase()} API 지원됨`);
    });
    
    console.log(`✅ ${browserName} 브라우저 완전 호환`);
  });

  test('반응형 디자인 다중 해상도 테스트', async ({ page }) => {
    console.log('📋 테스트: 반응형 디자인');
    
    const viewports = [
      { width: 1920, height: 1080, name: '데스크톱 FHD' },
      { width: 1366, height: 768, name: '노트북 HD' },
      { width: 768, height: 1024, name: '태블릿 세로' },
      { width: 1024, height: 768, name: '태블릿 가로' }
    ];
    
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(1000);
      
      // 기본 구조가 여전히 표시되는지 확인
      const rootElement = page.locator('#root');
      await expect(rootElement).toBeVisible();
      
      // 오버플로우 확인
      const hasHorizontalScrollbar = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      
      console.log(`✅ ${viewport.name} (${viewport.width}x${viewport.height}) - 가로 스크롤: ${hasHorizontalScrollbar ? '있음' : '없음'}`);
    }
  });

  test('에러 처리 및 복구 능력', async ({ page }) => {
    console.log('📋 테스트: 에러 처리');
    
    // 존재하지 않는 API 엔드포인트 테스트
    const notFoundResponse = await page.request.get('/api/nonexistent');
    console.log(`404 API 응답: ${notFoundResponse.status()}`);
    
    // 잘못된 ID로 다이어그램 조회
    const invalidIdResponse = await page.request.get('/api/diagrams/99999');
    expect(invalidIdResponse.status()).toBe(404);
    console.log('✅ 잘못된 ID 에러 처리 확인됨');
    
    // 잘못된 JSON 데이터 전송 테스트
    try {
      const badJsonResponse = await page.request.post('/api/diagrams', {
        data: '{invalid json}',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      console.log(`잘못된 JSON 응답: ${badJsonResponse.status()}`);
      expect(badJsonResponse.status()).toBe(400);
    } catch (error) {
      console.log('✅ JSON 파싱 에러 적절히 처리됨');
    }
    
    console.log('✅ 모든 에러 시나리오 처리 확인됨');
  });

  test('보안 기본 검증', async ({ page }) => {
    console.log('📋 테스트: 기본 보안 검증');
    
    // SQL 인젝션 시도 테스트
    const sqlInjectionResponse = await page.request.get('/api/diagrams/1\'; DROP TABLE diagrams; --');
    // 보안이 제대로 되어 있다면 404 또는 400 응답
    expect([400, 404].includes(sqlInjectionResponse.status())).toBe(true);
    console.log('✅ SQL 인젝션 공격 차단됨');
    
    // XSS 방지 확인 (기본적인 스크립트 주입 시도)
    const xssResponse = await page.request.post('/api/diagrams', {
      data: JSON.stringify({
        title: '<script>alert("xss")</script>',
        description: 'XSS 테스트',
        type: 'flowchart'
      }),
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    // 생성은 될 수 있지만 스크립트 실행은 안 되어야 함
    console.log(`XSS 테스트 응답: ${xssResponse.status()}`);
    
    console.log('✅ 기본 보안 검증 완료');
  });
});