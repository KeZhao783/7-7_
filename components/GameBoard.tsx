
import React from 'react';
import { Color } from '../types';
import { BOARD_SIZE } from '../constants';

interface GameBoardProps {
  board: Color[][];
  lastMove: { x: number; y: number } | null;
  onPlaceStone: (x: number, y: number) => void;
  isScoringMode: boolean;
  deadStones: boolean[][];
  onToggleDeadStone: (x: number, y: number) => void;
  highlightCoords?: { x: number; y: number }[];
}

export const GameBoard: React.FC<GameBoardProps> = ({ 
  board, 
  lastMove, 
  onPlaceStone, 
  isScoringMode,
  deadStones,
  onToggleDeadStone,
  highlightCoords = []
}) => {
  const cellSize = 50;
  const padding = 25;
  const totalSize = (BOARD_SIZE - 1) * cellSize + padding * 2;

  const isHighlighted = (x: number, y: number) => 
    highlightCoords.some(c => c.x === x && c.y === y);

  return (
    <div className="relative inline-block wood-texture p-4 rounded-lg shadow-2xl border-4 border-amber-800">
      <svg width={totalSize} height={totalSize}>
        {/* Board Grid */}
        <g stroke="#555" strokeWidth="1">
          {Array.from({ length: BOARD_SIZE }).map((_, i) => (
            <React.Fragment key={i}>
              <line 
                x1={padding} 
                y1={padding + i * cellSize} 
                x2={totalSize - padding} 
                y2={padding + i * cellSize} 
              />
              <line 
                x1={padding + i * cellSize} 
                y1={padding} 
                x2={padding + i * cellSize} 
                y2={totalSize - padding} 
              />
            </React.Fragment>
          ))}
        </g>

        {/* Star Points */}
        <circle cx={padding + 3 * cellSize} cy={padding + 3 * cellSize} r="3" fill="#333" />

        {/* Interaction Layer */}
        {board.map((row, y) => row.map((stone, x) => (
          <g key={`${x}-${y}`} className="cursor-pointer" onClick={() => isScoringMode ? onToggleDeadStone(x, y) : onPlaceStone(x, y)}>
            {/* Invisible larger hit area */}
            <rect 
              x={padding + x * cellSize - cellSize / 2} 
              y={padding + y * cellSize - cellSize / 2} 
              width={cellSize} 
              height={cellSize} 
              fill="transparent" 
            />
            
            {stone && (
              <g>
                {/* Situation Analysis Highlight Effect */}
                {isHighlighted(x, y) && (
                  <circle 
                    cx={padding + x * cellSize} 
                    cy={padding + y * cellSize} 
                    r={cellSize * 0.55} 
                    fill="none"
                    stroke={stone === 'black' ? '#ef4444' : '#f59e0b'}
                    strokeWidth="2"
                    strokeDasharray="4,2"
                    className="animate-[spin_10s_linear_infinite]"
                  />
                )}

                <circle 
                  cx={padding + x * cellSize} 
                  cy={padding + y * cellSize} 
                  r={cellSize * 0.45} 
                  fill={stone === 'black' ? '#111' : '#fff'}
                  stroke={stone === 'black' ? '#000' : '#ccc'}
                  className={deadStones[y][x] ? "opacity-40" : "drop-shadow-sm"}
                />
                
                {/* Last move marker */}
                {!isScoringMode && lastMove?.x === x && lastMove?.y === y && (
                  <circle 
                    cx={padding + x * cellSize} 
                    cy={padding + y * cellSize} 
                    r="4" 
                    fill={stone === 'black' ? '#fff' : '#000'} 
                  />
                )}

                {/* Scoring marker for dead stones */}
                {isScoringMode && deadStones[y][x] && (
                  <rect 
                    x={padding + x * cellSize - 4} 
                    y={padding + y * cellSize - 4} 
                    width="8" 
                    height="8" 
                    fill={stone === 'black' ? '#fff' : '#000'} 
                  />
                )}
              </g>
            )}
            
            {/* Hover effect if empty */}
            {!stone && !isScoringMode && (
              <circle 
                cx={padding + x * cellSize} 
                cy={padding + y * cellSize} 
                r={cellSize * 0.4} 
                fill="black" 
                className="opacity-0 hover:opacity-20 transition-opacity duration-150" 
              />
            )}
          </g>
        )))}
      </svg>
    </div>
  );
};
