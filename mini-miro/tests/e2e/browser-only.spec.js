const { test, expect } = require('@playwright/test');

test.describe('Mini-Miro 브라우저 전용 E2E 테스트', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('페이지 타이틀 및 기본 구조 확인', async ({ page }) => {
    // 업데이트된 페이지 제목 확인
    await expect(page).toHaveTitle(/Mini-Miro/);
    
    // React 앱의 기본 요소 확인
    const rootElement = page.locator('#root');
    await expect(rootElement).toBeVisible();
    
    console.log('✅ 페이지 기본 구조 확인 완료');
  });

  test('API 엔드포인트 연결성 테스트', async ({ page }) => {
    // API 엔드포인트에 직접 요청
    const response = await page.request.get('/api/diagrams');
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
    
    console.log(`✅ API 연결 확인 - ${data.length}개 다이어그램 발견`);
  });

  test('WebSocket 연결 감지', async ({ page }) => {
    let wsConnected = false;
    let wsEvents = [];
    
    // WebSocket 이벤트 모니터링
    page.on('websocket', ws => {
      wsConnected = true;
      console.log(`🔗 WebSocket 연결: ${ws.url()}`);
      
      ws.on('framereceived', event => {
        wsEvents.push({ type: 'received', payload: event.payload });
      });
      
      ws.on('framesent', event => {
        wsEvents.push({ type: 'sent', payload: event.payload });
      });
    });
    
    // 페이지에서 JavaScript 실행으로 WebSocket 연결 시도
    await page.evaluate(() => {
      // 실제 앱에서 WebSocket 연결이 시작되도록 대기
      if (window.io) {
        console.log('Socket.io available');
      }
    });
    
    await page.waitForTimeout(3000);
    
    console.log(`WebSocket 연결 상태: ${wsConnected ? '연결됨' : '연결 안됨'}`);
    console.log(`WebSocket 이벤트 수: ${wsEvents.length}`);
  });

  test('페이지 성능 측정', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto('/');
    const loadTime = Date.now() - startTime;
    
    await page.waitForLoadState('domcontentloaded');
    const domTime = Date.now() - startTime;
    
    await page.waitForLoadState('networkidle');
    const completeTime = Date.now() - startTime;
    
    console.log(`📊 성능 측정 결과:`);
    console.log(`  - 페이지 로드: ${loadTime}ms`);
    console.log(`  - DOM 준비: ${domTime}ms`);
    console.log(`  - 완전 로드: ${completeTime}ms`);
    
    // 10초 이내 로드 확인
    expect(completeTime).toBeLessThan(10000);
    
    // Core Web Vitals 측정
    const vitals = await page.evaluate(() => {
      return new Promise((resolve) => {
        if ('PerformanceObserver' in window) {
          const observer = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            resolve(entries.map(entry => ({
              name: entry.name,
              value: entry.value,
              entryType: entry.entryType
            })));
          });
          observer.observe({ entryTypes: ['navigation', 'paint'] });
          
          setTimeout(() => resolve([]), 2000);
        } else {
          resolve([]);
        }
      });
    });
    
    console.log('📊 Performance Observer 결과:', vitals);
  });

  test('브라우저별 호환성 확인', async ({ browserName, page }) => {
    console.log(`🌐 테스트 브라우저: ${browserName}`);
    
    // 브라우저 기본 기능 확인
    const userAgent = await page.evaluate(() => navigator.userAgent);
    console.log(`User Agent: ${userAgent}`);
    
    // 로컬 스토리지 지원 확인
    const hasLocalStorage = await page.evaluate(() => {
      try {
        localStorage.setItem('test', 'value');
        localStorage.removeItem('test');
        return true;
      } catch (e) {
        return false;
      }
    });
    
    expect(hasLocalStorage).toBe(true);
    console.log('✅ 로컬 스토리지 지원됨');
    
    // WebSocket 지원 확인
    const hasWebSocket = await page.evaluate(() => 'WebSocket' in window);
    expect(hasWebSocket).toBe(true);
    console.log('✅ WebSocket 지원됨');
  });

  test('에러 처리 및 복구 테스트', async ({ page }) => {
    // 잘못된 API 요청
    const badResponse = await page.request.get('/api/nonexistent');
    
    // 404 또는 React 앱 응답 (fallback)
    expect([200, 404].includes(badResponse.status())).toBe(true);
    console.log(`잘못된 API 요청 응답: ${badResponse.status()}`);
    
    // 네트워크 오류 시뮬레이션 (간단한 테스트)
    try {
      await page.request.get('/api/diagrams', { timeout: 1 });
    } catch (error) {
      console.log('네트워크 타임아웃 에러 처리 확인됨');
    }
    
    console.log('✅ 에러 처리 테스트 완료');
  });

  test('반응형 디자인 확인', async ({ page }) => {
    const viewports = [
      { width: 1920, height: 1080, name: '데스크톱 FHD' },
      { width: 1366, height: 768, name: '노트북 HD' },
      { width: 768, height: 1024, name: '태블릿' }
    ];
    
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(500);
      
      // 기본 구조가 여전히 보이는지 확인
      const rootElement = page.locator('#root');
      await expect(rootElement).toBeVisible();
      
      console.log(`✅ ${viewport.name} (${viewport.width}x${viewport.height}) 확인 완료`);
    }
  });
});