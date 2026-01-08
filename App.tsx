
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Color, GameState, GameMode, User, GameTimer } from './types';
import { BOARD_SIZE, DEFAULT_MOVE_TIME } from './constants';
import { createEmptyBoard, tryMove, calculateScore, getLocalBestMove } from './logic/goEngine';
import { AuthForm } from './components/Auth';
import { GameBoard } from './components/GameBoard';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  
  const [view, setView] = useState<'home' | 'auth' | 'game'>('home');
  const [authType, setAuthType] = useState<'signin' | 'signup'>('signin');
  const [mode, setMode] = useState<GameMode>('practice');
  const [isThinking, setIsThinking] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [gameState, setGameState] = useState<GameState>(() => ({
    board: createEmptyBoard(),
    turn: 'black',
    history: [],
    lastMove: null,
    isGameOver: false,
    isScoringMode: false,
    deadStones: Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(false)),
    captures: { black: 0, white: 0 },
  }));

  const [timer, setTimer] = useState<GameTimer>({ global: 0, player: 0, move: 0 });
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (view === 'game' && !gameState.isGameOver && !gameState.isScoringMode) {
      timerRef.current = setInterval(() => {
        setTimer(prev => ({
          global: prev.global + 1,
          player: gameState.turn === 'black' ? prev.player + 1 : prev.player,
          move: mode === 'tournament' ? Math.max(0, prev.move - 1) : prev.move + 1,
        }));
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [view, gameState.turn, gameState.isGameOver, gameState.isScoringMode, mode]);

  const startNewGame = (gameMode: GameMode) => {
    setMode(gameMode);
    setGameState({
      board: createEmptyBoard(),
      turn: 'black',
      history: [],
      lastMove: null,
      isGameOver: false,
      isScoringMode: false,
      deadStones: Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(false)),
      captures: { black: 0, white: 0 },
    });
    setTimer({
      global: 0,
      player: 0,
      move: gameMode === 'tournament' ? DEFAULT_MOVE_TIME : 0,
    });
    setErrorMsg(null);
    setView('game');
  };

  const handlePlaceStone = useCallback((x: number, y: number) => {
    if (gameState.isGameOver || gameState.isScoringMode || isThinking || gameState.turn !== 'black') return;

    // 劫争校验：对比当前生成的盘面是否与历史记录中“对手落子前”的盘面一致
    const prevBoardForKo = gameState.history[gameState.history.length - 1]; 
    const res = tryMove(gameState.board, x, y, 'black', prevBoardForKo);

    if (!res.valid) {
      if (res.isKo) {
        setErrorMsg("劫争：不能立即回提，请先在其他位置落子。");
        setTimeout(() => setErrorMsg(null), 3000);
      }
      return;
    }

    if (!res.newBoard) return;
    setErrorMsg(null);

    const midState: GameState = {
      ...gameState,
      board: res.newBoard,
      turn: 'white',
      history: [...gameState.history, gameState.board],
      lastMove: { x, y },
      captures: { ...gameState.captures, black: gameState.captures.black + res.captured }
    };

    setGameState(midState);
    setTimer(prev => ({ ...prev, move: mode === 'tournament' ? DEFAULT_MOVE_TIME : 0 }));
    
    setIsThinking(true);
    setTimeout(() => {
      // AI 也需要传入历史进行劫争判断
      const aiPrevBoardForKo = midState.history[midState.history.length - 1];
      const aiMove = getLocalBestMove(midState.board, 'white', aiPrevBoardForKo);
      setIsThinking(false);

      if (aiMove === 'pass') {
        setGameState(prev => ({ ...prev, turn: 'black' }));
      } else {
        const aiRes = tryMove(midState.board, aiMove.x, aiMove.y, 'white', aiPrevBoardForKo);
        if (aiRes.valid && aiRes.newBoard) {
          setGameState(prev => ({
            ...prev,
            board: aiRes.newBoard!,
            turn: 'black',
            history: [...prev.history, midState.board],
            lastMove: { x: aiMove.x, y: aiMove.y },
            captures: { ...prev.captures, white: prev.captures.white + aiRes.captured }
          }));
          setTimer(prev => ({ ...prev, move: mode === 'tournament' ? DEFAULT_MOVE_TIME : 0 }));
        }
      }
    }, 600);
  }, [gameState, isThinking, mode]);

  const handleUndo = () => {
    if (mode === 'tournament' || gameState.history.length < 2) return;
    const prevBoard = gameState.history[gameState.history.length - 2];
    setGameState(prev => ({
      ...prev,
      board: prevBoard,
      history: prev.history.slice(0, -2),
      turn: 'black',
      lastMove: null,
    }));
    setErrorMsg(null);
  };

  const toggleScoring = () => {
    setGameState(prev => ({ ...prev, isScoringMode: !prev.isScoringMode }));
  };

  const handleToggleDeadStone = (x: number, y: number) => {
    if (!gameState.board[y][x]) return;
    const nextDead = gameState.deadStones.map(row => [...row]);
    nextDead[y][x] = !nextDead[y][x];
    setGameState(prev => ({ ...prev, deadStones: nextDead }));
  };

  const score = calculateScore(gameState.board, gameState.deadStones, gameState.captures);
  const totalScore = score.black + score.white || 1;
  const blackWinPercent = (score.black / totalScore) * 100;

  if (!user && view !== 'auth') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6">
        <h1 className="text-5xl font-extrabold text-amber-800 mb-4 text-center">七路围棋</h1>
        <div className="space-y-4 w-full max-w-xs mt-8">
          <button onClick={() => { setAuthType('signin'); setView('auth'); }} className="w-full py-3 bg-amber-600 text-white rounded-xl shadow-lg hover:bg-amber-700">登录</button>
          <button onClick={() => { setAuthType('signup'); setView('auth'); }} className="w-full py-3 bg-white text-amber-800 border-2 border-amber-600 rounded-xl hover:bg-amber-50">注册</button>
        </div>
      </div>
    );
  }

  if (view === 'auth') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
        <AuthForm 
          type={authType} 
          onAuthSuccess={() => { setUser(JSON.parse(localStorage.getItem('user')!)); setView('home'); }} 
          onToggle={() => setAuthType(authType === 'signin' ? 'signup' : 'signin')}
        />
      </div>
    );
  }

  if (view === 'home') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <header className="bg-white shadow-sm px-6 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-amber-800">七路围棋</h1>
          <button onClick={() => { localStorage.removeItem('user'); setUser(null); }} className="text-sm text-gray-400 hover:text-red-500">退出 ({user?.email})</button>
        </header>
        <main className="flex-1 flex flex-col items-center justify-center space-y-8 p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl">
            <div className="bg-white p-8 rounded-2xl shadow-lg hover:shadow-xl transition cursor-pointer border-t-4 border-amber-500" onClick={() => startNewGame('practice')}>
              <h3 className="text-2xl font-bold mb-2">练习模式</h3>
              <p className="text-gray-500">支持悔棋，加入劫争检测逻辑。</p>
            </div>
            <div className="bg-white p-8 rounded-2xl shadow-lg hover:shadow-xl transition cursor-pointer border-t-4 border-blue-500" onClick={() => startNewGame('tournament')}>
              <h3 className="text-2xl font-bold mb-2">比赛模式</h3>
              <p className="text-gray-500">30s 读秒，无法悔棋。</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <header className="bg-white border-b px-6 py-3 flex justify-between items-center sticky top-0 z-50">
        <button onClick={() => setView('home')} className="text-amber-800 font-bold hover:underline">返回主页</button>
        <span className="px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-sm font-bold">
          {mode === 'practice' ? '练习' : '比赛'}
        </span>
        <div className="w-12"></div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row p-4 lg:p-8 gap-8 items-center lg:items-start justify-center">
        {/* 左侧计时器 */}
        <div className="w-full lg:w-64 space-y-4">
          <div className="bg-white p-4 rounded-xl shadow-md border-l-4 border-black">
            <h4 className="text-xs text-gray-400 font-bold mb-1">黑 (您)</h4>
            <div className="text-2xl font-mono">{Math.floor(timer.player / 60)}:{(timer.player % 60).toString().padStart(2, '0')}</div>
            <div className="text-xs text-gray-500">提子: {gameState.captures.black}</div>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-md border-l-4 border-gray-300">
            <h4 className="text-xs text-gray-400 font-bold mb-1">白 (AI)</h4>
            <div className="text-2xl font-mono">{isThinking ? '计算中...' : '--:--'}</div>
            <div className="text-xs text-gray-500">提子: {gameState.captures.white}</div>
          </div>
          {mode === 'tournament' && (
            <div className="bg-red-50 p-4 rounded-xl border border-red-100 text-center">
              <h4 className="text-xs text-red-600 font-bold mb-1">剩余秒数</h4>
              <div className="text-3xl font-bold text-red-600">{timer.move}s</div>
            </div>
          )}
          {errorMsg && (
            <div className="p-3 bg-red-100 text-red-700 text-xs rounded-lg animate-bounce border border-red-200">
              {errorMsg}
            </div>
          )}
        </div>

        {/* 棋盘区域 */}
        <div className="flex flex-col items-center">
          <GameBoard 
            board={gameState.board} 
            lastMove={gameState.lastMove}
            onPlaceStone={handlePlaceStone}
            isScoringMode={gameState.isScoringMode}
            deadStones={gameState.deadStones}
            onToggleDeadStone={handleToggleDeadStone}
          />
          
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {mode === 'practice' && <button onClick={handleUndo} className="px-4 py-2 bg-white border border-gray-300 rounded-lg shadow-sm">悔棋</button>}
            <button onClick={() => setGameState(s => ({ ...s, turn: s.turn === 'black' ? 'white' : 'black' }))} className="px-4 py-2 bg-white border border-gray-300 rounded-lg shadow-sm">轮空</button>
            <button onClick={() => setGameState(s => ({ ...s, isScoringMode: true }))} className="px-4 py-2 bg-red-50 text-red-700 border border-red-200 rounded-lg shadow-sm">认输</button>
            <button onClick={toggleScoring} className={`px-4 py-2 border rounded-lg shadow-sm ${gameState.isScoringMode ? 'bg-amber-600 text-white' : 'bg-white border-amber-600 text-amber-800'}`}>
              {gameState.isScoringMode ? '完成点目' : '开始点目'}
            </button>
          </div>

          <div className="mt-6 w-full max-w-lg bg-gray-200 rounded-full h-2 overflow-hidden flex">
             <div className="bg-black h-full transition-all duration-500" style={{ width: `${blackWinPercent}%` }}></div>
          </div>
          <div className="mt-2 flex justify-between w-full max-w-lg text-sm font-bold">
            <span>黑: {score.black.toFixed(1)}</span>
            <span>白: {score.white.toFixed(1)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
