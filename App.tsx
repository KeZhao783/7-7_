
import React, { useState, useEffect, useCallback, useRef } from 'react';
// Fix: Import types and constants from their respective files
import { Color, GameState, GameMode, User, GameTimer } from './types';
import { BOARD_SIZE, DEFAULT_MOVE_TIME } from './constants';
import { createEmptyBoard, tryMove, calculateScore } from './logic/goEngine';
import { GeminiService } from './services/geminiService';
import { AuthForm } from './components/Auth';
import { GameBoard } from './components/GameBoard';

const App: React.FC = () => {
  // Navigation & User State
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });
  const [view, setView] = useState<'home' | 'auth' | 'game'>('home');
  const [authType, setAuthType] = useState<'signin' | 'signup'>('signin');
  
  // Game Configuration
  const [mode, setMode] = useState<GameMode>('practice');
  const [gameState, setGameState] = useState<GameState>({
    board: createEmptyBoard(),
    turn: 'black',
    history: [],
    lastMove: null,
    isGameOver: false,
    isScoringMode: false,
    deadStones: Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(false)),
    captures: { black: 0, white: 0 },
  });

  // Timers
  const [timer, setTimer] = useState<GameTimer>({ global: 0, player: 0, move: 0 });
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [analysis, setAnalysis] = useState<string>('');

  const gemini = useRef(new GeminiService());
  // Fix: Use ReturnType<typeof setInterval> instead of NodeJS.Timeout for browser compatibility
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Timer logic
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

  // Tournament timeout
  useEffect(() => {
    if (mode === 'tournament' && timer.move === 0 && !gameState.isGameOver) {
      handlePass(); // Pass on timeout
    }
  }, [timer.move, mode, gameState.isGameOver]);

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
    setAnalysis('');
    setView('game');
  };

  const handlePlaceStone = useCallback(async (x: number, y: number) => {
    if (gameState.isGameOver || gameState.isScoringMode || isAiThinking) return;
    if (gameState.turn !== 'black') return; // User is black

    const { valid, newBoard, captured } = tryMove(gameState.board, x, y, 'black');
    if (!valid || !newBoard) return;

    const nextState: GameState = {
      ...gameState,
      board: newBoard,
      turn: 'white',
      history: [...gameState.history, gameState.board],
      lastMove: { x, y },
      captures: { ...gameState.captures, black: gameState.captures.black + captured }
    };

    setGameState(nextState);
    setTimer(prev => ({ ...prev, move: mode === 'tournament' ? DEFAULT_MOVE_TIME : 0 }));
    
    // AI Turn
    setIsAiThinking(true);
    const aiMove = await gemini.current.getAiMove(newBoard, 'white');
    setIsAiThinking(false);

    if (aiMove === 'pass') {
      handlePass('white');
    } else {
      const { valid: aiValid, newBoard: aiBoard, captured: aiCaptured } = tryMove(newBoard, aiMove.x, aiMove.y, 'white');
      if (aiValid && aiBoard) {
        setGameState(prev => ({
          ...prev,
          board: aiBoard,
          turn: 'black',
          history: [...prev.history, nextState.board],
          lastMove: { x: aiMove.x, y: aiMove.y },
          captures: { ...prev.captures, white: prev.captures.white + aiCaptured }
        }));
        setTimer(prev => ({ ...prev, move: mode === 'tournament' ? DEFAULT_MOVE_TIME : 0 }));
      } else {
        handlePass('white');
      }
    }
  }, [gameState, isAiThinking, mode]);

  const handlePass = (colorOverride?: 'black' | 'white') => {
    const actingColor = colorOverride || gameState.turn;
    const nextTurn = actingColor === 'black' ? 'white' : 'black';
    
    setGameState(prev => ({
      ...prev,
      turn: nextTurn,
      history: [...prev.history, prev.board]
    }));
    setTimer(prev => ({ ...prev, move: mode === 'tournament' ? DEFAULT_MOVE_TIME : 0 }));

    // Simple check: if two passes in a row (simplified here), trigger scoring
    // For now, let user trigger scoring via "认输" or "点目"
  };

  const handleUndo = () => {
    if (mode === 'tournament') return;
    if (gameState.history.length < 2) return;
    
    // Undo both AI and User move
    const prevBoard = gameState.history[gameState.history.length - 2];
    setGameState(prev => ({
      ...prev,
      board: prevBoard,
      history: prev.history.slice(0, -2),
      turn: 'black',
      lastMove: null, // simplification
    }));
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

  const requestAnalysis = async () => {
    setIsAiThinking(true);
    const result = await gemini.current.analyzeGame(gameState.board, gameState.turn);
    setAnalysis(result);
    setIsAiThinking(false);
  };

  const score = calculateScore(gameState.board, gameState.deadStones, gameState.captures);

  if (!user && view !== 'auth') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6">
        <div className="text-center mb-10">
          <h1 className="text-5xl font-extrabold text-amber-800 mb-4">七路围棋</h1>
          <p className="text-gray-600 text-lg">开启您的围棋博弈之旅</p>
        </div>
        <div className="space-y-4 w-full max-w-xs">
          <button 
            onClick={() => { setAuthType('signin'); setView('auth'); }}
            className="w-full py-3 bg-amber-600 text-white rounded-xl shadow-lg hover:bg-amber-700 transition"
          >
            登录
          </button>
          <button 
            onClick={() => { setAuthType('signup'); setView('auth'); }}
            className="w-full py-3 bg-white text-amber-800 border-2 border-amber-600 rounded-xl shadow-md hover:bg-amber-50 transition"
          >
            注册
          </button>
        </div>
      </div>
    );
  }

  if (view === 'auth') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
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
          <div className="flex items-center space-x-4">
            <span className="text-gray-600">{user?.email}</span>
            <button onClick={() => { localStorage.removeItem('user'); setUser(null); }} className="text-sm text-gray-400 hover:text-red-500">退出</button>
          </div>
        </header>

        <main className="flex-1 flex flex-col items-center justify-center space-y-8 p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl">
            <div className="bg-white p-8 rounded-2xl shadow-lg hover:shadow-xl transition cursor-pointer border-t-4 border-amber-500" onClick={() => startNewGame('practice')}>
              <h3 className="text-2xl font-bold mb-2">练习模式</h3>
              <p className="text-gray-500">自由对弈，支持悔棋与无限思考。适合磨练技巧。</p>
              <div className="mt-4 text-amber-600 font-semibold">进入游戏 →</div>
            </div>
            <div className="bg-white p-8 rounded-2xl shadow-lg hover:shadow-xl transition cursor-pointer border-t-4 border-blue-500" onClick={() => startNewGame('tournament')}>
              <h3 className="text-2xl font-bold mb-2">比赛模式</h3>
              <p className="text-gray-500">标准计秒，无法悔棋。模拟真实赛事紧张感。</p>
              <div className="mt-4 text-blue-600 font-semibold">开始挑战 →</div>
            </div>
          </div>
          <button 
            disabled 
            className="w-full max-w-md py-4 bg-gray-200 text-gray-400 rounded-xl font-bold cursor-not-allowed"
          >
            对局解读 (敬请期待)
          </button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <header className="bg-white border-b px-6 py-3 flex justify-between items-center sticky top-0 z-50">
        <button onClick={() => setView('home')} className="text-amber-800 font-bold hover:underline">← 返回主页</button>
        <div className="text-center">
          <span className="px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-sm font-bold uppercase">
            {mode === 'practice' ? '练习模式' : '比赛模式'}
          </span>
        </div>
        <div className="flex space-x-4">
           <button onClick={requestAnalysis} className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700">AI解读</button>
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row p-4 lg:p-8 gap-8 items-start justify-center">
        {/* Left Side: Game Info */}
        <div className="w-full lg:w-64 space-y-4 shrink-0">
          <div className="bg-white p-4 rounded-xl shadow-md border-l-4 border-black">
            <h4 className="text-xs text-gray-400 uppercase font-bold mb-2">黑棋 (您)</h4>
            <div className="text-2xl font-mono">{Math.floor(timer.player / 60)}:{(timer.player % 60).toString().padStart(2, '0')}</div>
            <div className="text-sm text-gray-500 mt-1">提子: {gameState.captures.black}</div>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-md border-l-4 border-gray-300">
            <h4 className="text-xs text-gray-400 uppercase font-bold mb-2">白棋 (AI)</h4>
            <div className="text-2xl font-mono">
              {isAiThinking ? <span className="animate-pulse">思考中...</span> : '--:--'}
            </div>
            <div className="text-sm text-gray-500 mt-1">提子: {gameState.captures.white}</div>
          </div>
          <div className="bg-amber-50 p-4 rounded-xl shadow-sm">
            <h4 className="text-xs text-amber-800 uppercase font-bold mb-2">全局计时</h4>
            <div className="text-xl font-mono text-amber-900">{Math.floor(timer.global / 60)}:{(timer.global % 60).toString().padStart(2, '0')}</div>
            {mode === 'tournament' && (
              <div className="mt-2 pt-2 border-t border-amber-200">
                <h4 className="text-xs text-red-600 font-bold uppercase mb-1">当前读秒</h4>
                <div className="text-3xl font-bold text-red-600">{timer.move}s</div>
              </div>
            )}
          </div>
        </div>

        {/* Center: Board */}
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
            {mode === 'practice' && (
              <button 
                onClick={handleUndo} 
                className="px-6 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 shadow-sm"
              >
                悔棋
              </button>
            )}
            <button 
              onClick={() => handlePass()} 
              className="px-6 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 shadow-sm"
            >
              轮空
            </button>
            <button 
              onClick={() => { setGameState(s => ({ ...s, isGameOver: true, isScoringMode: true })); }} 
              className="px-6 py-2 bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 shadow-sm"
            >
              认输
            </button>
            <button 
              onClick={toggleScoring} 
              className={`px-6 py-2 border rounded-lg shadow-sm transition ${gameState.isScoringMode ? 'bg-amber-600 text-white' : 'bg-white border-amber-600 text-amber-800'}`}
            >
              {gameState.isScoringMode ? '完成点目' : '开始点目'}
            </button>
          </div>

          <div className="mt-6 w-full max-w-lg bg-gray-200 rounded-full h-2 overflow-hidden">
             <div className="bg-black h-full transition-all duration-500" style={{ width: `${(score.black / (score.black + score.white)) * 100}%` }}></div>
          </div>
          <div className="mt-2 flex justify-between w-full max-w-lg text-sm font-bold">
            <span className="text-black">黑: {score.black.toFixed(1)} 目</span>
            <span className="text-gray-600">白: {score.white.toFixed(1)} 目</span>
          </div>
        </div>

        {/* Right Side: Analysis & History */}
        <div className="w-full lg:w-80 space-y-4">
          <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100 h-96 overflow-y-auto">
            <h4 className="text-lg font-bold mb-4 text-indigo-800">AI 局势分析</h4>
            {analysis ? (
              <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{analysis}</div>
            ) : (
              <div className="text-gray-400 text-sm italic">点击顶部“AI解读”按钮获取当前局势深度分析...</div>
            )}
            {isAiThinking && <div className="mt-4 text-xs text-indigo-500 animate-pulse">Gemini 正在思考中...</div>}
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
            <h4 className="text-sm font-bold text-gray-500 mb-2">操作说明</h4>
            <ul className="text-xs text-gray-400 space-y-1 list-disc pl-4">
              <li>点击交叉点落子</li>
              <li>提子系统自动判定气数</li>
              <li>禁入点：无气且无法提子的位置</li>
              <li>点目：进入后点击石子标记为死子</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
