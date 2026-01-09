
import { Color, SituationAnalysis, AnalysisInsight } from '../types';
import { BOARD_SIZE, KOMI } from '../constants';

export const createEmptyBoard = (): Color[][] => {
  return Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null));
};

export const areBoardsEqual = (b1: Color[][], b2: Color[][]): boolean => {
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      if (b1[y][x] !== b2[y][x]) return false;
    }
  }
  return true;
};

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

export const tryMove = (
  board: Color[][], 
  x: number, 
  y: number, 
  color: Color, 
  previousBoard?: Color[][]
): { valid: boolean; newBoard: Color[][] | null; captured: number; isKo?: boolean } => {
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

  const myInfo = getGroupInfo(nextBoard, x, y);
  if (myInfo.liberties.size === 0 && totalCaptured === 0) {
    return { valid: false, newBoard: null, captured: 0 };
  }

  if (previousBoard && areBoardsEqual(nextBoard, previousBoard)) {
    return { valid: false, newBoard: null, captured: 0, isKo: true };
  }

  return { valid: true, newBoard: nextBoard, captured: totalCaptured };
};

export const getLocalBestMove = (board: Color[][], color: Color, previousBoard?: Color[][]): { x: number; y: number } | 'pass' => {
  const possibleMoves: { x: number; y: number; score: number }[] = [];

  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      const res = tryMove(board, x, y, color, previousBoard);
      if (res.valid) {
        let score = res.captured * 20;
        score += (3 - Math.abs(3 - x)) + (3 - Math.abs(3 - y));
        possibleMoves.push({ x, y, score });
      }
    }
  }

  if (possibleMoves.length === 0) return 'pass';
  possibleMoves.sort((a, b) => b.score - a.score);
  return { x: possibleMoves[0].x, y: possibleMoves[0].y };
};

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

/**
 * 局势分析逻辑：纯本地实现，不依赖外部 API
 */
export const getSituationAnalysis = (board: Color[][], captures: { black: number, white: number }): SituationAnalysis => {
  const insights: AnalysisInsight[] = [];
  const score = calculateScore(board, Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(false)), captures);
  
  // 1. 扫描气数风险
  const analyzedGroups = new Set<string>();
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      const stone = board[y][x];
      if (stone && !analyzedGroups.has(`${x},${y}`)) {
        const { liberties, group } = getGroupInfo(board, x, y);
        group.forEach(p => analyzedGroups.add(`${p.x},${p.y}`));

        if (liberties.size === 1) {
          insights.push({
            type: 'danger',
            text: `${stone === 'black' ? '黑' : '白'}棋在 (${group[0].x + 1},${group[0].y + 1}) 附近仅剩 1 气，处于打吃状态！`,
            coords: group
          });
        } else if (liberties.size === 2) {
          insights.push({
            type: 'warning',
            text: `${stone === 'black' ? '黑' : '白'}棋在 (${group[0].x + 1},${group[0].y + 1}) 附近气数较紧，需注意防守。`,
            coords: group
          });
        }
      }
    }
  }

  // 2. 形势总结
  const diff = score.black - score.white;
  let summary = "";
  if (Math.abs(diff) < 2) summary = "双方势均力敌，局势极为接近。";
  else if (diff > 0) summary = `黑棋目前领先约 ${diff.toFixed(1)} 目，优势在握。`;
  else summary = `白棋目前领先约 ${Math.abs(diff).toFixed(1)} 目，局势占优。`;

  // 3. 发展方向分析 (寻找空地及潜力)
  let blackPot = 0;
  let whitePot = 0;
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      if (board[y][x] === null) {
        let bCount = 0;
        let wCount = 0;
        const ns = [{x:x+1,y},{x:x-1,y},{x,y:y+1},{x,y:y-1}];
        ns.forEach(n => {
          if (n.x>=0 && n.x<BOARD_SIZE && n.y>=0 && n.y<BOARD_SIZE) {
            if (board[n.y][n.x] === 'black') bCount++;
            if (board[n.y][n.x] === 'white') wCount++;
          }
        });
        if (bCount >= 2 && wCount === 0) blackPot++;
        if (wCount >= 2 && bCount === 0) whitePot++;
      }
    }
  }

  if (blackPot > whitePot + 3) {
    insights.push({ type: 'info', text: "黑棋外势较厚，拥有更大的领土扩张潜力。" });
  } else if (whitePot > blackPot + 3) {
    insights.push({ type: 'info', text: "白棋阵型稳固，正在蚕食剩余的空地。" });
  }

  return {
    summary,
    insights: insights.sort((a, b) => {
      const order = { danger: 0, warning: 1, opportunity: 2, info: 3 };
      return order[a.type] - order[b.type];
    }),
    blackPotential: blackPot,
    whitePotential: whitePot
  };
};
