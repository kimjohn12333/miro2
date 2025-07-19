import React, { useState, useEffect } from 'react';
import io, { Socket } from 'socket.io-client';
import DiagramList from './components/DiagramList';
import Whiteboard from './components/Whiteboard';
import { Diagram } from './types';
import './App.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3003';

function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [userName, setUserName] = useState<string>('');
  const [currentDiagram, setCurrentDiagram] = useState<Diagram | null>(null);
  const [diagrams, setDiagrams] = useState<Diagram[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // 사용자 이름 설정
    const savedName = localStorage.getItem('miniMiroUserName');
    const name = savedName || 
                 prompt('이름을 입력하세요:') || 
                 `User-${Math.random().toString(36).substr(2, 6)}`;
    
    localStorage.setItem('miniMiroUserName', name);
    setUserName(name);

    // Socket.io 연결
    const newSocket = io(API_URL);
    newSocket.emit('identify', { userName: name });
    setSocket(newSocket);

    // 다이어그램 목록 로드
    loadDiagrams();

    return () => {
      newSocket.close();
    };
  }, []);

  const loadDiagrams = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`${API_URL}/api/diagrams`);
      const data = await response.json();
      setDiagrams(data);
    } catch (error) {
      console.error('Failed to load diagrams:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const createNewDiagram = async () => {
    const title = prompt('다이어그램 제목을 입력하세요:');
    if (!title) return;

    try {
      const response = await fetch(`${API_URL}/api/diagrams`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title })
      });

      if (response.ok) {
        const newDiagram = await response.json();
        setDiagrams([newDiagram, ...diagrams]);
      } else {
        alert('다이어그램 생성에 실패했습니다.');
      }
    } catch (error) {
      console.error('Failed to create diagram:', error);
      alert('다이어그램 생성에 실패했습니다.');
    }
  };

  const openDiagram = async (id: number) => {
    try {
      const response = await fetch(`${API_URL}/api/diagrams/${id}`);
      if (response.ok) {
        const diagram = await response.json();
        setCurrentDiagram(diagram);
      } else {
        alert('다이어그램을 불러올 수 없습니다.');
      }
    } catch (error) {
      console.error('Failed to load diagram:', error);
      alert('다이어그램을 불러올 수 없습니다.');
    }
  };

  const deleteDiagram = async (id: number) => {
    if (!window.confirm('정말 삭제하시겠습니까?')) return;

    try {
      const response = await fetch(`${API_URL}/api/diagrams/${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setDiagrams(diagrams.filter(d => d.id !== id));
      } else {
        alert('삭제에 실패했습니다.');
      }
    } catch (error) {
      console.error('Failed to delete diagram:', error);
      alert('삭제에 실패했습니다.');
    }
  };

  const backToList = () => {
    setCurrentDiagram(null);
  };

  if (isLoading) {
    return (
      <div className="app-loading">
        <div className="loading-spinner"></div>
        <p>로딩 중...</p>
      </div>
    );
  }

  return (
    <div className="app">
      {!currentDiagram ? (
        <div className="diagram-list-view">
          <header className="app-header-main">
            <h1>Mini-Miro</h1>
            <div className="user-info">
              <span>사용자: {userName}</span>
              <button onClick={() => {
                localStorage.removeItem('miniMiroUserName');
                window.location.reload();
              }}>
                이름 변경
              </button>
            </div>
          </header>
          
          <div className="main-content">
            <div className="content-header">
              <h2>내 다이어그램</h2>
              <button 
                className="btn-primary" 
                onClick={createNewDiagram}
              >
                새 다이어그램
              </button>
            </div>
            
            <DiagramList 
              diagrams={diagrams}
              onOpen={openDiagram}
              onDelete={deleteDiagram}
            />
          </div>
        </div>
      ) : (
        <Whiteboard
          diagram={currentDiagram}
          socket={socket}
          userName={userName}
          onBack={backToList}
        />
      )}
    </div>
  );
}

export default App;
