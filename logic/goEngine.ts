
import { Color } from '../types';
import { BOARD_SIZE, KOMI } from '../constants';

/**
 * 创建空棋盘
 */
export const createEmptyBoard = (): Color[][] => {
  return Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null));
};

/**
 * 比较两个棋盘状态是否完全相同
 */
export const areBoardsEqual = (b1: Color[][], b2: Color[][]): boolean => {
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      if (b1[y][x] !== b2[y][x]) return false;
    }
  }
  return true;
};

/**
 * 获取某个位置及其连通棋组的气数和坐标
 */
export const getGroupInfo = (board: Color[][], x: number, y: number): { liberties: Set<string>; group: {x: number, y: number}[] } => {
  const color = board[y][x];
  if (!color) return { liberties: new Set(), group: [] };

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

  return { liberties, group };
};

/**
 * 尝试落子逻辑
 * @param previousBoard 用于劫争判断：新盘面不能等于上一次对手落子前的盘面
 */
export const tryMove = (
  board: Color[][], 
  x: number, 
  y: number, 
  color: Color, 
  previousBoard?: Color[][]
): { valid: boolean; newBoard: Color[][] | null; captured: number; isKo?: boolean } => {
  // 1. 基础判断：越界或已有棋子
  if (x < 0 || x >= BOARD_SIZE || y < 0 || y >= BOARD_SIZE || board[y][x] !== null) {
    return { valid: false, newBoard: null, captured: 0 };
  }

  const nextBoard = board.map(row => [...row]);
  nextBoard[y][x] = color;

  let totalCaptured = 0;
  const opponent = color === 'black' ? 'white' : 'black';

  const neighbors = [
    { x: x + 1, y }, { x: x - 1, y }, { x, y: y + 1 }, { x, y: y - 1 },
  ];

  // 2. 检查并移除被提掉的对方棋子
  for (const n of neighbors) {
    if (n.x >= 0 && n.x < BOARD_SIZE && n.y >= 0 && n.y < BOARD_SIZE) {
      if (nextBoard[n.y][n.x] === opponent) {
        const info = getGroupInfo(nextBoard, n.x, n.y);
        if (info.liberties.size === 0) {
          totalCaptured += info.group.length;
          info.group.forEach(p => { nextBoard[p.y][p.x] = null; });
        }
      }
    }
  }

  // 3. 禁入点检测（自杀）：落子后自己没有气且没有提掉对方子
  const myInfo = getGroupInfo(nextBoard, x, y);
  if (myInfo.liberties.size === 0 && totalCaptured === 0) {
    return { valid: false, newBoard: null, captured: 0 };
  }

  // 4. 劫争（Ko）检测：防止棋局回到上一步之前的状态
  if (previousBoard && areBoardsEqual(nextBoard, previousBoard)) {
    return { valid: false, newBoard: null, captured: 0, isKo: true };
  }

  return { valid: true, newBoard: nextBoard, captured: totalCaptured };
};

/**
 * 本地 AI 逻辑
 */
export const getLocalBestMove = (board: Color[][], color: Color, previousBoard?: Color[][]): { x: number; y: number } | 'pass' => {
  const possibleMoves: { x: number; y: number; score: number }[] = [];

  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      const res = tryMove(board, x, y, color, previousBoard);
      if (res.valid) {
        let score = res.captured * 20;
        // 占据中心点加分 (3,3) 是中心
        score += (3 - Math.abs(3 - x)) + (3 - Math.abs(3 - y));
        possibleMoves.push({ x, y, score });
      }
    }
  }

  if (possibleMoves.length === 0) return 'pass';
  possibleMoves.sort((a, b) => b.score - a.score);
  return { x: possibleMoves[0].x, y: possibleMoves[0].y };
};

/**
 * 计分逻辑
 */
export const calculateScore = (board: Color[][], deadStones: boolean[][], captures: { black: number, white: number }) => {
  const currentBoard = board.map((row, y) => row.map((cell, x) => (deadStones[y][x] ? null : cell)));
  let black = captures.black;
  let white = captures.white + KOMI;

  const visited = new Set<string>();

  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      if (currentBoard[y][x] === 'black') black++;
      else if (currentBoard[y][x] === 'white') white++;
      else {
        const key = `${x},${y}`;
        if (visited.has(key)) continue;

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
            { x: curr.x + 1, y: curr.y }, { x: curr.x - 1, y: curr.y },
            { x: curr.x, y: curr.y + 1 }, { x: curr.x, y: curr.y - 1 },
          ];

          for (const n of neighbors) {
            if (n.x >= 0 && n.x < BOARD_SIZE && n.y >= 0 && n.y < BOARD_SIZE) {
              const stone = currentBoard[n.y][n.x];
              if (stone === null) {
                tStack.push(n);
              } else {
                borders.add(stone);
              }
            }
          }
        }

        if (borders.size === 1) {
          if (borders.has('black')) black += territory.length;
          else if (borders.has('white')) white += territory.length;
        }
      }
    }
  }

  return { black, white };
};
