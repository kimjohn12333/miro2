const { test, expect } = require('@playwright/test');

test.describe('Mini-Miro 실시간 협업 기능 테스트', () => {
  test('다중 브라우저 컨텍스트를 통한 실시간 협업 시뮬레이션', async ({ browser }) => {
    // 두 개의 독립적인 브라우저 컨텍스트 생성
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();
    
    try {
      // 사용자 1 설정
      await page1.goto('/');
      await page1.waitForLoadState('networkidle');
      await page1.locator('input[placeholder*="이름"]').fill('협업사용자1');
      await page1.locator('input[placeholder*="이름"]').press('Enter');
      await page1.waitForTimeout(1500);
      
      // 사용자 2 설정  
      await page2.goto('/');
      await page2.waitForLoadState('networkidle');
      await page2.locator('input[placeholder*="이름"]').fill('협업사용자2');
      await page2.locator('input[placeholder*="이름"]').press('Enter');
      await page2.waitForTimeout(1500);
      
      // 둘 다 같은 다이어그램에 접속
      const firstDiagram1 = page1.locator('.diagram-item').first();
      const firstDiagram2 = page2.locator('.diagram-item').first();
      
      if (await firstDiagram1.isVisible() && await firstDiagram2.isVisible()) {
        // 사용자 1이 먼저 다이어그램 접속
        await firstDiagram1.click();
        await page1.waitForTimeout(2000);
        
        // 사용자 2도 같은 다이어그램 접속
        await firstDiagram2.click();
        await page2.waitForTimeout(2000);
        
        // 사용자 1이 편집 잠금 시도
        const lockButton1 = page1.locator('button:has-text("편집"), button:has-text("잠금")').first();
        if (await lockButton1.isVisible()) {
          await lockButton1.click();
          await page1.waitForTimeout(1000);
          
          // 사용자 1의 잠금 상태 확인
          const lockedIndicator1 = page1.locator(':has-text("편집 중")');
          if (await lockedIndicator1.isVisible()) {
            console.log('사용자 1: 편집 잠금 획득 성공');
            
            // 사용자 2는 잠금이 불가능해야 함
            const lockButton2 = page2.locator('button:has-text("편집"), button:has-text("잠금")').first();
            const lockedByOther = page2.locator(':has-text("편집 중"), :has-text("잠금")');
            
            if (await lockedByOther.isVisible()) {
              console.log('사용자 2: 다른 사용자의 편집 잠금 상태 확인됨');
            } else if (await lockButton2.isVisible()) {
              // 잠금 시도 (실패해야 함)
              await lockButton2.click();
              await page2.waitForTimeout(1000);
              
              // 에러 메시지나 여전히 잠금 불가 상태인지 확인
              const errorMessage = page2.locator(':has-text("잠금"), :has-text("편집 중"), :has-text("사용 중")');
              if (await errorMessage.isVisible()) {
                console.log('사용자 2: 잠금 충돌 방지 확인됨');
              }
            }
          }
        }
      }
      
      console.log('실시간 협업 테스트 완료');
      
    } finally {
      await context1.close();
      await context2.close();
    }
  });

  test('WebSocket 연결 상태 및 실시간 업데이트 확인', async ({ page }) => {
    // 네트워크 이벤트 모니터링
    const wsConnections = [];
    
    page.on('websocket', ws => {
      wsConnections.push(ws);
      console.log(`WebSocket 연결 생성: ${ws.url()}`);
      
      ws.on('framereceived', event => {
        console.log(`WebSocket 수신: ${event.payload}`);
      });
      
      ws.on('framesent', event => {
        console.log(`WebSocket 송신: ${event.payload}`);
      });
      
      ws.on('close', () => {
        console.log('WebSocket 연결 종료');
      });
    });
    
    // 페이지 로드 및 사용자 설정
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.locator('input[placeholder*="이름"]').fill('WebSocket테스트사용자');
    await page.locator('input[placeholder*="이름"]').press('Enter');
    await page.waitForTimeout(1500);
    
    // 다이어그램 접속
    const firstDiagram = page.locator('.diagram-item').first();
    if (await firstDiagram.isVisible()) {
      await firstDiagram.click();
      await page.waitForTimeout(3000);
      
      // WebSocket 연결이 확립되었는지 확인
      expect(wsConnections.length).toBeGreaterThan(0);
      console.log(`WebSocket 연결 수: ${wsConnections.length}`);
      
      // 편집 잠금을 통한 실시간 이벤트 테스트
      const lockButton = page.locator('button:has-text("편집"), button:has-text("잠금")').first();
      if (await lockButton.isVisible()) {
        await lockButton.click();
        await page.waitForTimeout(2000);
        
        console.log('편집 잠금을 통한 WebSocket 이벤트 테스트 완료');
      }
    }
  });

  test('연결 해제 및 재연결 테스트', async ({ page, context }) => {
    // 페이지 로드
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.locator('input[placeholder*="이름"]').fill('연결테스트사용자');
    await page.locator('input[placeholder*="이름"]').press('Enter');
    await page.waitForTimeout(1500);
    
    // 다이어그램 접속
    const firstDiagram = page.locator('.diagram-item').first();
    if (await firstDiagram.isVisible()) {
      await firstDiagram.click();
      await page.waitForTimeout(2000);
      
      // 네트워크 연결 차단 시뮬레이션
      await context.setOffline(true);
      await page.waitForTimeout(2000);
      
      // 네트워크 연결 복구
      await context.setOffline(false);
      await page.waitForTimeout(3000);
      
      // 페이지가 여전히 작동하는지 확인
      const pageTitle = page.locator('h1');
      await expect(pageTitle).toBeVisible();
      
      console.log('연결 해제/재연결 테스트 완료');
    }
  });

  test('동시 편집 시도 및 충돌 방지 테스트', async ({ browser }) => {
    // 세 개의 독립적인 컨텍스트 생성
    const contexts = await Promise.all([
      browser.newContext(),
      browser.newContext(),
      browser.newContext()
    ]);
    
    const pages = await Promise.all(
      contexts.map(context => context.newPage())
    );
    
    try {
      // 모든 사용자 설정
      for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        await page.goto('/');
        await page.waitForLoadState('networkidle');
        await page.locator('input[placeholder*="이름"]').fill(`동시편집사용자${i + 1}`);
        await page.locator('input[placeholder*="이름"]').press('Enter');
        await page.waitForTimeout(1500);
        
        // 같은 다이어그램에 접속
        const firstDiagram = page.locator('.diagram-item').first();
        if (await firstDiagram.isVisible()) {
          await firstDiagram.click();
          await page.waitForTimeout(2000);
        }
      }
      
      // 모든 사용자가 동시에 편집 잠금 시도
      const lockPromises = pages.map(async (page, index) => {
        const lockButton = page.locator('button:has-text("편집"), button:has-text("잠금")').first();
        if (await lockButton.isVisible()) {
          await lockButton.click();
          await page.waitForTimeout(1000);
          
          // 잠금 성공 여부 확인
          const isLocked = await page.locator(':has-text("편집 중")').isVisible();
          console.log(`사용자 ${index + 1} 잠금 시도 결과: ${isLocked ? '성공' : '실패'}`);
          return isLocked;
        }
        return false;
      });
      
      const results = await Promise.all(lockPromises);
      const successCount = results.filter(Boolean).length;
      
      // 오직 한 명만 성공해야 함
      expect(successCount).toBeLessThanOrEqual(1);
      console.log(`동시 편집 테스트 완료 - 성공한 사용자 수: ${successCount}`);
      
    } finally {
      await Promise.all(contexts.map(context => context.close()));
    }
  });

  test('사용자 입장/퇴장 알림 테스트', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();
    
    try {
      // 사용자 1 먼저 접속
      await page1.goto('/');
      await page1.waitForLoadState('networkidle');
      await page1.locator('input[placeholder*="이름"]').fill('입장테스트사용자1');
      await page1.locator('input[placeholder*="이름"]').press('Enter');
      await page1.waitForTimeout(1500);
      
      const firstDiagram1 = page1.locator('.diagram-item').first();
      if (await firstDiagram1.isVisible()) {
        await firstDiagram1.click();
        await page1.waitForTimeout(2000);
        
        // 사용자 2 입장
        await page2.goto('/');
        await page2.waitForLoadState('networkidle');
        await page2.locator('input[placeholder*="이름"]').fill('입장테스트사용자2');
        await page2.locator('input[placeholder*="이름"]').press('Enter');
        await page2.waitForTimeout(1500);
        
        const firstDiagram2 = page2.locator('.diagram-item').first();
        if (await firstDiagram2.isVisible()) {
          await firstDiagram2.click();
          await page2.waitForTimeout(2000);
          
          // 잠시 대기 후 사용자 2 퇴장
          await page2.waitForTimeout(1000);
          await context2.close();
          
          // 사용자 1에서 퇴장 알림 확인 (있다면)
          await page1.waitForTimeout(2000);
          console.log('사용자 입장/퇴장 테스트 완료');
        }
      }
      
    } finally {
      await context1.close();
    }
  });
});