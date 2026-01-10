
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
  recommendations?: { x: number; y: number }[];
  warnings?: { x: number; y: number }[];
}

export const GameBoard: React.FC<GameBoardProps> = ({ 
  board, 
  lastMove, 
  onPlaceStone, 
  isScoringMode,
  deadStones,
  onToggleDeadStone,
  recommendations = [],
  warnings = []
}) => {
  const cellSize = 50;
  const padding = 25;
  const totalSize = (BOARD_SIZE - 1) * cellSize + padding * 2;

  const isRecommended = (x: number, y: number) => recommendations.some(r => r.x === x && r.y === y);
  const isWarning = (x: number, y: number) => warnings.some(w => w.x === x && w.y === y);

  return (
    <div className="relative inline-block wood-texture p-4 rounded-3xl shadow-2xl border-[8px] border-amber-900 overflow-hidden">
      <svg width={totalSize} height={totalSize} className="block overflow-visible">
        {/* Board Grid */}
        <g stroke="#444" strokeWidth="1.2" opacity="0.6">
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

        {/* Star Point (Tianyuan) */}
        <circle cx={padding + 3 * cellSize} cy={padding + 3 * cellSize} r="3.5" fill="#333" />

        {/* Interaction Layer */}
        {board.map((row, y) => row.map((stone, x) => (
          <g key={`${x}-${y}`} className="cursor-pointer" onClick={() => isScoringMode ? onToggleDeadStone(x, y) : onPlaceStone(x, y)}>
            <rect 
              x={padding + x * cellSize - cellSize / 2} 
              y={padding + y * cellSize - cellSize / 2} 
              width={cellSize} 
              height={cellSize} 
              fill="transparent" 
            />
            
            {stone && (
              <g>
                <circle 
                  cx={padding + x * cellSize} 
                  cy={padding + y * cellSize} 
                  r={cellSize * 0.45} 
                  fill={stone === 'black' ? 'url(#blackStone)' : 'url(#whiteStone)'}
                  stroke={stone === 'black' ? '#000' : '#d1d1d1'}
                  className={deadStones[y][x] ? "opacity-30" : "drop-shadow-md"}
                />
                
                {/* Last move marker */}
                {!isScoringMode && lastMove?.x === x && lastMove?.y === y && (
                  <circle 
                    cx={padding + x * cellSize} 
                    cy={padding + y * cellSize} 
                    r="4" 
                    fill="#ef4444" 
                    className="animate-pulse"
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
                    className="opacity-80"
                  />
                )}
              </g>
            )}
            
            {/* Empty space highlights from analysis */}
            {!stone && !isScoringMode && (
              <>
                {/* Recommended (Blue Circle) */}
                {isRecommended(x, y) && (
                  <circle 
                    cx={padding + x * cellSize} 
                    cy={padding + y * cellSize} 
                    r={cellSize * 0.15} 
                    fill="none"
                    stroke="#6366f1"
                    strokeWidth="2.5"
                    opacity="0.7"
                    className="animate-pulse"
                  />
                )}
                
                {/* Warning (Red X) */}
                {isWarning(x, y) && (
                  <g opacity="0.9" stroke="#ef4444" strokeWidth="4" strokeLinecap="round">
                    <line 
                      x1={padding + x * cellSize - 7} 
                      y1={padding + y * cellSize - 7} 
                      x2={padding + x * cellSize + 7} 
                      y2={padding + y * cellSize + 7} 
                    />
                    <line 
                      x1={padding + x * cellSize + 7} 
                      y1={padding + y * cellSize - 7} 
                      x2={padding + x * cellSize - 7} 
                      y2={padding + y * cellSize + 7} 
                    />
                  </g>
                )}
              </>
            )}

            {/* Hover ghost stone */}
            {!stone && !isScoringMode && (
              <circle 
                cx={padding + x * cellSize} 
                cy={padding + y * cellSize} 
                r={cellSize * 0.4} 
                fill="black" 
                className="opacity-0 hover:opacity-10 transition-opacity duration-150" 
              />
            )}
          </g>
        )))}

        {/* Gradients for Stones */}
        <defs>
          <radialGradient id="blackStone" cx="30%" cy="30%" r="50%">
            <stop offset="0%" stopColor="#444" />
            <stop offset="100%" stopColor="#000" />
          </radialGradient>
          <radialGradient id="whiteStone" cx="30%" cy="30%" r="50%">
            <stop offset="0%" stopColor="#fff" />
            <stop offset="100%" stopColor="#d1d1d1" />
          </radialGradient>
        </defs>
      </svg>
    </div>
  );
};
