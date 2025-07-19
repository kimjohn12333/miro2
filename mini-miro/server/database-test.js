// 데이터베이스 무결성 테스트
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'minimiro.db');
const db = new sqlite3.Database(dbPath);

console.log('=== 데이터베이스 무결성 테스트 시작 ===');

const tests = [
  { name: '테이블 구조 확인', passed: false },
  { name: '외래키 제약조건 확인', passed: false },
  { name: '데이터 타입 무결성 확인', passed: false },
  { name: '샘플 데이터 존재 확인', passed: false },
  { name: 'CRUD 작업 테스트', passed: false },
  { name: '트랜잭션 무결성 확인', passed: false }
];

// 테스트 1: 테이블 구조 확인
function test1() {
  return new Promise((resolve) => {
    console.log('\n📝 테스트 1: 테이블 구조 확인');
    
    const expectedTables = ['diagrams', 'diagram_contents', 'users'];
    let foundTables = [];
    
    db.all(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`, (err, rows) => {
      if (err) {
        console.log('  ❌ 테이블 조회 실패:', err.message);
        resolve(false);
        return;
      }
      
      foundTables = rows.map(row => row.name);
      console.log('  📋 발견된 테이블:', foundTables.join(', '));
      
      const hasAllTables = expectedTables.every(table => foundTables.includes(table));
      
      if (hasAllTables) {
        console.log('  ✅ 모든 필수 테이블이 존재함');
        tests[0].passed = true;
        resolve(true);
      } else {
        const missing = expectedTables.filter(table => !foundTables.includes(table));
        console.log('  ❌ 누락된 테이블:', missing.join(', '));
        resolve(false);
      }
    });
  });
}

// 테스트 2: 외래키 제약조건 확인
function test2() {
  return new Promise((resolve) => {
    console.log('\n📝 테스트 2: 외래키 제약조건 확인');
    
    db.get(`PRAGMA foreign_key_list(diagram_contents)`, (err, row) => {
      if (err) {
        console.log('  ❌ 외래키 조회 실패:', err.message);
        resolve(false);
        return;
      }
      
      if (row && row.table === 'diagrams') {
        console.log('  ✅ diagram_contents → diagrams 외래키 존재');
        tests[1].passed = true;
        resolve(true);
      } else {
        console.log('  ❌ 외래키 제약조건이 없음');
        resolve(false);
      }
    });
  });
}

// 테스트 3: 데이터 타입 무결성 확인
function test3() {
  return new Promise((resolve) => {
    console.log('\n📝 테스트 3: 데이터 타입 무결성 확인');
    
    db.all(`PRAGMA table_info(diagrams)`, (err, rows) => {
      if (err) {
        console.log('  ❌ 테이블 정보 조회 실패:', err.message);
        resolve(false);
        return;
      }
      
      const expectedColumns = {
        'id': 'INTEGER',
        'title': 'TEXT',
        'description': 'TEXT',
        'type': 'TEXT',
        'created_at': 'DATETIME',
        'updated_at': 'DATETIME'
      };
      
      let allCorrect = true;
      
      rows.forEach(row => {
        const expectedType = expectedColumns[row.name];
        if (expectedType && row.type !== expectedType) {
          console.log(`  ❌ ${row.name}: 예상 ${expectedType}, 실제 ${row.type}`);
          allCorrect = false;
        }
      });
      
      if (allCorrect) {
        console.log('  ✅ 모든 컬럼의 데이터 타입이 올바름');
        tests[2].passed = true;
        resolve(true);
      } else {
        resolve(false);
      }
    });
  });
}

// 테스트 4: 샘플 데이터 존재 확인
function test4() {
  return new Promise((resolve) => {
    console.log('\n📝 테스트 4: 샘플 데이터 존재 확인');
    
    db.get(`SELECT COUNT(*) as count FROM diagrams`, (err, row) => {
      if (err) {
        console.log('  ❌ 데이터 조회 실패:', err.message);
        resolve(false);
        return;
      }
      
      const count = row.count;
      console.log(`  📊 다이어그램 개수: ${count}개`);
      
      if (count > 0) {
        // 샘플 다이어그램의 내용도 확인
        db.get(`SELECT * FROM diagram_contents WHERE diagram_id = 1`, (err, contentRow) => {
          if (err) {
            console.log('  ❌ 다이어그램 내용 조회 실패:', err.message);
            resolve(false);
            return;
          }
          
          if (contentRow && contentRow.content) {
            try {
              const content = JSON.parse(contentRow.content);
              console.log(`  📝 샘플 노드 개수: ${content.nodes?.length || 0}개`);
              console.log(`  📝 샘플 엣지 개수: ${content.edges?.length || 0}개`);
              console.log('  ✅ 샘플 데이터가 올바르게 존재함');
              tests[3].passed = true;
              resolve(true);
            } catch (parseErr) {
              console.log('  ❌ JSON 파싱 실패:', parseErr.message);
              resolve(false);
            }
          } else {
            console.log('  ❌ 다이어그램 내용이 없음');
            resolve(false);
          }
        });
      } else {
        console.log('  ❌ 샘플 데이터가 없음');
        resolve(false);
      }
    });
  });
}

// 테스트 5: CRUD 작업 테스트
function test5() {
  return new Promise((resolve) => {
    console.log('\n📝 테스트 5: CRUD 작업 테스트');
    
    const testTitle = `테스트 다이어그램 ${Date.now()}`;
    
    // CREATE
    db.run(`INSERT INTO diagrams (title, description, type) VALUES (?, ?, ?)`, 
           [testTitle, '테스트용', 'flowchart'], 
           function(err) {
      if (err) {
        console.log('  ❌ CREATE 실패:', err.message);
        resolve(false);
        return;
      }
      
      const newId = this.lastID;
      console.log('  ✅ CREATE 성공, ID:', newId);
      
      // READ
      db.get(`SELECT * FROM diagrams WHERE id = ?`, [newId], (err, row) => {
        if (err) {
          console.log('  ❌ READ 실패:', err.message);
          resolve(false);
          return;
        }
        
        if (row && row.title === testTitle) {
          console.log('  ✅ READ 성공');
          
          // UPDATE
          const newTitle = testTitle + ' (수정됨)';
          db.run(`UPDATE diagrams SET title = ? WHERE id = ?`, [newTitle, newId], (err) => {
            if (err) {
              console.log('  ❌ UPDATE 실패:', err.message);
              resolve(false);
              return;
            }
            
            console.log('  ✅ UPDATE 성공');
            
            // DELETE
            db.run(`DELETE FROM diagrams WHERE id = ?`, [newId], (err) => {
              if (err) {
                console.log('  ❌ DELETE 실패:', err.message);
                resolve(false);
                return;
              }
              
              console.log('  ✅ DELETE 성공');
              tests[4].passed = true;
              resolve(true);
            });
          });
        } else {
          console.log('  ❌ READ 실패: 데이터 불일치');
          resolve(false);
        }
      });
    });
  });
}

// 테스트 6: 트랜잭션 무결성 확인
function test6() {
  return new Promise((resolve) => {
    console.log('\n📝 테스트 6: 트랜잭션 무결성 확인');
    
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      
      const testTitle = `트랜잭션 테스트 ${Date.now()}`;
      
      db.run(`INSERT INTO diagrams (title, description, type) VALUES (?, ?, ?)`, 
             [testTitle, '트랜잭션 테스트용', 'flowchart'], 
             function(err) {
        if (err) {
          console.log('  ❌ 트랜잭션 내 INSERT 실패:', err.message);
          db.run('ROLLBACK');
          resolve(false);
          return;
        }
        
        const newId = this.lastID;
        
        // 의도적으로 롤백
        db.run('ROLLBACK', (err) => {
          if (err) {
            console.log('  ❌ ROLLBACK 실패:', err.message);
            resolve(false);
            return;
          }
          
          // 롤백 후 데이터가 없는지 확인
          db.get(`SELECT * FROM diagrams WHERE id = ?`, [newId], (err, row) => {
            if (err) {
              console.log('  ❌ 롤백 후 확인 실패:', err.message);
              resolve(false);
              return;
            }
            
            if (!row) {
              console.log('  ✅ 트랜잭션 롤백이 올바르게 작동함');
              tests[5].passed = true;
              resolve(true);
            } else {
              console.log('  ❌ 롤백 후에도 데이터가 남아있음');
              resolve(false);
            }
          });
        });
      });
    });
  });
}

// 모든 테스트 실행
async function runAllTests() {
  try {
    await test1();
    await test2();
    await test3();
    await test4();
    await test5();
    await test6();
    
    showResults();
  } catch (error) {
    console.log('❌ 테스트 실행 중 오류:', error.message);
    showResults();
  } finally {
    db.close();
  }
}

function showResults() {
  console.log('\n=== 데이터베이스 무결성 테스트 결과 ===');
  
  let passed = 0;
  tests.forEach((test, index) => {
    const icon = test.passed ? '✅' : '❌';
    console.log(`${icon} ${index + 1}. ${test.name}`);
    if (test.passed) passed++;
  });
  
  console.log(`\n📊 통과율: ${passed}/${tests.length} (${Math.round(passed/tests.length*100)}%)`);
}

runAllTests();