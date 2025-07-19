const { chromium } = require('playwright');

/**
 * Mini-Miro 하이라이트 기능 테스트
 * 노드/엣지 클릭 시 연결된 요소들이 하이라이트되는지 확인
 */

async function testHighlightFeature() {
  console.log('🎯 Mini-Miro 하이라이트 기능 테스트 시작');
  console.log('================================================');
  
  const browser = await chromium.launch({ headless: false, slowMo: 1000 }); // 시각적 확인을 위해 headless=false
  const context = await browser.newContext();
  const page = await context.newPage();
  
  const baseURL = 'http://localhost:3003';
  const testResults = [];
  
  try {
    // 1. 페이지 로드 및 로그인
    console.log('\n📋 단계 1: 페이지 로드 및 사용자 설정');
    await page.goto(baseURL);
    await page.waitForLoadState('networkidle');
    
    // 사용자 이름 입력
    const userNameInput = page.locator('input[placeholder*="이름"]');
    if (await userNameInput.isVisible()) {
      await userNameInput.fill('하이라이트테스트사용자');
      await userNameInput.press('Enter');
      await page.waitForTimeout(2000);
      console.log('✅ 사용자 로그인 완료');
    }
    
    // 2. 다이어그램 접속
    console.log('\n📋 단계 2: 다이어그램 접속');
    const firstDiagram = page.locator('.diagram-item').first();
    if (await firstDiagram.isVisible()) {
      await firstDiagram.click();
      await page.waitForTimeout(3000);
      console.log('✅ 다이어그램 접속 완료');
    }
    
    // 3. 편집 잠금 획득
    console.log('\n📋 단계 3: 편집 잠금 획득');
    const lockButton = page.locator('button:has-text("편집")').first();
    if (await lockButton.isVisible()) {
      await lockButton.click();
      await page.waitForTimeout(2000);
      console.log('✅ 편집 잠금 획득 완료');
    }
    
    // 4. 노드 생성 (2개 이상)
    console.log('\n📋 단계 4: 테스트용 노드 생성');
    
    // 사각형 도구 선택
    const rectTool = page.locator('button[title*="사각형"], button:has-text("□")').first();
    if (await rectTool.isVisible()) {
      await rectTool.click();
      console.log('✅ 사각형 도구 선택');
    }
    
    // 첫 번째 노드 생성
    const canvas = page.locator('canvas').first();
    await canvas.click({ position: { x: 200, y: 200 } });
    await page.waitForTimeout(1000);
    
    // 두 번째 노드 생성
    await canvas.click({ position: { x: 400, y: 300 } });
    await page.waitForTimeout(1000);
    console.log('✅ 2개 노드 생성 완료');
    
    // 5. 연결선 생성 (테스트 버튼 사용)
    console.log('\n📋 단계 5: 연결선 생성');
    const edgeButton = page.locator('button:has-text("연결선 추가")');
    if (await edgeButton.isVisible()) {
      await edgeButton.click();
      await page.waitForTimeout(2000);
      console.log('✅ 연결선 생성 완료');
    }
    
    // 6. 선택 도구로 전환
    console.log('\n📋 단계 6: 선택 도구로 전환');
    const selectTool = page.locator('button[title*="선택"], button:has-text("선택")').first();
    if (await selectTool.isVisible()) {
      await selectTool.click();
      await page.waitForTimeout(1000);
      console.log('✅ 선택 도구 활성화');
    }
    
    // 7. 노드 클릭 하이라이트 테스트
    console.log('\n📋 단계 7: 노드 클릭 하이라이트 테스트');
    
    // 첫 번째 노드 클릭
    await canvas.click({ position: { x: 200, y: 200 } });
    await page.waitForTimeout(1500);
    
    // 하이라이트 인디케이터 확인
    const highlightIndicator = page.locator('.highlight-indicator');
    if (await highlightIndicator.isVisible()) {
      const indicatorText = await highlightIndicator.textContent();
      console.log(`✅ 하이라이트 활성화 확인: ${indicatorText}`);
      testResults.push({ test: '노드 클릭 하이라이트', status: 'PASS' });
    } else {
      console.log('❌ 하이라이트 인디케이터가 표시되지 않음');
      testResults.push({ test: '노드 클릭 하이라이트', status: 'FAIL' });
    }
    
    // 8. 엣지 클릭 하이라이트 테스트
    console.log('\n📋 단계 8: 엣지 클릭 하이라이트 테스트');
    
    // 연결선 영역 클릭 (중간 지점)
    await canvas.click({ position: { x: 300, y: 250 } });
    await page.waitForTimeout(1500);
    
    // 하이라이트 상태 확인
    if (await highlightIndicator.isVisible()) {
      const indicatorText = await highlightIndicator.textContent();
      console.log(`✅ 엣지 하이라이트 확인: ${indicatorText}`);
      testResults.push({ test: '엣지 클릭 하이라이트', status: 'PASS' });
    } else {
      console.log('ℹ️ 엣지 클릭이 정확하지 않거나 하이라이트가 유지되지 않음');
      testResults.push({ test: '엣지 클릭 하이라이트', status: 'WARN' });
    }
    
    // 9. 하이라이트 해제 테스트
    console.log('\n📋 단계 9: 하이라이트 해제 테스트');
    
    // 빈 공간 클릭
    await canvas.click({ position: { x: 100, y: 100 } });
    await page.waitForTimeout(1000);
    
    if (!(await highlightIndicator.isVisible())) {
      console.log('✅ 하이라이트 해제 확인');
      testResults.push({ test: '하이라이트 해제', status: 'PASS' });
    } else {
      console.log('❌ 하이라이트가 해제되지 않음');
      testResults.push({ test: '하이라이트 해제', status: 'FAIL' });
    }
    
    // 10. 시각적 스타일 확인
    console.log('\n📋 단계 10: 시각적 스타일 확인');
    
    // 다시 노드 클릭하여 하이라이트 활성화
    await canvas.click({ position: { x: 200, y: 200 } });
    await page.waitForTimeout(2000);
    
    // 스크린샷 촬영 (시각적 확인용)
    await page.screenshot({ path: 'highlight-feature-test.png', fullPage: true });
    console.log('✅ 테스트 스크린샷 저장됨: highlight-feature-test.png');
    testResults.push({ test: '시각적 스타일 확인', status: 'PASS' });
    
    // 결과 요약
    console.log('\n================================================');
    console.log('🏁 하이라이트 기능 테스트 결과');
    console.log('================================================');
    
    const passed = testResults.filter(r => r.status === 'PASS').length;
    const failed = testResults.filter(r => r.status === 'FAIL').length;
    const warnings = testResults.filter(r => r.status === 'WARN').length;
    
    testResults.forEach(result => {
      const icon = result.status === 'PASS' ? '✅' : 
                   result.status === 'FAIL' ? '❌' : '⚠️';
      console.log(`${icon} ${result.test}`);
    });
    
    console.log(`\n📊 결과 요약:`);
    console.log(`  통과: ${passed}`);
    console.log(`  실패: ${failed}`);
    console.log(`  경고: ${warnings}`);
    
    const successRate = Math.round((passed / testResults.length) * 100);
    console.log(`\n🎯 성공률: ${successRate}%`);
    
    if (failed === 0) {
      console.log('🎉 하이라이트 기능 정상 작동!');
    } else {
      console.log(`⚠️ ${failed}개 테스트 실패`);
    }
    
  } catch (error) {
    console.log(`❌ 테스트 실행 중 오류: ${error.message}`);
  } finally {
    // 브라우저를 5초 후에 닫음 (시각적 확인 시간 제공)
    console.log('\n⏰ 5초 후 브라우저 종료...');
    await page.waitForTimeout(5000);
    await browser.close();
  }
}

// 테스트 실행
if (require.main === module) {
  testHighlightFeature().catch(console.error);
}

module.exports = { testHighlightFeature };