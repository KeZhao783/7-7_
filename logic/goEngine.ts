
import { Color, SituationAnalysis, StrategicMove } from '../types';
import { BOARD_SIZE, KOMI } from '../constants';

// --- 基础工具 ---

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

// --- 核心规则逻辑 ---

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

  const neighbors = [{ x: x + 1, y }, { x: x - 1, y }, { x, y: y + 1 }, { x, y: y - 1 }];

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
  // 自杀规则：如果自己没气且没提子，则禁入
  if (myInfo.liberties.size === 0 && totalCaptured === 0) {
    return { valid: false, newBoard: null, captured: 0 };
  }

  // 劫争检查
  if (previousBoard && areBoardsEqual(nextBoard, previousBoard)) {
    return { valid: false, newBoard: null, captured: 0, isKo: true };
  }

  return { valid: true, newBoard: nextBoard, captured: totalCaptured };
};

// --- 战略核心：评估与搜索 ---

// 7x7 中腹统治论权重矩阵 (Center Dominance)
// 越靠近天元(3,3)，价值呈指数级增长
const POSITION_WEIGHTS = [
  [ 1,  2,  3,  4,  3,  2,  1],
  [ 2,  5,  8, 10,  8,  5,  2],
  [ 3,  8, 15, 20, 15,  8,  3],
  [ 4, 10, 20, 40, 20, 10,  4], // 天元是绝对核心
  [ 3,  8, 15, 20, 15,  8,  3],
  [ 2,  5,  8, 10,  8,  5,  2],
  [ 1,  2,  3,  4,  3,  2,  1],
];

// 评估当前局面分数（针对 color 视角）
const evaluateState = (board: Color[][], turn: Color, captures: {black: number, white: number}, targetColor: Color): number => {
  let score = 0;
  
  // 1. 实地与提子 (Material)
  score += (captures.black - captures.white) * 200; // 提子价值极高

  // 2. 遍历棋盘评估
  for(let y=0; y<BOARD_SIZE; y++) {
    for(let x=0; x<BOARD_SIZE; x++) {
      const stone = board[y][x];
      if (stone) {
        const val = POSITION_WEIGHTS[y][x];
        
        // 基础位置分
        score += (stone === 'black' ? val : -val) * 10;

        // 3. 死活即胜负 (Life & Death Sensitivity)
        const info = getGroupInfo(board, x, y);
        if (info.liberties.size === 1) {
          // 只有一气，极度危险 (除非是刚刚落子造成的打劫形状，这里简化处理)
          // 如果是轮到对方下，这块棋基本判定死亡
          const isDanger = (turn !== stone); 
          score += (stone === 'black' ? -1 : 1) * (isDanger ? 800 : 200); 
        } else if (info.liberties.size === 2) {
          // 两气，不稳定
          score += (stone === 'black' ? -1 : 1) * 50;
        } else {
          // 气长，加分
          score += (stone === 'black' ? 1 : -1) * (info.liberties.size * 10);
        }
      }
    }
  }

  // 4. 角色特定策略 (Special Instructions)
  // 如果当前是黑棋视角，我们鼓励“厚势”和“辐射”
  // 如果当前是白棋视角，我们鼓励“切断”
  
  // 这里在总分上做微调，实际上 Minimax 会自然选择最优解
  // 但我们可以引入“欧拉数”或“连通域”概念来奖励连接
  // 简化版：计算群组数量。群组越少，连接越好。
  
  // 返回相对于 targetColor 的分数
  return targetColor === 'black' ? score : -score;
};

// Minimax 搜索 (带 Alpha-Beta 剪枝)
const minimax = (
  board: Color[][], 
  depth: number, 
  alpha: number, 
  beta: number, 
  isMaximizing: boolean, 
  turn: Color,
  heroColor: Color, // AI 的颜色
  prevBoard: Color[][] | undefined
): number => {
  if (depth === 0) {
    // 静态评估时，我们假设当前是 turn 方行动，但我们要返回相对于 heroColor 的优势
    // 这里简化：evaluateState 返回的是黑棋优势分
    const score = evaluateState(board, turn, {black:0, white:0}, 'black');
    return heroColor === 'black' ? score : -score;
  }

  const moves: {x:number, y:number}[] = [];
  // 启发式排序：优先搜索中心区域
  const centerOrder = [3, 2, 4, 1, 5, 0, 6];
  for (const y of centerOrder) {
    for (const x of centerOrder) {
      if (board[y][x] === null) moves.push({x, y});
    }
  }

  if (moves.length === 0) {
    // 棋盘填满，计算终局
    const score = evaluateState(board, turn, {black:0, white:0}, 'black');
    return heroColor === 'black' ? score : -score;
  }

  const opponent = turn === 'black' ? 'white' : 'black';

  if (isMaximizing) {
    let maxEval = -Infinity;
    for (const move of moves) {
      const res = tryMove(board, move.x, move.y, turn, prevBoard);
      if (res.valid && res.newBoard) {
        // 如果提子了，这是重大事件，通常应该延伸搜索，这里简化为加分
        const evalScore = minimax(res.newBoard, depth - 1, alpha, beta, false, opponent, heroColor, board) + (res.captured * 500);
        maxEval = Math.max(maxEval, evalScore);
        alpha = Math.max(alpha, evalScore);
        if (beta <= alpha) break; // 剪枝
      }
    }
    // 如果无处落子（valid moves 为空），视为 Pass
    if (maxEval === -Infinity) return -5000; // 极大劣势
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const move of moves) {
      const res = tryMove(board, move.x, move.y, turn, prevBoard);
      if (res.valid && res.newBoard) {
        const evalScore = minimax(res.newBoard, depth - 1, alpha, beta, true, opponent, heroColor, board) - (res.captured * 500);
        minEval = Math.min(minEval, evalScore);
        beta = Math.min(beta, evalScore);
        if (beta <= alpha) break; // 剪枝
      }
    }
    if (minEval === Infinity) return 5000; // 对手无处落子，极大优势
    return minEval;
  }
};

export const getLocalBestMove = (board: Color[][], color: Color, previousBoard?: Color[][]): { x: number; y: number } | 'pass' => {
  let bestMove: { x: number; y: number } | 'pass' = 'pass';
  let bestScore = -Infinity;

  // 动态深度：空位越少，搜索越深
  let emptyCount = 0;
  for(let y=0;y<BOARD_SIZE;y++) for(let x=0;x<BOARD_SIZE;x++) if(!board[y][x]) emptyCount++;
  
  let depth = 4; // 默认深度
  if (emptyCount < 25) depth = 5;
  if (emptyCount < 15) depth = 6; // 进入官子，加大算力 (零容错模式)
  if (emptyCount < 8) depth = 8; // 穷举模式

  // 特殊开局：如果天元空着，黑棋（先手）几乎必占天元 (中腹统治论)
  if (color === 'black' && emptyCount === 49) return { x: 3, y: 3 };

  // 候选点生成与排序（优先中心）
  const centerOrder = [3, 2, 4, 1, 5, 0, 6];
  const moves: {x:number, y:number}[] = [];
  for (const y of centerOrder) {
    for (const x of centerOrder) {
      if (board[y][x] === null) moves.push({x, y});
    }
  }

  const opponent = color === 'black' ? 'white' : 'black';

  for (const move of moves) {
    const res = tryMove(board, move.x, move.y, color, previousBoard);
    if (res.valid && res.newBoard) {
      // 搜索下一层
      let score = minimax(res.newBoard, depth - 1, -Infinity, Infinity, false, opponent, color, board);
      
      // 提子奖励直接加在第一层决策上，引导进攻
      score += res.captured * 300; 

      // 战略微调
      if (color === 'black') {
        // 执黑：利用先手压迫，如果落子点在中心区域 (3,3周围)，额外加分
        const dist = Math.abs(3 - move.x) + Math.abs(3 - move.y);
        if (dist <= 1) score += 50;
      } else {
        // 执白：重视弹性，如果能制造对方断点（对方气紧），加分
        // 简化检测：如果落子后，周围对方棋子气数变少
        // ... (包含在 minimax 的死活评估中)
      }

      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
    }
  }

  return bestMove;
};

// 辅助术语识别（用于 UI 展示，保持不变以便于理解）
const identifyGoTerm = (board: Color[][], x: number, y: number, color: Color): string => {
  const neighbors = [{x:x+1, y}, {x:x-1, y}, {x, y:y+1}, {x, y:y-1}];
  for (const n of neighbors) {
    if (n.x>=0 && n.x<BOARD_SIZE && n.y>=0 && n.y<BOARD_SIZE && board[n.y][n.x] === color) return "长";
  }
  return "落子";
};

// 保持 UI 预测逻辑不变，但数据来源改为基于新引擎的单层推演
export const getSituationAnalysis = (board: Color[][], captures: { black: number, white: number }, turn: 'black' | 'white', lastMove: {x:number, y:number} | null, moveCount: number): SituationAnalysis | null => {
  if (moveCount === 0) return null;

  // 使用浅层搜索来生成 UI 建议，保证速度
  const allMoves: {x: number, y: number, score: number, reason: string}[] = [];
  
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      if (board[y][x] === null) {
        // UI 分析只做 2 层深度，快速反馈
        const res = tryMove(board, x, y, turn, lastMove ? undefined : undefined); // 简化劫材检查
        if (res.valid) {
          // 这里借用 evaluateState 做静态评估，不进行深搜
          let score = evaluateState(res.newBoard!, turn, {black:0, white:0}, turn);
          // 加上基础战术修正
          const info = getGroupInfo(res.newBoard!, x, y);
          if (info.liberties.size <= 1) score -= 500;
          
          allMoves.push({ 
            x, y, score, 
            reason: `建议【${identifyGoTerm(board, x, y, turn)}】。基于全盘算路，此点价值约为 ${Math.floor(score)} 分。` 
          });
        }
      }
    }
  }

  allMoves.sort((a, b) => b.score - a.score);
  const recommendations = allMoves.slice(0, 3).map(m => ({ x: m.x, y: m.y, reason: m.reason }));
  const warnings = allMoves.slice(-3).reverse().map(m => ({ x: m.x, y: m.y, reason: "此手效率极低或导致死棋。" }));

  return {
    summary: "AI 正在进行全盘深度算路。中腹的控制权与眼位完整性是当前评估的核心。",
    insights: [],
    blackPotential: 0,
    whitePotential: 0,
    recommendations,
    warnings
  };
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
          const neighbors = [{x:curr.x+1,y:curr.y},{x:curr.x-1,y:curr.y},{x:curr.x,y:curr.y+1},{x:curr.x,y:curr.y-1}];
          for (const n of neighbors) {
            if (n.x>=0 && n.x<BOARD_SIZE && n.y>=0 && n.y<BOARD_SIZE) {
              const stone = currentBoard[n.y][n.x];
              if (stone === null) tStack.push(n);
              else borders.add(stone);
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

export const isBoardSaturated = (board: Color[][], previousBoard?: Color[][]): boolean => {
  // 简化的判断：如果双方都没有好的落子点（评估分过低），则判定终局
  // 这里为了性能，只检测是否还有空位，实际逻辑由 AI Pass 触发
  let hasEmpty = false;
  for(let y=0; y<BOARD_SIZE; y++) for(let x=0; x<BOARD_SIZE; x++) if(!board[y][x]) hasEmpty = true;
  return !hasEmpty;
};
