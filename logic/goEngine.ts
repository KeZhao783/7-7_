
import { Color } from '../types';
// Fix: Import BOARD_SIZE from constants instead of types
import { BOARD_SIZE } from '../constants';

export const createEmptyBoard = (): Color[][] => 
  Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null));

export const getLiberties = (board: Color[][], x: number, y: number): { count: number; group: {x: number, y: number}[] } => {
  const color = board[y][x];
  if (!color) return { count: 0, group: [] };

  const group: {x: number, y: number}[] = [];
  const visited = new Set<string>();
  const liberties = new Set<string>();

  const stack = [{ x, y }];
  while (stack.length > 0) {
    const curr = stack.pop()!;
    const key = `${curr.x},${curr.y}`;
    if (visited.has(key)) continue;
    visited.add(key);
    group.push(curr);

    const neighbors = [
      { x: curr.x + 1, y: curr.y },
      { x: curr.x - 1, y: curr.y },
      { x: curr.x, y: curr.y + 1 },
      { x: curr.x, y: curr.y - 1 },
    ];

    for (const n of neighbors) {
      if (n.x >= 0 && n.x < BOARD_SIZE && n.y >= 0 && n.y < BOARD_SIZE) {
        if (board[n.y][n.x] === color) {
          stack.push(n);
        } else if (board[n.y][n.x] === null) {
          liberties.add(`${n.x},${n.y}`);
        }
      }
    }
  }

  return { count: liberties.size, group };
};

export const tryMove = (board: Color[][], x: number, y: number, color: Color): { valid: boolean; newBoard: Color[][] | null; captured: number } => {
  if (board[y][x] !== null) return { valid: false, newBoard: null, captured: 0 };

  const nextBoard = board.map(row => [...row]);
  nextBoard[y][x] = color;

  let totalCaptured = 0;
  const opponent = color === 'black' ? 'white' : 'black';

  // 1. Check if we capture opponent
  const neighbors = [
    { x: x + 1, y },
    { x: x - 1, y },
    { x, y: y + 1 },
    { x, y: y - 1 },
  ];

  for (const n of neighbors) {
    if (n.x >= 0 && n.x < BOARD_SIZE && n.y >= 0 && n.y < BOARD_SIZE) {
      if (nextBoard[n.y][n.x] === opponent) {
        const { count, group } = getLiberties(nextBoard, n.x, n.y);
        if (count === 0) {
          totalCaptured += group.length;
          group.forEach(p => { nextBoard[p.y][p.x] = null; });
        }
      }
    }
  }

  // 2. Check if suicide (illegal unless it captured)
  const { count: myLiberties } = getLiberties(nextBoard, x, y);
  if (myLiberties === 0 && totalCaptured === 0) {
    return { valid: false, newBoard: null, captured: 0 };
  }

  return { valid: true, newBoard: nextBoard, captured: totalCaptured };
};

export const calculateScore = (board: Color[][], deadStones: boolean[][], captures: { black: number, white: number }) => {
  const currentBoard = board.map((row, y) => row.map((cell, x) => (deadStones[y][x] ? null : cell)));
  let blackPoints = captures.black;
  let whitePoints = captures.white + 3.5; // Komi

  const visited = new Set<string>();

  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      if (currentBoard[y][x] === 'black') blackPoints++;
      else if (currentBoard[y][x] === 'white') whitePoints++;
      else {
        const key = `${x},${y}`;
        if (visited.has(key)) continue;

        // Territory counting
        const territory: {x: number, y: number}[] = [];
        const tStack = [{ x, y }];
        const borders = new Set<Color>();
        
        while (tStack.length > 0) {
          const curr = tStack.pop()!;
          const tKey = `${curr.x},${curr.y}`;
          if (visited.has(tKey)) continue;
          visited.add(tKey);
          territory.push(curr);

          const neighbors = [
            { x: curr.x + 1, y: curr.y },
            { x: curr.x - 1, y: curr.y },
            { x: curr.x, y: curr.y + 1 },
            { x: curr.x, y: curr.y - 1 },
          ];

          for (const n of neighbors) {
            if (n.x >= 0 && n.x < BOARD_SIZE && n.y >= 0 && n.y < BOARD_SIZE) {
              if (currentBoard[n.y][n.x] === null) {
                tStack.push(n);
              } else {
                borders.add(currentBoard[n.y][n.x]);
              }
            }
          }
        }

        if (borders.size === 1) {
          if (borders.has('black')) blackPoints += territory.length;
          if (borders.has('white')) whitePoints += territory.length;
        }
      }
    }
  }

  return { black: blackPoints, white: whitePoints };
};
