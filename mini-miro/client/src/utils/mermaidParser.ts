import { Node, Edge } from '../types';

interface MermaidNode {
  id: string;
  label: string;
  shape: 'rectangle' | 'ellipse' | 'diamond';
}

interface MermaidEdge {
  from: string;
  to: string;
  label?: string;
  style?: 'solid' | 'dashed' | 'dotted';
}

export class MermaidParser {
  private nodes: Map<string, MermaidNode> = new Map();
  private edges: MermaidEdge[] = [];
  private nodeCounter = 0;
  private readonly NODE_WIDTH = 150;
  private readonly NODE_HEIGHT = 60;
  private readonly HORIZONTAL_SPACING = 200;
  private readonly VERTICAL_SPACING = 100;

  parse(mermaidText: string): { nodes: Node[], edges: Edge[] } {
    this.nodes.clear();
    this.edges = [];
    this.nodeCounter = 0;

    const lines = mermaidText.trim().split('\n');
    
    // Skip the graph declaration line
    const startIndex = lines.findIndex(line => 
      line.trim().match(/^(graph|flowchart)\s+(TD|TB|BT|RL|LR)/i)
    );
    
    if (startIndex === -1) {
      throw new Error('Invalid Mermaid syntax: Missing graph/flowchart declaration');
    }

    // Parse each line
    for (let i = startIndex + 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line === '' || line.startsWith('%%')) continue; // Skip empty lines and comments
      
      this.parseLine(line);
    }

    // Convert to diagram nodes and edges
    const diagramNodes = this.convertToNodes();
    const diagramEdges = this.convertToEdges();

    return { nodes: diagramNodes, edges: diagramEdges };
  }

  private parseLine(line: string) {
    // Match node definitions with different shapes
    const nodePatterns = [
      // Rectangle: A[Label]
      /^(\w+)\[([^\]]+)\]$/,
      // Circle/Ellipse: A((Label))
      /^(\w+)\(\(([^)]+)\)\)$/,
      // Diamond: A{Label}
      /^(\w+)\{([^}]+)\}$/,
      // Plain: A
      /^(\w+)$/
    ];

    // Match edge definitions
    const edgePatterns = [
      // A --> B
      /^(\w+)\s*-->\s*(\w+)$/,
      // A --> |Label| B
      /^(\w+)\s*-->\s*\|([^|]+)\|\s*(\w+)$/,
      // A[Label1] --> B[Label2]
      /^(\w+)(?:\[[^\]]+\])?\s*-->\s*(\w+)(?:\[[^\]]+\])?$/,
      // A-.->B (dashed)
      /^(\w+)\s*-\.->\s*(\w+)$/,
      // A==>B (thick)
      /^(\w+)\s*==>\s*(\w+)$/
    ];

    // Check for node definition
    for (let i = 0; i < nodePatterns.length; i++) {
      const match = line.match(nodePatterns[i]);
      if (match) {
        const id = match[1];
        const label = match[2] || match[1];
        let shape: 'rectangle' | 'ellipse' | 'diamond' = 'rectangle';
        
        if (i === 1) shape = 'ellipse';
        else if (i === 2) shape = 'diamond';
        
        this.nodes.set(id, { id, label, shape });
        return;
      }
    }

    // Check for edge definition
    for (const pattern of edgePatterns) {
      const match = line.match(pattern);
      if (match) {
        const from = match[1];
        const to = match[match.length - 1];
        const label = match.length > 3 ? match[2] : undefined;
        
        // Extract node labels from edge definition if present
        const nodeMatch = line.match(/(\w+)(?:\[([^\]]+)\])?\s*[-=.]+>\s*(\w+)(?:\[([^\]]+)\])?/);
        if (nodeMatch) {
          if (nodeMatch[2] && !this.nodes.has(nodeMatch[1])) {
            this.nodes.set(nodeMatch[1], { id: nodeMatch[1], label: nodeMatch[2], shape: 'rectangle' });
          }
          if (nodeMatch[4] && !this.nodes.has(nodeMatch[3])) {
            this.nodes.set(nodeMatch[3], { id: nodeMatch[3], label: nodeMatch[4], shape: 'rectangle' });
          }
        }

        // Ensure nodes exist
        if (!this.nodes.has(from)) {
          this.nodes.set(from, { id: from, label: from, shape: 'rectangle' });
        }
        if (!this.nodes.has(to)) {
          this.nodes.set(to, { id: to, label: to, shape: 'rectangle' });
        }

        this.edges.push({ from, to, label });
        return;
      }
    }
  }

  private convertToNodes(): Node[] {
    const diagramNodes: Node[] = [];
    const nodePositions = this.calculateNodePositions();

    this.nodes.forEach((mermaidNode, id) => {
      const position = nodePositions.get(id) || { x: 0, y: 0 };
      
      diagramNodes.push({
        id: `mermaid-${this.nodeCounter++}`,
        x: position.x,
        y: position.y,
        width: this.NODE_WIDTH,
        height: this.NODE_HEIGHT,
        text: mermaidNode.label,
        type: mermaidNode.shape === 'ellipse' ? 'ellipse' : 'rectangle',
        fill: this.getNodeColor(mermaidNode.shape),
        stroke: '#666',
        strokeWidth: 2,
        mermaidId: id // Store original Mermaid ID for edge mapping
      } as Node & { mermaidId: string });
    });

    return diagramNodes;
  }

  private convertToEdges(): Edge[] {
    const diagramEdges: Edge[] = [];
    const nodeMap = new Map<string, string>(); // Mermaid ID to diagram node ID

    // Build mapping of Mermaid IDs to diagram node IDs
    this.nodes.forEach((_, mermaidId) => {
      const index = Array.from(this.nodes.keys()).indexOf(mermaidId);
      nodeMap.set(mermaidId, `mermaid-${index}`);
    });

    this.edges.forEach((mermaidEdge, index) => {
      const fromId = nodeMap.get(mermaidEdge.from);
      const toId = nodeMap.get(mermaidEdge.to);

      if (fromId && toId) {
        diagramEdges.push({
          id: `mermaid-edge-${index}`,
          from: fromId,
          to: toId,
          label: mermaidEdge.label,
          points: [],
          stroke: '#666',
          strokeWidth: 2,
          strokeStyle: mermaidEdge.style || 'solid',
          edgeType: 'straight',
          arrowEnd: true
        });
      }
    });

    return diagramEdges;
  }

  private calculateNodePositions(): Map<string, { x: number, y: number }> {
    const positions = new Map<string, { x: number, y: number }>();
    const levels = this.calculateNodeLevels();
    const levelNodes = new Map<number, string[]>();

    // Group nodes by level
    levels.forEach((level, nodeId) => {
      if (!levelNodes.has(level)) {
        levelNodes.set(level, []);
      }
      levelNodes.get(level)!.push(nodeId);
    });

    // Position nodes
    levelNodes.forEach((nodes, level) => {
      const levelWidth = nodes.length * this.HORIZONTAL_SPACING;
      const startX = (800 - levelWidth) / 2; // Center on 800px width

      nodes.forEach((nodeId, index) => {
        positions.set(nodeId, {
          x: startX + index * this.HORIZONTAL_SPACING,
          y: 100 + level * this.VERTICAL_SPACING
        });
      });
    });

    return positions;
  }

  private calculateNodeLevels(): Map<string, number> {
    const levels = new Map<string, number>();
    const visited = new Set<string>();
    const inDegree = new Map<string, number>();

    // Initialize in-degree
    this.nodes.forEach((_, id) => {
      inDegree.set(id, 0);
    });

    // Calculate in-degree
    this.edges.forEach(edge => {
      inDegree.set(edge.to, (inDegree.get(edge.to) || 0) + 1);
    });

    // Find root nodes (in-degree = 0)
    const queue: string[] = [];
    inDegree.forEach((degree, nodeId) => {
      if (degree === 0) {
        queue.push(nodeId);
        levels.set(nodeId, 0);
      }
    });

    // BFS to assign levels
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);

      const currentLevel = levels.get(current) || 0;

      // Process outgoing edges
      this.edges.forEach(edge => {
        if (edge.from === current) {
          const targetLevel = Math.max(
            levels.get(edge.to) || 0,
            currentLevel + 1
          );
          levels.set(edge.to, targetLevel);
          
          if (!visited.has(edge.to)) {
            queue.push(edge.to);
          }
        }
      });
    }

    return levels;
  }

  private getNodeColor(shape: string): string {
    switch (shape) {
      case 'ellipse':
        return '#E3F2FD';
      case 'diamond':
        return '#FFF9C4';
      default:
        return '#E8F5E9';
    }
  }
}

// Export singleton instance
export const mermaidParser = new MermaidParser();