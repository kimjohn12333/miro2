import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Stage, Layer, Rect, Ellipse, Text as KonvaText, Line, Arrow, Path } from 'react-konva';
import { Socket } from 'socket.io-client';
import { Diagram, Node, Edge, LockStatus, DiagramChanges } from '../types';
import ToolPanel from './ToolPanel';
import PropertiesPanel from './PropertiesPanel';
import EdgeOptionsPanel from './EdgeOptionsPanel';
import SelectionIndicator from './SelectionIndicator';
import InlineTextEditor from './InlineTextEditor';
import MermaidInput from './MermaidInput';
import './Whiteboard.css';

interface Props {
  diagram: Diagram;
  socket: Socket | null;
  userName: string;
  onBack: () => void;
}

const Whiteboard: React.FC<Props> = ({ diagram, socket, userName, onBack }) => {
  const [tool, setTool] = useState<string>('select');
  const [nodes, setNodes] = useState<Node[]>(diagram.content?.nodes || []);
  const [edges, setEdges] = useState<Edge[]>(diagram.content?.edges || []);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [selectedNodes, setSelectedNodes] = useState<Set<string>>(new Set());
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionRect, setSelectionRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [highlightedElements, setHighlightedElements] = useState<{
    nodes: Set<string>;
    edges: Set<string>;
  }>({ nodes: new Set(), edges: new Set() });
  const [isCreatingEdge, setIsCreatingEdge] = useState(false);
  const [edgeStart, setEdgeStart] = useState<string | null>(null);
  const [tempEdgeEnd, setTempEdgeEnd] = useState<{ x: number; y: number } | null>(null);
  const [showEdgeOptions, setShowEdgeOptions] = useState(false);
  const [edgeOptions, setEdgeOptions] = useState({
    strokeWidth: 2,
    strokeStyle: 'solid' as 'solid' | 'dashed' | 'dotted',
    edgeType: 'straight' as 'straight' | 'curved' | 'orthogonal',
    arrowStart: false,
    arrowEnd: true,
    stroke: '#666666'
  });
  
  // Edge label editing state
  const [editingEdgeLabel, setEditingEdgeLabel] = useState<string | null>(null);
  const [edgeLabelText, setEdgeLabelText] = useState<string>('');
  const [edgeLabelPosition, setEdgeLabelPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  
  // Mermaid import state
  const [showMermaidInput, setShowMermaidInput] = useState(false);

  // 도구 변경 시 연결선 생성 모드 리셋
  const handleToolChange = useCallback((newTool: string) => {
    setTool(newTool);
    if (isCreatingEdge) {
      setIsCreatingEdge(false);
      setEdgeStart(null);
      setTempEdgeEnd(null);
    }
  }, [isCreatingEdge]);
  const [lockStatus, setLockStatus] = useState<LockStatus>({ locked: false });
  const [zoom, setZoom] = useState(100);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const stageRef = useRef<any>(null);
  
  const isLocked = lockStatus.locked && lockStatus.lockedBy === userName;
  
  // Debug isLocked state changes
  React.useEffect(() => {
    console.log('🔄 [isLocked] State changed:', {
      isLocked,
      lockStatus,
      userName,
      calculation: `${lockStatus.locked} && ${lockStatus.lockedBy} === ${userName}`
    });
  }, [isLocked, lockStatus, userName]);

  // 연결된 요소들을 찾는 함수 (성능 최적화)
  const findConnectedElements = useCallback((nodeId: string) => {
    const connectedNodes = new Set<string>([nodeId]);
    const connectedEdges = new Set<string>();
    
    // 직접 연결된 엣지들 찾기
    edges.forEach(edge => {
      if (edge.from === nodeId || edge.to === nodeId) {
        connectedEdges.add(edge.id);
        // 연결된 다른 노드도 추가
        if (edge.from === nodeId) {
          connectedNodes.add(edge.to);
        } else {
          connectedNodes.add(edge.from);
        }
      }
    });
    
    return { nodes: connectedNodes, edges: connectedEdges };
  }, [edges]);

  // 빈 공간 클릭 시 하이라이트 해제
  const clearHighlight = useCallback(() => {
    setHighlightedElements({ nodes: new Set(), edges: new Set() });
    setSelectedNode(null);
    setSelectedNodes(new Set());
    setSelectedEdge(null);
  }, []);

  // 도형 경계와 직선의 교점 계산 유틸리티 함수들
  const getShapeEdgePoint = useCallback((shape: Node, fromPoint: {x: number, y: number}, toPoint: {x: number, y: number}, isStartPoint: boolean = false) => {
    const center = {
      x: shape.x + shape.width / 2,
      y: shape.y + shape.height / 2
    };

    // 교점을 구할 방향 벡터 (시작점이면 반대 방향)
    const targetPoint = isStartPoint ? fromPoint : toPoint;
    const sourcePoint = isStartPoint ? toPoint : fromPoint;
    
    const dx = targetPoint.x - sourcePoint.x;
    const dy = targetPoint.y - sourcePoint.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance === 0) return center;
    
    // 정규화된 방향 벡터
    const dirX = dx / distance;
    const dirY = dy / distance;

    if (shape.type === 'rectangle') {
      // 사각형과 직선의 교점 계산
      const halfWidth = shape.width / 2;
      const halfHeight = shape.height / 2;
      
      // 중심에서 목표점으로의 방향으로 사각형 경계까지의 거리 계산
      const absX = Math.abs(dirX);
      const absY = Math.abs(dirY);
      
      let t: number;
      if (absX / halfWidth > absY / halfHeight) {
        // 좌우 면과 교차
        t = halfWidth / absX;
      } else {
        // 상하 면과 교차
        t = halfHeight / absY;
      }
      
      return {
        x: center.x + dirX * t,
        y: center.y + dirY * t
      };
    } else if (shape.type === 'ellipse') {
      // 타원과 직선의 교점 계산
      const a = shape.width / 2;  // 반장축
      const b = shape.height / 2; // 반단축
      
      // 타원의 매개변수 방정식을 이용한 교점 계산
      const angle = Math.atan2(dirY, dirX);
      const cosAngle = Math.cos(angle);
      const sinAngle = Math.sin(angle);
      
      // 타원 경계 상의 점 계산
      const denominator = Math.sqrt((b * cosAngle) ** 2 + (a * sinAngle) ** 2);
      const radius = (a * b) / denominator;
      
      return {
        x: center.x + radius * cosAngle,
        y: center.y + radius * sinAngle
      };
    }
    
    // 기본값 (텍스트 등)
    return center;
  }, []);

  // 두 도형 간의 최적 연결점 계산
  const calculateConnectionPoints = useCallback((fromNode: Node, toNode: Node) => {
    const fromCenter = {
      x: fromNode.x + fromNode.width / 2,
      y: fromNode.y + fromNode.height / 2
    };
    const toCenter = {
      x: toNode.x + toNode.width / 2,
      y: toNode.y + toNode.height / 2
    };

    // 각 도형의 경계 접점 계산
    const fromPoint = getShapeEdgePoint(fromNode, fromCenter, toCenter, false);
    const toPoint = getShapeEdgePoint(toNode, toCenter, fromCenter, false);

    return { fromPoint, toPoint };
  }, [getShapeEdgePoint]);

  // 연결선의 중점 계산 (레이블 위치용)
  const calculateEdgeMidpoint = useCallback((edge: Edge, fromNode: Node, toNode: Node) => {
    const { fromPoint, toPoint } = calculateConnectionPoints(fromNode, toNode);
    
    switch (edge.edgeType) {
      case 'curved':
        // 베지어 곡선의 중점 (t=0.5에서의 점)
        const midX = (fromPoint.x + toPoint.x) / 2;
        const midY = (fromPoint.y + toPoint.y) / 2;
        const controlOffset = Math.min(100, Math.abs(toPoint.x - fromPoint.x) * 0.3);
        // 베지어 곡선의 실제 중점 계산
        return {
          x: midX,
          y: midY - controlOffset / 2 // 곡선 효과를 반영한 Y 위치
        };
      
      case 'orthogonal':
        // L자 형태의 중점
        const midPointX = fromPoint.x + (toPoint.x - fromPoint.x) * 0.5;
        return {
          x: midPointX,
          y: fromPoint.y + (toPoint.y - fromPoint.y) * 0.5
        };
      
      default:
        // 직선의 중점
        return {
          x: (fromPoint.x + toPoint.x) / 2,
          y: (fromPoint.y + toPoint.y) / 2
        };
    }
  }, [calculateConnectionPoints]);

  // 연결선 생성 함수
  const createEdge = useCallback((fromNodeId: string, toNodeId: string) => {
    if (!isLocked) return;

    const newEdge: Edge = {
      id: `edge-${Date.now()}`,
      from: fromNodeId,
      to: toNodeId,
      points: [],
      stroke: edgeOptions.stroke,
      strokeWidth: edgeOptions.strokeWidth,
      strokeStyle: edgeOptions.strokeStyle,
      edgeType: edgeOptions.edgeType,
      arrowStart: edgeOptions.arrowStart,
      arrowEnd: edgeOptions.arrowEnd
    };
    
    setEdges([...edges, newEdge]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    emitChanges({ edges: { added: [newEdge] } });
  }, [isLocked, edges, edgeOptions]);

  // 스테이지 마우스 이동 핸들러 (드래그 선택용)
  const handleStageMouseMoveNew = useCallback((e: any) => {
    if (isCreatingEdge && edgeStart) {
      const pos = e.target.getStage().getPointerPosition();
      const stageScale = stageRef.current.scaleX();
      const adjustedPos = {
        x: (pos.x - stagePos.x) / stageScale,
        y: (pos.y - stagePos.y) / stageScale
      };
      setTempEdgeEnd(adjustedPos);
    } else if (isSelecting && dragStart && tool === 'select') {
      const pos = e.target.getStage().getPointerPosition();
      const stageScale = stageRef.current.scaleX();
      if (pos) {
        const adjustedPos = {
          x: (pos.x - stagePos.x) / stageScale,
          y: (pos.y - stagePos.y) / stageScale
        };
        
        const x = Math.min(dragStart.x, adjustedPos.x);
        const y = Math.min(dragStart.y, adjustedPos.y);
        const width = Math.abs(adjustedPos.x - dragStart.x);
        const height = Math.abs(adjustedPos.y - dragStart.y);
        
        setSelectionRect({ x, y, width, height });
      }
    }
  }, [isCreatingEdge, edgeStart, stagePos, isSelecting, dragStart, tool]);

  // 스테이지 마우스 업 핸들러 (드래그 선택 완료)
  const handleStageMouseUp = useCallback((e: any) => {
    if (isSelecting && selectionRect) {
      // 선택 영역 안의 노드들 찾기
      const selectedNodeIds = new Set<string>();
      nodes.forEach(node => {
        const nodeRight = node.x + node.width;
        const nodeBottom = node.y + node.height;
        const rectRight = selectionRect.x + selectionRect.width;
        const rectBottom = selectionRect.y + selectionRect.height;
        
        // 노드가 선택 영역과 교차하는지 확인
        if (node.x < rectRight && nodeRight > selectionRect.x &&
            node.y < rectBottom && nodeBottom > selectionRect.y) {
          selectedNodeIds.add(node.id);
        }
      });
      
      if (e.evt && e.evt.shiftKey) {
        // Shift 키를 누르고 있으면 기존 선택에 추가
        const newSelection = new Set([...Array.from(selectedNodes), ...Array.from(selectedNodeIds)]);
        setSelectedNodes(newSelection);
      } else {
        // 새로운 선택으로 교체
        setSelectedNodes(selectedNodeIds);
      }
      
      // 한 개만 선택된 경우 selectedNode도 설정 (기존 로직 호환성)
      if (selectedNodeIds.size === 1) {
        setSelectedNode(Array.from(selectedNodeIds)[0]);
      } else {
        setSelectedNode(null);
      }
    }
    
    // 선택 상태 리셋
    setIsSelecting(false);
    setDragStart(null);
    setSelectionRect(null);
  }, [isSelecting, selectionRect, nodes, selectedNodes]);

  // 노드 클릭 핸들러 (하이라이트 기능 포함)
  const handleNodeClick = useCallback((nodeId: string, e?: any) => {
    if (tool === 'select') {
      if (e && e.evt && e.evt.shiftKey) {
        // Shift 클릭: 다중 선택 모드
        const newSelection = new Set(selectedNodes);
        if (newSelection.has(nodeId)) {
          newSelection.delete(nodeId);
        } else {
          newSelection.add(nodeId);
        }
        setSelectedNodes(newSelection);
        
        if (newSelection.size === 1) {
          setSelectedNode(Array.from(newSelection)[0]);
        } else {
          setSelectedNode(null);
        }
      } else {
        // 일반 클릭: 단일 선택 모드
        setSelectedNode(nodeId);
        setSelectedNodes(new Set([nodeId]));
      }
      
      // 연결된 요소들 하이라이트 (선택된 노드들 기준)
      const allConnected = { nodes: new Set<string>(), edges: new Set<string>() };
      const currentSelection = e && e.evt && e.evt.shiftKey ? selectedNodes : new Set([nodeId]);
      
      currentSelection.forEach(id => {
        const connected = findConnectedElements(id);
        connected.nodes.forEach(nodeId => allConnected.nodes.add(nodeId));
        connected.edges.forEach(edgeId => allConnected.edges.add(edgeId));
      });
      
      setHighlightedElements(allConnected);
      
      // 선택된 노드로 뷰포트 부드럽게 이동 (선택적 센터링)
      const selectedNodeData = nodes.find(n => n.id === nodeId);
      if (selectedNodeData && stageRef.current) {
        const stage = stageRef.current;
        const stageWidth = stage.width();
        const stageHeight = stage.height();
        
        // 노드가 현재 뷰포트 밖에 있는 경우에만 센터링
        const nodeCenter = {
          x: selectedNodeData.x + selectedNodeData.width / 2,
          y: selectedNodeData.y + selectedNodeData.height / 2
        };
        
        const scale = zoom / 100;
        const visibleRect = {
          x: -stagePos.x / scale,
          y: -stagePos.y / scale,
          width: stageWidth / scale,
          height: stageHeight / scale
        };
        
        // 노드가 뷰포트 밖에 있는지 확인
        const isOutsideViewport = (
          nodeCenter.x < visibleRect.x ||
          nodeCenter.x > visibleRect.x + visibleRect.width ||
          nodeCenter.y < visibleRect.y ||
          nodeCenter.y > visibleRect.y + visibleRect.height
        );
        
        if (isOutsideViewport) {
          const newPos = {
            x: stageWidth / 2 - nodeCenter.x * scale,
            y: stageHeight / 2 - nodeCenter.y * scale
          };
          setStagePos(newPos);
        }
      }
    } else if (tool === 'arrow') {
      if (!isCreatingEdge) {
        // 연결선 생성 시작
        setIsCreatingEdge(true);
        setEdgeStart(nodeId);
        setSelectedNode(null);
        clearHighlight();
      } else if (edgeStart && edgeStart !== nodeId) {
        // 연결선 생성 완료
        createEdge(edgeStart, nodeId);
        setIsCreatingEdge(false);
        setEdgeStart(null);
        setTempEdgeEnd(null);
      }
    }
  }, [tool, findConnectedElements, isCreatingEdge, edgeStart, clearHighlight, createEdge, nodes, zoom, stagePos, selectedNodes]);

  // 엣지 클릭 핸들러
  const handleEdgeClick = useCallback((edgeId: string) => {
    if (tool === 'select') {
      const edge = edges.find(e => e.id === edgeId);
      if (edge) {
        // 엣지 선택
        setSelectedEdge(edgeId);
        setSelectedNode(null); // 엣지 선택 시 노드 선택 해제
        
        // 엣지와 연결된 노드들 하이라이트
        const connectedNodes = new Set([edge.from, edge.to]);
        const connectedEdges = new Set([edgeId]);
        
        setHighlightedElements({ nodes: connectedNodes, edges: connectedEdges });
      }
    }
  }, [tool, edges]);

  // 엣지 더블클릭 핸들러 (레이블 편집)
  const handleEdgeDoubleClick = useCallback((edgeId: string) => {
    if (tool === 'select' && isLocked) {
      const edge = edges.find(e => e.id === edgeId);
      if (edge) {
        const fromNode = nodes.find(n => n.id === edge.from);
        const toNode = nodes.find(n => n.id === edge.to);
        
        if (fromNode && toNode) {
          // 레이블 편집 모드 시작
          const midpoint = calculateEdgeMidpoint(edge, fromNode, toNode);
          setEditingEdgeLabel(edgeId);
          setEdgeLabelText(edge.label || '');
          setEdgeLabelPosition(midpoint);
        }
      }
    }
  }, [tool, isLocked, edges, nodes, calculateEdgeMidpoint]);

  // 엣지 레이블 저장 함수
  const saveEdgeLabel = useCallback((edgeId: string, label: string) => {
    const trimmedLabel = label.trim();
    
    // 엣지 업데이트
    setEdges(edges.map(edge => 
      edge.id === edgeId 
        ? { ...edge, label: trimmedLabel || undefined }
        : edge
    ));

    // 서버에 변경사항 전송
    if (socket) {
      socket.emit('update-diagram', {
        diagramId: diagram.id,
        changes: {
          edges: {
            updated: [{ id: edgeId, label: trimmedLabel || undefined }]
          }
        }
      });
    }

    // 편집 모드 종료
    setEditingEdgeLabel(null);
    setEdgeLabelText('');
  }, [edges, socket, diagram.id]);

  // 엣지 레이블 편집 취소
  const cancelEdgeLabelEdit = useCallback(() => {
    setEditingEdgeLabel(null);
    setEdgeLabelText('');
  }, []);

  // Mermaid 가져오기 핸들러
  const handleMermaidImport = useCallback((mermaidNodes: Node[], mermaidEdges: Edge[]) => {
    if (!isLocked) {
      alert('편집하려면 먼저 잠금을 획득하세요');
      return;
    }

    // 새로운 노드와 엣지 추가
    const newNodes = [...nodes, ...mermaidNodes];
    const newEdges = [...edges, ...mermaidEdges];
    
    setNodes(newNodes);
    setEdges(newEdges);

    // 서버에 변경사항 전송 - emitChanges를 직접 호출하지 않고 임시로 주석 처리
    if (socket && isLocked) {
      socket.emit('update-diagram', {
        diagramId: diagram.id,
        changes: {
          nodes: { added: mermaidNodes },
          edges: { added: mermaidEdges }
        }
      });
    }
  }, [isLocked, nodes, edges, socket, diagram.id]);

  useEffect(() => {
    if (!socket) {
      console.log('❌ [Whiteboard useEffect] Socket is null, cannot set up listeners');
      return;
    }

    console.log('🚀 [Whiteboard useEffect] Setting up Socket.io listeners for diagram:', diagram.id);
    
    // 다이어그램 참여
    console.log('📤 [Whiteboard] Emitting join-diagram event:', { diagramId: diagram.id });
    socket.emit('join-diagram', { diagramId: diagram.id });

    // Socket 이벤트 리스너
    const handleLockStatus = (status: LockStatus) => {
      console.log('📥 [Whiteboard] Received lock-status event:', status);
      setLockStatus(status);
    };

    const handleLockAcquired = (data: { expiresAt: number }) => {
      console.log('✅ [Whiteboard] Received lock-acquired event:', data);
      console.log('🔒 [Whiteboard] Setting lock status for user:', userName);
      setLockStatus({
        locked: true,
        lockedBy: userName,
        expiresAt: data.expiresAt
      });
    };

    const handleLockReleased = () => {
      console.log('🔓 [Whiteboard] Received lock-released event');
      setLockStatus({ locked: false });
    };

    const handleDiagramUpdated = (data: { changes: DiagramChanges }) => {
      console.log('📝 [Whiteboard] Received diagram-updated event:', data);
      applyChanges(data.changes);
    };

    const handleLockError = (data: { message: string }) => {
      console.log('⚠️ [Whiteboard] Received lock-error event:', data);
      alert(data.message);
    };

    socket.on('lock-status', handleLockStatus);
    socket.on('lock-acquired', handleLockAcquired);
    socket.on('lock-released', handleLockReleased);
    socket.on('diagram-updated', handleDiagramUpdated);
    socket.on('lock-error', handleLockError);

    return () => {
      // 컴포넌트 언마운트 시 편집 잠금 자동 해제
      if (lockStatus.locked && lockStatus.lockedBy === userName) {
        socket.emit('release-lock', { diagramId: diagram.id });
      }
      socket.emit('leave-diagram', { diagramId: diagram.id });
      socket.off('lock-status', handleLockStatus);
      socket.off('lock-acquired', handleLockAcquired);
      socket.off('lock-released', handleLockReleased);
      socket.off('diagram-updated', handleDiagramUpdated);
      socket.off('lock-error', handleLockError);
    };
  }, [socket, diagram.id, userName]);

  // 페이지 이탈 시 편집 잠금 자동 해제
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (lockStatus.locked && lockStatus.lockedBy === userName && socket) {
        socket.emit('release-lock', { diagramId: diagram.id });
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && lockStatus.locked && lockStatus.lockedBy === userName && socket) {
        socket.emit('release-lock', { diagramId: diagram.id });
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [lockStatus, userName, socket, diagram.id]);

  const requestLock = () => {
    console.log('🔐 [requestLock] Function called at:', new Date().toISOString());
    console.log('📡 [requestLock] Socket exists:', !!socket);
    console.log('📋 [requestLock] Diagram ID:', diagram.id);
    console.log('👤 [requestLock] User name:', userName);
    console.log('🔒 [requestLock] Current lock status:', lockStatus);
    
    if (socket) {
      console.log('✅ [requestLock] Emitting request-lock event with payload:', { diagramId: diagram.id });
      socket.emit('request-lock', { diagramId: diagram.id });
      console.log('📤 [requestLock] Event emitted successfully');
    } else {
      console.log('❌ [requestLock] Socket is null, cannot emit request-lock');
      console.log('🔍 [requestLock] Socket state debug:', socket);
    }
  };

  const releaseLock = () => {
    if (socket) {
      socket.emit('release-lock', { diagramId: diagram.id });
    }
  };

  const applyChanges = (changes: DiagramChanges) => {
    if (changes.nodes?.added) {
      setNodes(prev => [...prev, ...changes.nodes!.added!]);
    }
    if (changes.nodes?.updated) {
      setNodes(prev => prev.map(node => {
        const update = changes.nodes!.updated!.find(u => u.id === node.id);
        return update ? { ...node, ...update } : node;
      }));
    }
    if (changes.nodes?.deleted) {
      setNodes(prev => prev.filter(node => !changes.nodes!.deleted!.includes(node.id)));
    }
    
    // 엣지 변경사항 적용
    if (changes.edges?.added) {
      setEdges(prev => [...prev, ...changes.edges!.added!]);
    }
    if (changes.edges?.updated) {
      setEdges(prev => prev.map(edge => {
        const update = changes.edges!.updated!.find(u => u.id === edge.id);
        return update ? { ...edge, ...update } : edge;
      }));
    }
    if (changes.edges?.deleted) {
      setEdges(prev => prev.filter(edge => !changes.edges!.deleted!.includes(edge.id)));
    }
  };

  const emitChanges = (changes: DiagramChanges) => {
    if (socket && isLocked) {
      socket.emit('update-diagram', {
        diagramId: diagram.id,
        changes
      });
    }
  };

  const addNode = (pos: { x: number; y: number }) => {
    if (!isLocked) {
      alert('편집하려면 먼저 잠금을 획득하세요');
      return;
    }

    const newNode: Node = {
      id: `node-${Date.now()}`,
      x: pos.x,
      y: pos.y,
      width: tool === 'text' ? 200 : (tool === 'ellipse' ? 100 : 120),
      height: tool === 'text' ? 40 : (tool === 'ellipse' ? 100 : 60),
      text: tool === 'text' ? '텍스트를 입력하세요' : '새 노드',
      fill: tool === 'text' ? 'transparent' : getRandomColor(),
      type: tool as 'rectangle' | 'ellipse' | 'text',
      stroke: tool === 'text' ? 'transparent' : '#666',
      strokeWidth: tool === 'text' ? 0 : 1
    };

    setNodes([...nodes, newNode]);
    emitChanges({ nodes: { added: [newNode] } });
  };

  const updateNode = (nodeId: string, changes: Partial<Node>) => {
    if (!isLocked) return;

    setNodes(nodes.map(node =>
      node.id === nodeId ? { ...node, ...changes } : node
    ));

    emitChanges({ 
      nodes: { 
        updated: [{ id: nodeId, ...changes }] 
      } 
    });
  };

  const updateEdge = (edgeId: string, changes: Partial<Edge>) => {
    if (!isLocked) return;

    setEdges(edges.map(edge =>
      edge.id === edgeId ? { ...edge, ...changes } : edge
    ));

    emitChanges({ 
      edges: { 
        updated: [{ id: edgeId, ...changes }] 
      } 
    });
  };

  // 텍스트만 지우기 (도형은 유지)
  const clearNodeText = () => {
    if (!isLocked || !selectedNode) return;
    
    const selectedNodeData = nodes.find(node => node.id === selectedNode);
    if (!selectedNodeData) return;
    
    // 텍스트를 빈 문자열로 초기화 (완전히 지우기)
    updateNode(selectedNode, { text: '' });
  };


  // 컨텍스트에 따른 삭제 동작 결정
  const handleDelete = (forceShapeDelete = false) => {
    if (!isLocked) return;
    
    const nodesToDelete = selectedNodes.size > 0 ? selectedNodes : (selectedNode ? new Set([selectedNode]) : new Set());
    
    if (nodesToDelete.size === 0) return;
    
    // Shift 키를 누르고 있거나 forceShapeDelete가 true면 도형 전체 삭제
    if (forceShapeDelete) {
      // 다중 노드 삭제
      const updatedNodes = nodes.filter(node => !nodesToDelete.has(node.id));
      const updatedEdges = edges.filter(
        edge => !nodesToDelete.has(edge.from) && !nodesToDelete.has(edge.to)
      );
      
      setNodes(updatedNodes);
      setEdges(updatedEdges);
      
      // 서버에 변경사항 전송
      emitChanges({ 
        nodes: { deleted: Array.from(nodesToDelete) as string[] },
        edges: { deleted: edges.filter(edge => nodesToDelete.has(edge.from) || nodesToDelete.has(edge.to)).map(e => e.id) }
      });
      
      clearHighlight();
    } else if (selectedNode) {
      // 기본 동작: 텍스트만 지우기 (단일 선택된 노드만)
      clearNodeText();
    }
  };


  const getRandomColor = () => {
    const colors = ['#E3F2FD', '#E8F5E9', '#FFF9C4', '#FFE0B2', '#F3E5F5', '#F5F5F5'];
    return colors[Math.floor(Math.random() * colors.length)];
  };

  // 스테이지 마우스 다운 핸들러 (드래그 선택 시작)
  const handleStageMouseDown = (e: any) => {
    const clickedOnEmpty = e.target === e.target.getStage();
    
    if (clickedOnEmpty) {
      // 연결선 생성 모드 취소
      if (isCreatingEdge) {
        setIsCreatingEdge(false);
        setEdgeStart(null);
        setTempEdgeEnd(null);
      }
      
      // 선택 도구인 경우 드래그 선택 시작
      if (tool === 'select') {
        if (!e.evt.shiftKey) {
          clearHighlight(); // Shift 키가 없으면 하이라이트 해제
        }
        
        // 드래그 선택 시작
        const pos = e.target.getStage().getPointerPosition();
        const stageScale = stageRef.current.scaleX();
        const adjustedPos = {
          x: (pos.x - stagePos.x) / stageScale,
          y: (pos.y - stagePos.y) / stageScale
        };
        
        setIsSelecting(true);
        setDragStart(adjustedPos);
        setSelectionRect({ x: adjustedPos.x, y: adjustedPos.y, width: 0, height: 0 });
      }
    }
  };

  const handleStageClick = (e: any) => {
    const clickedOnEmpty = e.target === e.target.getStage();
    
    if (clickedOnEmpty) {
      // 다른 도구인 경우 노드 생성
      if ((tool === 'rectangle' || tool === 'ellipse' || tool === 'text') && isLocked) {
        const pos = e.target.getStage().getPointerPosition();
        const stageScale = stageRef.current.scaleX();
        const adjustedPos = {
          x: (pos.x - stagePos.x) / stageScale,
          y: (pos.y - stagePos.y) / stageScale
        };
        addNode(adjustedPos);
      }
    }
  };


  // 연결선 경로 생성 함수
  const generateEdgePath = useCallback((edge: Edge, fromNode: Node, toNode: Node) => {
    const { fromPoint, toPoint } = calculateConnectionPoints(fromNode, toNode);

    switch (edge.edgeType) {
      case 'curved':
        // 베지어 곡선 - 도형 경계 접점 사용
        const midX = (fromPoint.x + toPoint.x) / 2;
        const midY = (fromPoint.y + toPoint.y) / 2;
        const controlOffset = Math.min(100, Math.abs(toPoint.x - fromPoint.x) * 0.3);
        return `M${fromPoint.x},${fromPoint.y} Q${midX},${midY - controlOffset} ${toPoint.x},${toPoint.y}`;
      
      case 'orthogonal':
        // 꺾은선 (L자 형태) - 도형 경계 접점 사용
        const midPointX = fromPoint.x + (toPoint.x - fromPoint.x) * 0.5;
        return `M${fromPoint.x},${fromPoint.y} L${midPointX},${fromPoint.y} L${midPointX},${toPoint.y} L${toPoint.x},${toPoint.y}`;
      
      default:
        // 직선 - 도형 경계 접점 사용
        return `M${fromPoint.x},${fromPoint.y} L${toPoint.x},${toPoint.y}`;
    }
  }, [calculateConnectionPoints]);

  const handleWheel = (e: any) => {
    e.evt.preventDefault();
    
    const scaleBy = 1.05;
    const stage = e.target.getStage();
    const oldScale = zoom / 100;
    const pointer = stage.getPointerPosition();
    
    const newScale = e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;
    const clampedScale = Math.max(0.25, Math.min(2, newScale));
    
    const newZoom = Math.round(clampedScale * 100);
    setZoom(newZoom);
    
    // Calculate new position to zoom to pointer
    const newPos = {
      x: pointer.x - (pointer.x - stagePos.x) * (clampedScale / oldScale),
      y: pointer.y - (pointer.y - stagePos.y) * (clampedScale / oldScale)
    };
    
    setStagePos(newPos);
  };

  return (
    <div className="whiteboard-container">
      {/* Header */}
      <header className="whiteboard-header">
        <div className="header-left">
          <button className="btn-back" onClick={onBack}>
            ← 목록으로
          </button>
          <h1 className="diagram-title">{diagram.title}</h1>
        </div>
        
        <div className="header-center">
          <div className="auto-save-indicator">
            <span className="status-dot saved"></span>
            <span>자동 저장됨</span>
          </div>
        </div>
        
        <div className="header-right">
          <div className="user-presence">
            <div className="user-avatar">
              {userName.charAt(0).toUpperCase()}
            </div>
            <span>{userName}</span>
          </div>
          
          <div className="lock-control">
            {lockStatus.locked ? (
              lockStatus.lockedBy === userName ? (
                <button className="btn-lock locked" onClick={releaseLock}>
                  🔒 편집 중
                </button>
              ) : (
                <div className="lock-status">
                  🔒 {lockStatus.lockedBy}님이 편집 중
                </div>
              )
            ) : (
              <button className="btn-lock" onClick={requestLock}>
                🔓 편집 시작
              </button>
            )}
            
            {/* 연결선 옵션 버튼 */}
            {isLocked && tool === 'arrow' && (
              <button 
                className="btn-edge-options" 
                onClick={() => setShowEdgeOptions(true)}
                style={{ marginLeft: '10px', padding: '8px 12px', fontSize: '12px', borderRadius: '6px', border: '1px solid #ddd', background: '#f8f9fa' }}
              >
                🎨 연결선 스타일
              </button>
            )}
            
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="whiteboard-main">
        <ToolPanel 
          currentTool={tool}
          onToolChange={handleToolChange}
          canEdit={isLocked}
          onDelete={handleDelete}
          hasSelection={!!selectedNode || selectedNodes.size > 0}
          onMermaidImport={() => setShowMermaidInput(true)}
        />
        
        <div className="canvas-container">
          <Stage
            ref={stageRef}
            width={window.innerWidth - 360} // 도구패널(80) + 속성패널(280)
            height={window.innerHeight - 60} // 헤더(60)
            onMouseDown={handleStageMouseDown}
            onClick={handleStageClick}
            onMouseMove={handleStageMouseMoveNew}
            onMouseUp={handleStageMouseUp}
            onWheel={handleWheel}
            draggable={tool === 'hand'}
            className={isLocked ? 'editable' : 'readonly'}
            scaleX={zoom / 100}
            scaleY={zoom / 100}
            x={stagePos.x}
            y={stagePos.y}
            onDragEnd={(e) => {
              // Only update stage position if we're actually dragging the stage (hand tool)
              if (tool === 'hand') {
                setStagePos({ x: e.target.x(), y: e.target.y() });
              }
            }}
          >
            <Layer>
              {/* Render Nodes First (Background Layer) */}
              {nodes.map(node => (
                <React.Fragment key={node.id}>
                  {node.type === 'text' ? (
                    // 텍스트 노드는 백그라운드 없이 텍스트만 렌더링
                    null
                  ) : node.type === 'rectangle' ? (
                    <Rect
                      x={node.x}
                      y={node.y}
                      width={node.width}
                      height={node.height}
                      fill={node.fill}
                      stroke={
                        selectedNode === node.id || selectedNodes.has(node.id) ? '#0066cc' : 
                        highlightedElements.nodes.has(node.id) ? '#ff6b35' : 
                        node.stroke || '#666'
                      }
                      strokeWidth={
                        selectedNode === node.id || selectedNodes.has(node.id) ? 3 : 
                        highlightedElements.nodes.has(node.id) ? 2 : 
                        node.strokeWidth || 1
                      }
                      opacity={
                        highlightedElements.nodes.size > 0 && !highlightedElements.nodes.has(node.id) ? 0.3 : 1
                      }
                      dash={node.strokeStyle === 'dashed' ? [10, 5] : node.strokeStyle === 'dotted' ? [2, 2] : undefined}
                      draggable={isLocked && tool === 'select'}
                      onClick={(e) => handleNodeClick(node.id, e)}
                      onMouseEnter={(e) => {
                        const target = e.target as any;
                        target.getStage().container().style.cursor = 'pointer';
                        if (!highlightedElements.nodes.has(node.id)) {
                          target.strokeWidth((target.strokeWidth() || 1) + 1);
                        }
                      }}
                      onMouseLeave={(e) => {
                        const target = e.target as any;
                        target.getStage().container().style.cursor = 'default';
                        if (!highlightedElements.nodes.has(node.id)) {
                          target.strokeWidth(
                            selectedNode === node.id || selectedNodes.has(node.id) ? 3 : 
                            highlightedElements.nodes.has(node.id) ? 2 : 
                            node.strokeWidth || 1
                          );
                        }
                      }}
                      onDragStart={(e) => {
                        // 드래그 시작 시 해당 노드 선택 및 포커스
                        e.evt.stopPropagation();
                        if (selectedNode !== node.id) {
                          handleNodeClick(node.id);
                        }
                      }}
                      onDragMove={(e) => {
                        // 실시간 위치 업데이트 (로컬만)
                        e.evt.stopPropagation();
                        setNodes(nodes.map(n =>
                          n.id === node.id ? { ...n, x: e.target.x(), y: e.target.y() } : n
                        ));
                      }}
                      onDragEnd={(e) => {
                        // 최종 위치를 서버에 전송
                        e.evt.stopPropagation();
                        updateNode(node.id, { x: e.target.x(), y: e.target.y() });
                      }}
                    />
                  ) : (
                    <Ellipse
                      x={node.x + node.width / 2}
                      y={node.y + node.height / 2}
                      radiusX={node.width / 2}
                      radiusY={node.height / 2}
                      fill={node.fill}
                      stroke={
                        selectedNode === node.id || selectedNodes.has(node.id) ? '#0066cc' : 
                        highlightedElements.nodes.has(node.id) ? '#ff6b35' : 
                        node.stroke || '#666'
                      }
                      strokeWidth={
                        selectedNode === node.id || selectedNodes.has(node.id) ? 3 : 
                        highlightedElements.nodes.has(node.id) ? 2 : 
                        node.strokeWidth || 1
                      }
                      opacity={
                        highlightedElements.nodes.size > 0 && !highlightedElements.nodes.has(node.id) ? 0.3 : 1
                      }
                      dash={node.strokeStyle === 'dashed' ? [10, 5] : node.strokeStyle === 'dotted' ? [2, 2] : undefined}
                      draggable={isLocked && tool === 'select'}
                      onClick={(e) => handleNodeClick(node.id, e)}
                      onMouseEnter={(e) => {
                        const target = e.target as any;
                        target.getStage().container().style.cursor = 'pointer';
                        if (!highlightedElements.nodes.has(node.id)) {
                          target.strokeWidth((target.strokeWidth() || 1) + 1);
                        }
                      }}
                      onMouseLeave={(e) => {
                        const target = e.target as any;
                        target.getStage().container().style.cursor = 'default';
                        if (!highlightedElements.nodes.has(node.id)) {
                          target.strokeWidth(
                            selectedNode === node.id || selectedNodes.has(node.id) ? 3 : 
                            highlightedElements.nodes.has(node.id) ? 2 : 
                            node.strokeWidth || 1
                          );
                        }
                      }}
                      onDragStart={(e) => {
                        // 드래그 시작 시 해당 노드 선택 및 포커스
                        e.evt.stopPropagation();
                        if (selectedNode !== node.id) {
                          handleNodeClick(node.id);
                        }
                      }}
                      onDragMove={(e) => {
                        // 실시간 위치 업데이트 (로컬만)
                        e.evt.stopPropagation();
                        const newX = e.target.x() - node.width / 2;
                        const newY = e.target.y() - node.height / 2;
                        setNodes(nodes.map(n =>
                          n.id === node.id ? { ...n, x: newX, y: newY } : n
                        ));
                      }}
                      onDragEnd={(e) => {
                        // 최종 위치를 서버에 전송
                        e.evt.stopPropagation();
                        updateNode(node.id, { 
                          x: e.target.x() - node.width / 2, 
                          y: e.target.y() - node.height / 2 
                        });
                      }}
                    />
                  )}
                  
                  <KonvaText
                    x={node.x}
                    y={node.type === 'text' ? node.y : node.y + node.height / 2 - 8}
                    width={node.width}
                    height={node.type === 'text' ? node.height : undefined}
                    text={node.text || ' '}  // 빈 문자열일 때도 클릭 가능하도록 공백 문자 사용
                    align={node.type === 'text' ? 'left' : 'center'}
                    verticalAlign={node.type === 'text' ? 'top' : 'middle'}
                    fontSize={node.type === 'text' ? 16 : 14}
                    fontFamily="Arial, sans-serif"
                    listening={node.type === 'text'}
                    fill={node.type === 'text' ? '#333' : '#333'}
                    padding={node.type === 'text' ? 4 : 0}
                    draggable={isLocked && tool === 'select' && node.type === 'text'}
                    onClick={node.type === 'text' ? (e) => handleNodeClick(node.id, e) : undefined}
                    onDragStart={node.type === 'text' ? (e) => {
                      // 드래그 시작 시 해당 노드 선택 및 포커스
                      e.evt.stopPropagation();
                      if (selectedNode !== node.id) {
                        handleNodeClick(node.id);
                      }
                    } : undefined}
                    onDragMove={node.type === 'text' ? (e) => {
                      // 실시간 위치 업데이트 (로컬만)
                      e.evt.stopPropagation();
                      setNodes(nodes.map(n =>
                        n.id === node.id ? { ...n, x: e.target.x(), y: e.target.y() } : n
                      ));
                    } : undefined}
                    onDragEnd={node.type === 'text' ? (e) => {
                      // 최종 위치를 서버에 전송
                      e.evt.stopPropagation();
                      updateNode(node.id, { x: e.target.x(), y: e.target.y() });
                    } : undefined}
                  />
                </React.Fragment>
              ))}

              {/* Render Edges On Top */}
              {edges.map(edge => {
                const fromNode = nodes.find(n => n.id === edge.from);
                const toNode = nodes.find(n => n.id === edge.to);
                
                if (!fromNode || !toNode) return null;
                
                const isHighlighted = highlightedElements.edges.has(edge.id);
                const strokeColor = isHighlighted ? '#ff6b35' : edge.stroke || '#666';
                const strokeWidth = isHighlighted ? 3 : edge.strokeWidth || 2;
                const opacity = highlightedElements.edges.size > 0 && !isHighlighted ? 0.3 : 1;

                // 화살표가 있는 경우 Arrow 컴포넌트 사용, 없으면 Path 사용
                if (edge.arrowStart || edge.arrowEnd) {
                  const { fromPoint, toPoint } = calculateConnectionPoints(fromNode, toNode);

                  if (edge.edgeType === 'straight' || !edge.edgeType) {
                    // 직선 화살표 - 도형 경계 접점 사용
                    return (
                      <Arrow
                        key={edge.id}
                        points={[fromPoint.x, fromPoint.y, toPoint.x, toPoint.y]}
                        stroke={strokeColor}
                        strokeWidth={strokeWidth}
                        opacity={opacity}
                        fill={strokeColor}
                        dash={edge.strokeStyle === 'dashed' ? [10, 5] : edge.strokeStyle === 'dotted' ? [2, 2] : undefined}
                        pointerLength={edge.arrowEnd ? 10 : 0}
                        pointerWidth={edge.arrowEnd ? 8 : 0}
                        pointerAtBeginning={edge.arrowStart}
                        onClick={() => handleEdgeClick(edge.id)}
                        onDblClick={() => handleEdgeDoubleClick(edge.id)}
                        onMouseEnter={(e) => {
                          const target = e.target as any;
                          target.strokeWidth(isHighlighted ? 4 : 3);
                          target.getStage().container().style.cursor = 'pointer';
                        }}
                        onMouseLeave={(e) => {
                          const target = e.target as any;
                          target.strokeWidth(strokeWidth);
                          target.getStage().container().style.cursor = 'default';
                        }}
                      />
                    );
                  } else {
                    // 곡선/꺾은선의 경우 Path 사용
                    const pathData = generateEdgePath(edge, fromNode, toNode);
                    const { toPoint } = calculateConnectionPoints(fromNode, toNode);
                    return (
                      <React.Fragment key={edge.id}>
                        <Path
                          data={pathData}
                          stroke={strokeColor}
                          strokeWidth={strokeWidth}
                          opacity={opacity}
                          dash={edge.strokeStyle === 'dashed' ? [10, 5] : edge.strokeStyle === 'dotted' ? [2, 2] : undefined}
                          onClick={() => handleEdgeClick(edge.id)}
                          onDblClick={() => handleEdgeDoubleClick(edge.id)}
                          onMouseEnter={(e) => {
                            const target = e.target as any;
                            target.strokeWidth(isHighlighted ? 4 : 3);
                            target.getStage().container().style.cursor = 'pointer';
                          }}
                          onMouseLeave={(e) => {
                            const target = e.target as any;
                            target.strokeWidth(strokeWidth);
                            target.getStage().container().style.cursor = 'default';
                          }}
                        />
                        {/* 화살표 별도 렌더링 (Path는 화살표 지원 안함) */}
                        {edge.arrowEnd && (
                          <Arrow
                            points={[toPoint.x - 15, toPoint.y, toPoint.x, toPoint.y]}
                            stroke={strokeColor}
                            fill={strokeColor}
                            strokeWidth={strokeWidth}
                            opacity={opacity}
                            pointerLength={10}
                            pointerWidth={8}
                          />
                        )}
                      </React.Fragment>
                    );
                  }
                } else {
                  // 화살표 없는 연결선
                  const pathData = generateEdgePath(edge, fromNode, toNode);
                  return (
                    <Path
                      key={edge.id}
                      data={pathData}
                      stroke={strokeColor}
                      strokeWidth={strokeWidth}
                      opacity={opacity}
                      dash={edge.strokeStyle === 'dashed' ? [10, 5] : edge.strokeStyle === 'dotted' ? [2, 2] : undefined}
                      onClick={() => handleEdgeClick(edge.id)}
                      onDblClick={() => handleEdgeDoubleClick(edge.id)}
                      onMouseEnter={(e) => {
                        const target = e.target as any;
                        target.strokeWidth(isHighlighted ? 4 : 3);
                        target.getStage().container().style.cursor = 'pointer';
                      }}
                      onMouseLeave={(e) => {
                        const target = e.target as any;
                        target.strokeWidth(strokeWidth);
                        target.getStage().container().style.cursor = 'default';
                      }}
                    />
                  );
                }
              })}

              {/* Edge Labels */}
              {edges.map(edge => {
                if (!edge.label) return null;
                
                const fromNode = nodes.find(n => n.id === edge.from);
                const toNode = nodes.find(n => n.id === edge.to);
                if (!fromNode || !toNode) return null;

                const midpoint = calculateEdgeMidpoint(edge, fromNode, toNode);
                
                return (
                  <KonvaText
                    key={`label-${edge.id}`}
                    x={midpoint.x - 30} // Center the text
                    y={midpoint.y - 8}  // Center vertically
                    width={60}
                    height={16}
                    text={edge.label}
                    align="center"
                    verticalAlign="middle"
                    fontSize={11}
                    fontFamily="Arial, sans-serif"
                    fill="#333"
                    fontStyle="bold"
                    listening={false}
                    // Background styling
                    shadowColor="white"
                    shadowBlur={3}
                    shadowOpacity={0.8}
                    shadowOffsetX={0}
                    shadowOffsetY={0}
                  />
                );
              })}

              {/* 임시 연결선 미리보기 (연결선 생성 중) */}
              {isCreatingEdge && edgeStart && tempEdgeEnd && (() => {
                const startNode = nodes.find(n => n.id === edgeStart);
                if (!startNode) return null;
                
                // 시작 노드에서 마우스 위치로의 연결점 계산
                const startPoint = getShapeEdgePoint(startNode, {
                  x: startNode.x + startNode.width / 2,
                  y: startNode.y + startNode.height / 2
                }, tempEdgeEnd, false);
                
                return (
                  <Line
                    key="temp-edge"
                    points={[startPoint.x, startPoint.y, tempEdgeEnd.x, tempEdgeEnd.y]}
                    stroke={edgeOptions.stroke}
                    strokeWidth={edgeOptions.strokeWidth}
                    opacity={0.6}
                    dash={[5, 5]}
                    listening={false}
                  />
                );
              })()}

              {/* 드래그 선택 영역 */}
              {selectionRect && (
                <Rect
                  x={selectionRect.x}
                  y={selectionRect.y}
                  width={selectionRect.width}
                  height={selectionRect.height}
                  fill="rgba(0, 123, 255, 0.1)"
                  stroke="#007bff"
                  strokeWidth={1}
                  dash={[5, 5]}
                  listening={false}
                />
              )}

              {/* Selection indicators for selected node */}
              {selectedNode && (() => {
                const node = nodes.find(n => n.id === selectedNode);
                return node ? (
                  <SelectionIndicator
                    key={`selection-${selectedNode}`}
                    node={node}
                    visible={true}
                  />
                ) : null;
              })()}
              
              {/* Selection indicators for multi-selected nodes */}
              {Array.from(selectedNodes).filter(id => id !== selectedNode).map(nodeId => {
                const node = nodes.find(n => n.id === nodeId);
                return node ? (
                  <SelectionIndicator
                    key={`multi-selection-${nodeId}`}
                    node={node}
                    visible={true}
                  />
                ) : null;
              })}
            </Layer>
          </Stage>
          
          {/* Editing Indicator */}
          {isLocked && (
            <div className="editing-indicator">
              <span className="pulse-dot"></span>
              편집 중
            </div>
          )}
          
          {/* Highlight Status Indicator */}
          {(highlightedElements.nodes.size > 0 || highlightedElements.edges.size > 0) && (
            <div 
              className="highlight-indicator"
              style={{
                position: 'absolute',
                top: '10px',
                right: '10px',
                background: 'rgba(255, 107, 53, 0.9)',
                color: 'white',
                padding: '8px 12px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: 'bold',
                zIndex: 1000,
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
              }}
            >
              <span>🔍</span>
              연결된 요소 {highlightedElements.nodes.size + highlightedElements.edges.size}개 하이라이트
            </div>
          )}

          {/* Edge Creation Status Indicator */}
          {isCreatingEdge && (
            <div 
              className="edge-creation-indicator"
              style={{
                position: 'absolute',
                top: '50px',
                right: '10px',
                background: 'rgba(0, 102, 204, 0.9)',
                color: 'white',
                padding: '8px 12px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: 'bold',
                zIndex: 1000,
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
              }}
            >
              <span>→</span>
              연결할 두 번째 노드를 클릭하세요
            </div>
          )}
        </div>
        
        <PropertiesPanel
          selectedNode={selectedNode ? nodes.find(n => n.id === selectedNode) || null : null}
          selectedEdge={selectedEdge ? edges.find(e => e.id === selectedEdge) || null : null}
          onNodeChange={updateNode}
          onEdgeChange={updateEdge}
          canEdit={isLocked}
        />
      </div>

      {/* Edge Options Panel */}
      <EdgeOptionsPanel
        isVisible={showEdgeOptions}
        options={edgeOptions}
        onOptionsChange={setEdgeOptions}
        onClose={() => setShowEdgeOptions(false)}
      />
      
      {/* Bottom Bar */}
      <div className="bottom-bar">
        <div className="zoom-control">
          <button onClick={() => setZoom(Math.max(25, zoom - 25))}>−</button>
          <span>{zoom}%</span>
          <button onClick={() => setZoom(Math.min(200, zoom + 25))}>+</button>
          <button onClick={() => setZoom(100)}>맞춤</button>
        </div>
        
        <div className="coordinates">
          좌표: {Math.round(stagePos.x)}, {Math.round(stagePos.y)}
        </div>
      </div>

      {/* Inline Text Editor for Edge Labels */}
      {editingEdgeLabel && (
        <InlineTextEditor
          x={edgeLabelPosition.x}
          y={edgeLabelPosition.y}
          value={edgeLabelText}
          onSave={(text) => saveEdgeLabel(editingEdgeLabel, text)}
          onCancel={cancelEdgeLabelEdit}
          placeholder="레이블 입력..."
          maxLength={30}
        />
      )}
      
      {/* Mermaid Import Dialog */}
      {showMermaidInput && (
        <MermaidInput
          onImport={handleMermaidImport}
          onClose={() => setShowMermaidInput(false)}
        />
      )}
    </div>
  );
};

export default Whiteboard;