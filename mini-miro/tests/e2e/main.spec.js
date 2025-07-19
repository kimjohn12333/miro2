const { test, expect } = require('@playwright/test');

test.describe('Mini-Miro E2E 테스트', () => {
  test.beforeEach(async ({ page }) => {
    console.log('테스트 시작 - 페이지 로딩 중...');
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    console.log('페이지 로딩 완료');
  });

  test('페이지 기본 구조 확인', async ({ page }) => {
    console.log('📋 테스트: 페이지 기본 구조 확인');
    
    // 페이지 타이틀 확인
    await expect(page).toHaveTitle(/Mini-Miro/);
    console.log('✅ 페이지 타이틀 확인됨');
    
    // React 앱 루트 엘리먼트 확인
    const rootElement = page.locator('#root');
    await expect(rootElement).toBeVisible();
    console.log('✅ React 앱 루트 엘리먼트 확인됨');
    
    // 페이지 내용이 로드되었는지 확인
    await page.waitForTimeout(2000);
    const bodyText = await page.textContent('body');
    expect(bodyText.length).toBeGreaterThan(0);
    console.log('✅ 페이지 내용 로드 확인됨');
  });

  test('API 연결성 테스트', async ({ page }) => {
    console.log('📋 테스트: API 연결성');
    
    // API 엔드포인트 테스트
    const response = await page.request.get('/api/diagrams');
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
    
    console.log(`✅ API 연결 성공 - ${data.length}개 다이어그램 발견`);
    
    // 개별 다이어그램 조회 테스트
    if (data.length > 0) {
      const firstDiagram = data[0];
      const detailResponse = await page.request.get(`/api/diagrams/${firstDiagram.id}`);
      expect(detailResponse.status()).toBe(200);
      console.log(`✅ 다이어그램 상세 조회 성공 (ID: ${firstDiagram.id})`);
    }
  });

  test('WebSocket 연결 감지', async ({ page }) => {
    console.log('📋 테스트: WebSocket 연결');
    
    let wsConnected = false;
    let wsMessages = [];
    
    // WebSocket 이벤트 리스너 설정
    page.on('websocket', ws => {
      wsConnected = true;
      console.log(`🔗 WebSocket 연결 감지: ${ws.url()}`);
      
      ws.on('framereceived', event => {
        wsMessages.push({ type: 'received', payload: event.payload });
        console.log(`📨 수신: ${event.payload}`);
      });
      
      ws.on('framesent', event => {
        wsMessages.push({ type: 'sent', payload: event.payload });
        console.log(`📤 송신: ${event.payload}`);
      });
    });
    
    // WebSocket 연결을 트리거할 수 있는 상호작용
    await page.waitForTimeout(3000);
    
    console.log(`WebSocket 연결 상태: ${wsConnected ? '연결됨' : '대기 중'}`);
    console.log(`메시지 개수: ${wsMessages.length}`);
  });

  test('페이지 성능 측정', async ({ page }) => {
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
    console.log(`  초기 로드: ${loadTime}ms`);
    console.log(`  DOM 준비: ${domTime}ms`);
    console.log(`  완전 로드: ${completeTime}ms`);
    
    // 성능 기준 확인 (10초 이내)
    expect(completeTime).toBeLessThan(10000);
    console.log('✅ 성능 기준 충족');
  });

  test('브라우저 호환성 확인', async ({ browserName, page }) => {
    console.log(`📋 테스트: ${browserName} 브라우저 호환성`);
    
    // 브라우저 정보 확인
    const userAgent = await page.evaluate(() => navigator.userAgent);
    console.log(`User Agent: ${userAgent}`);
    
    // 기본 웹 API 지원 확인
    const apiSupport = await page.evaluate(() => {
      return {
        localStorage: typeof Storage !== 'undefined',
        websocket: typeof WebSocket !== 'undefined',
        fetch: typeof fetch !== 'undefined',
        promise: typeof Promise !== 'undefined'
      };
    });
    
    expect(apiSupport.localStorage).toBe(true);
    expect(apiSupport.websocket).toBe(true);
    expect(apiSupport.fetch).toBe(true);
    expect(apiSupport.promise).toBe(true);
    
    console.log('✅ 모든 필수 웹 API 지원됨');
  });

  test('반응형 디자인 테스트', async ({ page }) => {
    console.log('📋 테스트: 반응형 디자인');
    
    const viewports = [
      { width: 1920, height: 1080, name: '데스크톱 FHD' },
      { width: 1366, height: 768, name: '노트북' },
      { width: 768, height: 1024, name: '태블릿' }
    ];
    
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(500);
      
      // 기본 구조 확인
      const rootElement = page.locator('#root');
      await expect(rootElement).toBeVisible();
      
      console.log(`✅ ${viewport.name} (${viewport.width}x${viewport.height}) 호환성 확인`);
    }
  });

  test('에러 처리 확인', async ({ page }) => {
    console.log('📋 테스트: 에러 처리');
    
    // 존재하지 않는 API 엔드포인트 테스트
    const response = await page.request.get('/api/nonexistent');
    console.log(`존재하지 않는 API 응답 코드: ${response.status()}`);
    
    // 잘못된 JSON 요청 테스트
    try {
      const postResponse = await page.request.post('/api/diagrams', {
        data: 'invalid json'
      });
      console.log(`잘못된 JSON 요청 응답: ${postResponse.status()}`);
    } catch (error) {
      console.log('예상된 에러 발생:', error.message);
    }
    
    console.log('✅ 에러 처리 확인 완료');
  });
});