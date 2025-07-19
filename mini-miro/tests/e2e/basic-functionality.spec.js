const { test, expect } = require('@playwright/test');

test.describe('Mini-Miro 기본 기능 실제 테스트', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('페이지 로딩 및 타이틀 확인', async ({ page }) => {
    // 업데이트된 페이지 제목 확인
    await expect(page).toHaveTitle(/Mini-Miro/);
    
    console.log('✅ 페이지 타이틀 확인 완료');
  });

  test('React 앱 기본 로딩 확인', async ({ page }) => {
    // React 앱의 기본 요소 확인
    const rootElement = page.locator('#root');
    await expect(rootElement).toBeVisible();
    
    // JavaScript가 로드되어 React 컴포넌트가 렌더링되는지 확인
    await page.waitForTimeout(2000);
    
    // 페이지 내용이 비어있지 않은지 확인
    const bodyText = await page.textContent('body');
    expect(bodyText).not.toBe('');
    
    console.log('✅ React 앱 기본 구조 확인 완료');
  });

  test('API 연결성 확인', async ({ page }) => {
    // API 엔드포인트에 직접 요청하여 연결성 확인
    const response = await page.request.get('/api/diagrams');
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
    
    console.log(`✅ API 연결 확인 완료 - 다이어그램 ${data.length}개 발견`);
  });

  test('WebSocket 연결 모니터링', async ({ page }) => {
    let wsConnected = false;
    
    // WebSocket 연결 감지
    page.on('websocket', ws => {
      wsConnected = true;
      console.log(`✅ WebSocket 연결 확인: ${ws.url()}`);
      
      ws.on('framereceived', event => {
        try {
          const data = JSON.parse(event.payload);
          console.log(`📨 WebSocket 수신:`, data.type || 'unknown');
        } catch (e) {
          console.log(`📨 WebSocket 수신: ${event.payload}`);
        }
      });
      
      ws.on('framesent', event => {
        try {
          const data = JSON.parse(event.payload);
          console.log(`📤 WebSocket 송신:`, data.type || 'unknown');
        } catch (e) {
          console.log(`📤 WebSocket 송신: ${event.payload}`);
        }
      });
    });
    
    // 페이지 상호작용을 통해 WebSocket 연결 트리거
    await page.waitForTimeout(3000);
    
    // WebSocket 연결이 감지되었는지 확인
    if (wsConnected) {
      console.log('✅ WebSocket 연결 성공');
    } else {
      console.log('ℹ️ WebSocket 연결이 아직 트리거되지 않음 (정상적일 수 있음)');
    }
  });

  test('성능 메트릭 측정', async ({ page }) => {
    const startTime = Date.now();
    
    // 페이지 로드 시간 측정
    await page.goto('/');
    const loadTime = Date.now() - startTime;
    
    await page.waitForLoadState('domcontentloaded');
    const domLoadTime = Date.now() - startTime;
    
    await page.waitForLoadState('networkidle');
    const fullLoadTime = Date.now() - startTime;
    
    console.log(`📊 성능 메트릭:`);
    console.log(`  - 초기 로드: ${loadTime}ms`);
    console.log(`  - DOM 준비: ${domLoadTime}ms`);
    console.log(`  - 완전 로드: ${fullLoadTime}ms`);
    
    // 성능 기준 확인 (10초 이내)
    expect(fullLoadTime).toBeLessThan(10000);
    
    console.log('✅ 성능 테스트 완료');
  });
});