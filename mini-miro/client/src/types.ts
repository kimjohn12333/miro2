export interface Diagram {
  id: number;
  title: string;
  description?: string;
  type: string;
  created_at: string;
  updated_at: string;
  content?: DiagramContent;
}

export interface DiagramContent {
  nodes: Node[];
  edges: Edge[];
}

export interface Node {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  fill: string;
  type: 'rectangle' | 'ellipse' | 'text';
  strokeStyle?: 'solid' | 'dashed' | 'dotted';
  strokeWidth?: number;
  stroke?: string;
}

export interface Edge {
  id: string;
  from: string;
  to: string;
  points: number[];
  stroke?: string;
  strokeWidth?: number;
  strokeStyle?: 'solid' | 'dashed' | 'dotted';
  edgeType?: 'straight' | 'curved' | 'orthogonal';
  arrowStart?: boolean;
  arrowEnd?: boolean;
  label?: string;
  controlPoints?: { x: number; y: number }[];
}

export interface LockStatus {
  locked: boolean;
  lockedBy?: string;
  expiresAt?: number;
}

export interface DiagramChanges {
  nodes?: {
    added?: Node[];
    updated?: Partial<Node>[];
    deleted?: string[];
  };
  edges?: {
    added?: Edge[];
    updated?: Partial<Edge>[];
    deleted?: string[];
  };
}