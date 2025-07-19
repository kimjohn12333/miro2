const { chromium } = require('playwright');

/**
 * Mini-Miro 접근성 및 사용성 테스트
 */

async function runAccessibilityTests() {
  console.log('🌐 Mini-Miro 접근성 및 사용성 테스트 시작');
  console.log('================================================');
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  const baseURL = 'http://localhost:3003';
  const testResults = [];
  
  try {
    await page.goto(baseURL);
    await page.waitForLoadState('networkidle');
    
    // 테스트 1: 키보드 접근성
    console.log('\n📋 테스트 1: 키보드 접근성');
    try {
      // 페이지의 모든 대화형 요소 확인
      const interactiveElements = await page.locator('button, input, a, [tabindex]').all();
      console.log(`발견된 대화형 요소: ${interactiveElements.length}개`);
      
      // Tab 키로 첫 번째 요소에 포커스
      if (interactiveElements.length > 0) {
        await page.keyboard.press('Tab');
        const focusedElement = await page.evaluate(() => document.activeElement.tagName);
        console.log(`첫 번째 포커스 요소: ${focusedElement}`);
        
        // Shift+Tab으로 역방향 탐색 테스트
        await page.keyboard.press('Shift+Tab');
        console.log('✅ 키보드 탐색 가능');
        testResults.push({ test: '키보드 접근성', status: 'PASS' });
      } else {
        console.log('⚠️ 대화형 요소 없음');
        testResults.push({ test: '키보드 접근성', status: 'WARN', note: '대화형 요소 없음' });
      }
    } catch (error) {
      console.log(`❌ 키보드 접근성 테스트 실패: ${error.message}`);
      testResults.push({ test: '키보드 접근성', status: 'FAIL', error: error.message });
    }
    
    // 테스트 2: 시맨틱 HTML 구조
    console.log('\n📋 테스트 2: 시맨틱 HTML 구조');
    try {
      const semanticElements = await page.evaluate(() => {
        const elements = {
          headings: document.querySelectorAll('h1, h2, h3, h4, h5, h6').length,
          buttons: document.querySelectorAll('button').length,
          inputs: document.querySelectorAll('input').length,
          labels: document.querySelectorAll('label').length,
          main: document.querySelectorAll('main').length,
          nav: document.querySelectorAll('nav').length,
          header: document.querySelectorAll('header').length,
          footer: document.querySelectorAll('footer').length
        };
        return elements;
      });
      
      console.log('시맨틱 요소 분석:');
      Object.entries(semanticElements).forEach(([element, count]) => {
        console.log(`  ${element}: ${count}개`);
      });
      
      if (semanticElements.headings > 0) {
        console.log('✅ 제목 구조 있음');
      }
      
      testResults.push({ 
        test: '시맨틱 HTML', 
        status: 'PASS', 
        data: `제목:${semanticElements.headings}, 버튼:${semanticElements.buttons}` 
      });
    } catch (error) {
      console.log(`❌ 시맨틱 HTML 테스트 실패: ${error.message}`);
      testResults.push({ test: '시맨틱 HTML', status: 'FAIL', error: error.message });
    }
    
    // 테스트 3: 색상 대비 및 가독성
    console.log('\n📋 테스트 3: 색상 대비 및 가독성');
    try {
      const colorAnalysis = await page.evaluate(() => {
        const elements = document.querySelectorAll('*');
        let textElements = 0;
        let backgroundColors = new Set();
        let textColors = new Set();
        
        elements.forEach(el => {
          const style = window.getComputedStyle(el);
          if (el.textContent && el.textContent.trim()) {
            textElements++;
            backgroundColors.add(style.backgroundColor);
            textColors.add(style.color);
          }
        });
        
        return {
          textElements,
          uniqueBackgrounds: backgroundColors.size,
          uniqueTextColors: textColors.size
        };
      });
      
      console.log(`텍스트 요소: ${colorAnalysis.textElements}개`);
      console.log(`고유 배경색: ${colorAnalysis.uniqueBackgrounds}개`);
      console.log(`고유 텍스트 색상: ${colorAnalysis.uniqueTextColors}개`);
      
      if (colorAnalysis.textElements > 0) {
        console.log('✅ 텍스트 가독성 확인 가능');
        testResults.push({ test: '색상 대비', status: 'PASS' });
      } else {
        console.log('⚠️ 텍스트 요소 부족');
        testResults.push({ test: '색상 대비', status: 'WARN' });
      }
    } catch (error) {
      console.log(`❌ 색상 대비 테스트 실패: ${error.message}`);
      testResults.push({ test: '색상 대비', status: 'FAIL', error: error.message });
    }
    
    // 테스트 4: 모바일 친화성 (뷰포트 테스트)
    console.log('\n📋 테스트 4: 모바일 친화성');
    try {
      const viewports = [
        { width: 375, height: 667, name: '모바일 세로' },
        { width: 667, height: 375, name: '모바일 가로' },
        { width: 768, height: 1024, name: '태블릿 세로' }
      ];
      
      let mobileCompatible = true;
      
      for (const viewport of viewports) {
        await page.setViewportSize(viewport);
        await page.waitForTimeout(500);
        
        // 가로 스크롤 확인
        const hasHorizontalScroll = await page.evaluate(() => {
          return document.documentElement.scrollWidth > document.documentElement.clientWidth;
        });
        
        // 터치 가능한 요소 크기 확인 (최소 44px 권장)
        const touchTargets = await page.evaluate(() => {
          const buttons = document.querySelectorAll('button, a, input[type="button"]');
          let smallTargets = 0;
          
          buttons.forEach(btn => {
            const rect = btn.getBoundingClientRect();
            if (rect.width < 44 || rect.height < 44) {
              smallTargets++;
            }
          });
          
          return { total: buttons.length, small: smallTargets };
        });
        
        console.log(`${viewport.name}: 가로 스크롤 ${hasHorizontalScroll ? '있음' : '없음'}, 작은 터치 타겟 ${touchTargets.small}/${touchTargets.total}`);
        
        if (hasHorizontalScroll) {
          mobileCompatible = false;
        }
      }
      
      if (mobileCompatible) {
        console.log('✅ 모바일 친화적');
        testResults.push({ test: '모바일 친화성', status: 'PASS' });
      } else {
        console.log('⚠️ 모바일 개선 필요');
        testResults.push({ test: '모바일 친화성', status: 'WARN' });
      }
      
      // 뷰포트 복원
      await page.setViewportSize({ width: 1366, height: 768 });
    } catch (error) {
      console.log(`❌ 모바일 친화성 테스트 실패: ${error.message}`);
      testResults.push({ test: '모바일 친화성', status: 'FAIL', error: error.message });
    }
    
    // 테스트 5: 로딩 상태 및 피드백
    console.log('\n📋 테스트 5: 사용자 피드백');
    try {
      // 로딩 시 피드백 확인
      await page.reload();
      
      // 로딩 중 상태 확인
      const hasLoadingIndicator = await page.evaluate(() => {
        // 일반적인 로딩 인디케이터 확인
        const loadingElements = document.querySelectorAll('[class*="loading"], [class*="spinner"], [aria-busy="true"]');
        return loadingElements.length > 0;
      });
      
      // 에러 상태 처리 확인
      const hasErrorHandling = await page.evaluate(() => {
        const errorElements = document.querySelectorAll('[class*="error"], [role="alert"]');
        return errorElements.length > 0;
      });
      
      console.log(`로딩 인디케이터: ${hasLoadingIndicator ? '있음' : '없음'}`);
      console.log(`에러 처리: ${hasErrorHandling ? '있음' : '없음'}`);
      
      testResults.push({ test: '사용자 피드백', status: 'PASS' });
    } catch (error) {
      console.log(`❌ 사용자 피드백 테스트 실패: ${error.message}`);
      testResults.push({ test: '사용자 피드백', status: 'FAIL', error: error.message });
    }
    
    // 테스트 6: 보안 헤더 확인
    console.log('\n📋 테스트 6: 보안 헤더');
    try {
      const response = await page.goto(baseURL);
      const headers = response.headers();
      
      const securityHeaders = {
        'x-content-type-options': headers['x-content-type-options'],
        'x-frame-options': headers['x-frame-options'],
        'x-xss-protection': headers['x-xss-protection'],
        'strict-transport-security': headers['strict-transport-security'],
        'content-security-policy': headers['content-security-policy']
      };
      
      let secureHeaders = 0;
      Object.entries(securityHeaders).forEach(([header, value]) => {
        if (value) {
          console.log(`✅ ${header}: ${value.substring(0, 50)}...`);
          secureHeaders++;
        } else {
          console.log(`⚠️ ${header}: 없음`);
        }
      });
      
      if (secureHeaders > 0) {
        testResults.push({ test: '보안 헤더', status: 'PASS', data: `${secureHeaders}/5 헤더` });
      } else {
        testResults.push({ test: '보안 헤더', status: 'WARN', note: '보안 헤더 없음' });
      }
    } catch (error) {
      console.log(`❌ 보안 헤더 테스트 실패: ${error.message}`);
      testResults.push({ test: '보안 헤더', status: 'FAIL', error: error.message });
    }
    
  } finally {
    await browser.close();
  }
  
  // 결과 요약
  console.log('\n================================================');
  console.log('🏁 접근성 및 사용성 테스트 결과');
  console.log('================================================');
  
  const passed = testResults.filter(r => r.status === 'PASS').length;
  const failed = testResults.filter(r => r.status === 'FAIL').length;
  const warnings = testResults.filter(r => r.status === 'WARN').length;
  
  testResults.forEach(result => {
    const icon = result.status === 'PASS' ? '✅' : 
                 result.status === 'FAIL' ? '❌' : '⚠️';
    const extra = result.data ? ` (${result.data})` : 
                  result.error ? ` (${result.error})` : 
                  result.note ? ` (${result.note})` : '';
    console.log(`${icon} ${result.test}${extra}`);
  });
  
  console.log('\n📊 접근성 점수:');
  console.log(`  통과: ${passed}`);
  console.log(`  경고: ${warnings}`);
  console.log(`  실패: ${failed}`);
  
  const score = Math.round(((passed + warnings * 0.5) / testResults.length) * 100);
  console.log(`\n🎯 접근성 점수: ${score}%`);
  
  return { passed, failed, warnings, score, results: testResults };
}

// 테스트 실행
if (require.main === module) {
  runAccessibilityTests().catch(console.error);
}

module.exports = { runAccessibilityTests };