import React from 'react';
import { Rect, Circle } from 'react-konva';
import { Node } from '../types';

interface Props {
  node: Node;
  visible: boolean;
}

const SelectionIndicator: React.FC<Props> = ({ node, visible }) => {
  if (!visible) return null;

  const handleSize = 8;
  const padding = 4;

  // Calculate bounds with padding
  const bounds = {
    x: node.x - padding,
    y: node.y - padding,
    width: node.width + padding * 2,
    height: node.height + padding * 2
  };

  // Handle positions
  const handles = [
    { x: bounds.x, y: bounds.y }, // Top-left
    { x: bounds.x + bounds.width / 2, y: bounds.y }, // Top-center
    { x: bounds.x + bounds.width, y: bounds.y }, // Top-right
    { x: bounds.x + bounds.width, y: bounds.y + bounds.height / 2 }, // Middle-right
    { x: bounds.x + bounds.width, y: bounds.y + bounds.height }, // Bottom-right
    { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height }, // Bottom-center
    { x: bounds.x, y: bounds.y + bounds.height }, // Bottom-left
    { x: bounds.x, y: bounds.y + bounds.height / 2 }, // Middle-left
  ];

  return (
    <>
      {/* Selection outline */}
      <Rect
        x={bounds.x}
        y={bounds.y}
        width={bounds.width}
        height={bounds.height}
        stroke="#0066cc"
        strokeWidth={2}
        dash={[6, 4]}
        fill="transparent"
        listening={false}
        opacity={0.8}
      />
      
      {/* Selection handles */}
      {handles.map((handle, index) => (
        <Circle
          key={index}
          x={handle.x}
          y={handle.y}
          radius={handleSize / 2}
          fill="#0066cc"
          stroke="white"
          strokeWidth={2}
          listening={false}
          shadowColor="#0066cc"
          shadowBlur={4}
          shadowOpacity={0.3}
        />
      ))}
    </>
  );
};

export default SelectionIndicator;