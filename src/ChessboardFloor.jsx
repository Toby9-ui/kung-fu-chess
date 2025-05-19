import React, { useMemo } from 'react';
import * as THREE from 'three';

function ChessboardFloor({ size = 10, divisions = 8 }) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    // Power of 2 texture size for better performance/compatibility
    const textureSize = 256;
    canvas.width = textureSize;
    canvas.height = textureSize;

    const squareSize = textureSize / divisions;

    for (let i = 0; i < divisions; i++) {
      for (let j = 0; j < divisions; j++) {
        context.fillStyle = (i + j) % 2 === 0 ? '#FFFFFF' : '#888888'; // White and gray squares
        context.fillRect(j * squareSize, i * squareSize, squareSize, squareSize);
      }
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter; // For a crisp, pixelated look
    tex.minFilter = THREE.NearestFilter;
    return tex;
  }, [divisions]);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}> {/* Adjust Y position if needed */}
      <planeGeometry args={[size, size]} />
      <meshStandardMaterial map={texture} side={THREE.DoubleSide} />
    </mesh>
  );
}

export default ChessboardFloor;
