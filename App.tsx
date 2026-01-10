
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Color, GameState, GameMode, User, GameTimer, SituationAnalysis, PlayerRole } from './types';
import { BOARD_SIZE, DEFAULT_MOVE_TIME, KOMI } from './constants';
import { createEmptyBoard, tryMove, calculateScore, getLocalBestMove, getSituationAnalysis, isBoardSaturated } from './logic/goEngine';
import { AuthForm } from './components/Auth';
import { GameBoard } from './components/GameBoard';

const TEACHING_TIPS = [
  "中腹统治论：7x7 棋盘无金角银边，天元即一切。",
  "死活即胜负：宁可目数亏损，不可棋形破碎。",
  "零容错收官：小棋盘官子价值巨大，需精确计算。",
  "执黑要点：利用先手优势，从中心向四周高压辐射。",
  "执白要点：重视棋子弹性，利用打劫和反夹寻找生机。",
  "眼位高于实地：在狭小的空间里，活棋是第一位的。",
  "全盘算路：进入中盘后，每一手都应基于全局推演。",
  "不贪胜：稳扎稳打，让对手在狭窄的边角委屈做活。"
];

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  
  const [view, setView] = useState<'home' | 'auth' | 'game' | 'setup'>('home');
  const [authType, setAuthType] = useState<'signin' | 'signup'>('signin');
  const [mode, setMode] = useState<GameMode>('practice');
  const [playerRole, setPlayerRole] = useState<PlayerRole>('black'); // 玩家选择的颜色
  
  const [isThinking, setIsThinking] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showAnalysis, setShowAnalysis] = useState(true);
  const [currentTip, setCurrentTip] = useState(TEACHING_TIPS[0]);

  const [gameState, setGameState] = useState<GameState>(() => ({
    board: createEmptyBoard(),
    turn: 'black',
    history: [],
    moveHistory: [],
    lastMove: null,
    isGameOver: false,
    isScoringMode: false,
    deadStones: Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(false)),
    captures: { black: 0, white: 0 },
  }));

  const [timer, setTimer] = useState<GameTimer>({ global: 0, player: 0, move: 0 });
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const analysis: SituationAnalysis | null = useMemo(() => {
    return getSituationAnalysis(gameState.board, gameState.captures, gameState.turn, gameState.lastMove, gameState.moveHistory.length);
  }, [gameState.board, gameState.captures, gameState.turn, gameState.lastMove, gameState.moveHistory.length]);

  useEffect(() => {
    if (showAnalysis) {
      const randomIndex = Math.floor(Math.random() * TEACHING_TIPS.length);
      setCurrentTip(TEACHING_TIPS[randomIndex]);
    }
  }, [showAnalysis, gameState.isGameOver]);

  // AI Turn Logic
  useEffect(() => {
    if (view === 'game' && !gameState.isGameOver && !gameState.isScoringMode && gameState.turn !== playerRole && !isThinking) {
      // It's AI's turn
      setIsThinking(true);
      
      // Delay for UX
      setTimeout(() => {
        const prevBoard = gameState.history.length > 0 ? gameState.history[gameState.history.length - 1] : undefined;
        const aiColor = playerRole === 'black' ? 'white' : 'black';
        const aiMove = getLocalBestMove(gameState.board, aiColor, prevBoard);
        
        setIsThinking(false);

        if (aiMove === 'pass') {
          setErrorMsg("AI 无处落子，判定 AI 认输！");
          setGameState(prev => ({ ...prev, isGameOver: true, isScoringMode: true }));
        } else {
          const res = tryMove(gameState.board, aiMove.x, aiMove.y, aiColor, prevBoard);
          if (res.valid && res.newBoard) {
            const step = gameState.moveHistory.length + 1;
            setGameState(prev => ({
              ...prev,
              board: res.newBoard!,
              turn: playerRole, // Switch back to player
              history: [...prev.history, gameState.board],
              moveHistory: [...prev.moveHistory, { x: aiMove.x, y: aiMove.y, color: aiColor, step }],
              lastMove: { x: aiMove.x, y: aiMove.y },
              captures: { 
                ...prev.captures, 
                [aiColor]: prev.captures[aiColor] + res.captured 
              }
            }));
          }
        }
      }, 600);
    }
  }, [gameState.turn, view, isThinking, playerRole, gameState.isGameOver, gameState.isScoringMode]);

  useEffect(() => {
    if (!gameState.isGameOver && !gameState.isScoringMode && view === 'game') {
      const lastBoard = gameState.history.length > 0 ? gameState.history[gameState.history.length - 1] : undefined;
      // 这里的 saturated 检查现在由 AI Pass 逻辑主导，保留作为双保险
      if (isBoardSaturated(gameState.board, lastBoard)) {
        // 如果棋盘满了，进入点目
        setGameState(prev => ({ ...prev, isGameOver: true, isScoringMode: true }));
      }
    }
  }, [gameState.board, gameState.isGameOver, gameState.isScoringMode, view]);

  useEffect(() => {
    if (view === 'game' && !gameState.isGameOver && !gameState.isScoringMode) {
      timerRef.current = setInterval(() => {
        setTimer(prev => ({
          global: prev.global + 1,
          player: gameState.turn === playerRole ? prev.player + 1 : prev.player,
          move: mode === 'tournament' ? Math.max(0, prev.move - 1) : prev.move + 1,
        }));
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [view, gameState.turn, gameState.isGameOver, gameState.isScoringMode, mode, playerRole]);

  const initGame = (selectedRole: PlayerRole) => {
    setPlayerRole(selectedRole);
    setGameState({
      board: createEmptyBoard(),
      turn: 'black', // Black always goes first
      history: [],
      moveHistory: [],
      lastMove: null,
      isGameOver: false,
      isScoringMode: false,
      deadStones: Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(false)),
      captures: { black: 0, white: 0 },
    });
    setTimer({ global: 0, player: 0, move: mode === 'tournament' ? DEFAULT_MOVE_TIME : 0 });
    setErrorMsg(null);
    setView('game');
  };

  const handlePlaceStone = useCallback((x: number, y: number) => {
    if (gameState.isGameOver || gameState.isScoringMode || isThinking || gameState.turn !== playerRole) return;

    const prevBoardForKo = gameState.history.length > 0 ? gameState.history[gameState.history.length - 1] : undefined; 
    const res = tryMove(gameState.board, x, y, playerRole, prevBoardForKo);

    if (!res.valid) {
      if (res.isKo) {
        setErrorMsg("劫争：不能立即回提。");
        setTimeout(() => setErrorMsg(null), 2500);
      }
      return;
    }

    const step = gameState.moveHistory.length + 1;
    const aiColor = playerRole === 'black' ? 'white' : 'black';
    
    setGameState(prev => ({
      ...prev,
      board: res.newBoard!,
      turn: aiColor,
      history: [...prev.history, prev.board],
      moveHistory: [...prev.moveHistory, { x, y, color: playerRole, step }],
      lastMove: { x, y },
      captures: { ...prev.captures, [playerRole]: prev.captures[playerRole] + res.captured }
    }));
    
    // AI turn is handled by useEffect
  }, [gameState, isThinking, playerRole]);

  const handleUndo = () => {
    if (mode === 'tournament' || gameState.history.length < 2) return;
    // Undo 2 steps (AI + Player)
    const prevBoard = gameState.history[gameState.history.length - 2];
    setGameState(prev => ({
      ...prev,
      board: prevBoard,
      history: prev.history.slice(0, -2),
      moveHistory: prev.moveHistory.slice(0, -2),
      turn: playerRole, // Back to player turn
      lastMove: prev.moveHistory.length > 2 ? { x: prev.moveHistory[prev.moveHistory.length - 3].x, y: prev.moveHistory[prev.moveHistory.length - 3].y } : null,
    }));
    setErrorMsg(null);
  };

  const handleAuthSuccess = (email: string) => {
    setUser({ email, isLoggedIn: true });
    setView('home');
  };

  const score = calculateScore(gameState.board, gameState.deadStones, gameState.captures);

  if (!user && view !== 'auth') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6">
        <h1 className="text-5xl font-extrabold text-amber-800 mb-4 text-center tracking-tighter">七路围棋</h1>
        <div className="space-y-4 w-full max-w-xs mt-8">
          <button onClick={() => { setAuthType('signin'); setView('auth'); }} className="w-full py-3 bg-amber-600 text-white rounded-xl shadow-lg hover:bg-amber-700 transition">登录</button>
          <button onClick={() => { setAuthType('signup'); setView('auth'); }} className="w-full py-3 bg-white text-amber-800 border-2 border-amber-600 rounded-xl hover:bg-amber-50 transition">注册</button>
        </div>
      </div>
    );
  }

  if (view === 'auth') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
        <AuthForm type={authType} onAuthSuccess={handleAuthSuccess} onToggle={() => setAuthType(authType === 'signin' ? 'signup' : 'signin')} />
      </div>
    );
  }

  if (view === 'setup') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white p-8 rounded-3xl shadow-xl max-w-lg w-full text-center space-y-8">
          <h2 className="text-3xl font-bold text-amber-800">选择执子颜色</h2>
          <p className="text-gray-500">黑棋先手 (贴3.5目)，白棋后手。</p>
          <div className="grid grid-cols-2 gap-6">
            <button 
              onClick={() => initGame('black')}
              className="flex flex-col items-center p-6 border-2 border-gray-200 rounded-2xl hover:border-black hover:bg-gray-50 transition group"
            >
              <div className="w-16 h-16 rounded-full bg-black shadow-lg mb-4 group-hover:scale-110 transition-transform"></div>
              <span className="font-bold text-lg text-gray-800">执黑 (先手)</span>
              <span className="text-xs text-gray-400 mt-2">中腹压制，高位辐射</span>
            </button>
            <button 
              onClick={() => initGame('white')}
              className="flex flex-col items-center p-6 border-2 border-gray-200 rounded-2xl hover:border-gray-400 hover:bg-gray-50 transition group"
            >
              <div className="w-16 h-16 rounded-full bg-white border border-gray-300 shadow-lg mb-4 group-hover:scale-110 transition-transform"></div>
              <span className="font-bold text-lg text-gray-800">执白 (后手)</span>
              <span className="text-xs text-gray-400 mt-2">腾挪治孤，破坏眼位</span>
            </button>
          </div>
          <button onClick={() => setView('home')} className="text-gray-400 hover:text-gray-600">返回</button>
        </div>
      </div>
    );
  }

  if (view === 'home') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <header className="bg-white shadow-sm px-6 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-amber-800">Seven-Go</h1>
          <button onClick={() => { localStorage.removeItem('user'); setUser(null); setView('home'); }} className="text-sm text-gray-400 hover:text-red-500 transition">退出登录</button>
        </header>
        <main className="flex-1 flex flex-col items-center justify-center space-y-8 p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl">
            <div className="bg-white p-8 rounded-3xl shadow-xl hover:translate-y-[-4px] transition cursor-pointer border-b-8 border-amber-400" onClick={() => { setMode('practice'); setView('setup'); }}>
              <h3 className="text-2xl font-bold mb-2">练习模式</h3>
              <p className="text-gray-500 font-medium">深度推演预测，微战术口诀识别，首着独立思考引导。</p>
            </div>
            <div className="bg-white p-8 rounded-3xl shadow-xl hover:translate-y-[-4px] transition cursor-pointer border-b-8 border-indigo-400" onClick={() => { setMode('tournament'); setView('setup'); }}>
              <h3 className="text-2xl font-bold mb-2">比赛模式</h3>
              <p className="text-gray-500 font-medium">拟真竞技，30s 读秒，无提示无悔棋。</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col overflow-x-hidden">
      <header className="bg-white border-b px-6 py-3 flex justify-between items-center sticky top-0 z-50">
        <button onClick={() => setView('home')} className="text-amber-800 font-bold hover:underline">← 返回主页</button>
        <div className="flex items-center space-x-4">
          <span className="px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-[10px] font-black uppercase tracking-widest">
            {mode === 'practice' ? 'Practice' : 'Tournament'}
          </span>
          <button 
            onClick={() => setShowAnalysis(!showAnalysis)} 
            className={`px-3 py-1 rounded-full text-xs font-bold transition shadow-sm ${showAnalysis ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-600'}`}
          >
            {showAnalysis ? '隐藏战术板' : '显示战术板'}
          </button>
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row p-4 lg:p-8 gap-8 items-center lg:items-start justify-center">
        {/* 左侧信息 */}
        <div className="w-full lg:w-64 space-y-4">
          {/* Player Card */}
          <div className={`bg-white p-5 rounded-2xl shadow-sm border ${gameState.turn === playerRole ? 'border-amber-400 ring-2 ring-amber-100' : 'border-gray-200'} relative overflow-hidden transition-all`}>
             <div className={`absolute top-0 left-0 w-1 h-full ${playerRole === 'black' ? 'bg-black' : 'bg-gray-200 border-r border-gray-300'}`}></div>
            <h4 className="text-[10px] text-gray-400 font-black mb-1 uppercase tracking-tighter">YOU ({playerRole})</h4>
            <div className="text-3xl font-mono font-bold tracking-tighter">{Math.floor(timer.player / 60)}:{(timer.player % 60).toString().padStart(2, '0')}</div>
            <div className="flex justify-between mt-2 text-[10px] font-bold text-gray-500">
                <span>提子: {gameState.captures[playerRole]}</span>
            </div>
          </div>
          
          {/* AI Card */}
          <div className={`bg-white p-5 rounded-2xl shadow-sm border ${gameState.turn !== playerRole ? 'border-amber-400 ring-2 ring-amber-100' : 'border-gray-200'} relative overflow-hidden transition-all`}>
             <div className={`absolute top-0 left-0 w-1 h-full ${playerRole === 'black' ? 'bg-gray-200 border-r border-gray-300' : 'bg-black'}`}></div>
            <h4 className="text-[10px] text-gray-400 font-black mb-1 uppercase tracking-tighter">AI ({playerRole === 'black' ? 'white' : 'black'})</h4>
            <div className="text-2xl font-medium text-gray-400">{isThinking ? '深度算路中...' : '--:--'}</div>
            <div className="flex justify-between mt-2 text-[10px] font-bold text-gray-500">
                <span>提子: {gameState.captures[playerRole === 'black' ? 'white' : 'black']}</span>
            </div>
          </div>

          {gameState.isGameOver && (
            <div className="bg-amber-100 p-4 rounded-2xl border border-amber-200 text-center shadow-inner">
              <h4 className="text-sm font-black text-amber-800">对局结束</h4>
              <p className="text-[10px] text-amber-700 font-bold mt-1">进入点目模式或AI已认输</p>
            </div>
          )}
          {errorMsg && (
            <div className="p-3 bg-red-100 text-red-700 text-xs rounded-xl border border-red-200 font-bold animate-pulse">
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
            onToggleDeadStone={(x,y) => {
              const nd = gameState.deadStones.map(r=>[...r]);
              nd[y][x] = !nd[y][x];
              setGameState(s=>({...s, deadStones: nd}));
            }}
            recommendations={showAnalysis && analysis ? analysis.recommendations.map(r => ({x: r.x, y: r.y})) : []}
            warnings={showAnalysis && analysis ? analysis.warnings.map(w => ({x: w.x, y: w.y})) : []}
          />
          
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {mode === 'practice' && !gameState.isGameOver && <button onClick={handleUndo} className="px-8 py-2.5 bg-white border-2 border-gray-100 rounded-xl shadow-sm font-black text-gray-700 hover:bg-gray-50 transition active:scale-95">悔棋</button>}
            <button onClick={() => setGameState(s => ({ ...s, turn: s.turn === 'black' ? 'white' : 'black' }))} className="px-8 py-2.5 bg-white border-2 border-gray-100 rounded-xl shadow-sm font-black text-gray-700 hover:bg-gray-50 transition active:scale-95">轮空</button>
            <button onClick={() => setGameState(s => ({ ...s, isGameOver: true, isScoringMode: true }))} className="px-8 py-2.5 bg-red-50 text-red-600 border-2 border-red-100 rounded-xl font-black shadow-sm hover:bg-red-100 transition active:scale-95">认输</button>
          </div>

          <div className="mt-8 w-full max-w-lg bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex justify-between items-center">
            <div className="flex flex-col">
                <span className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Real-time Score</span>
                <div className="flex space-x-6 items-baseline">
                    <span className="text-3xl font-black text-black">黑: {score.black.toFixed(1)}</span>
                    <span className="text-xl font-bold text-gray-400">白: {score.white.toFixed(1)}</span>
                </div>
            </div>
            <div className="text-[10px] text-gray-400 font-black text-right">贴目: {KOMI}</div>
          </div>
        </div>

        {/* 右侧战术面板 */}
        {showAnalysis && (
          <div className="w-full lg:w-[420px] flex flex-col space-y-4 h-full">
            <div className="bg-white rounded-[32px] shadow-2xl border border-indigo-50 overflow-hidden flex flex-col">
              <div className="bg-indigo-600 px-6 py-5 flex justify-between items-center">
                <h3 className="text-white font-black text-lg tracking-tight">智能深度战术</h3>
                <span className="text-[10px] text-indigo-200 font-black px-2 py-1 bg-indigo-500 rounded-md">ALPHA-BETA V2</span>
              </div>
              <div className="p-6 space-y-6 overflow-y-auto max-h-[600px] bg-gradient-to-b from-white to-indigo-50/30">
                {!analysis ? (
                    <div className="flex flex-col items-center justify-center py-20 text-indigo-300">
                        <span className="text-4xl mb-4">♟️</span>
                        <p className="text-xs font-bold text-center px-10">
                            {gameState.moveHistory.length === 0 
                             ? "开局阶段：请遵循中腹统治论，抢占天元及周边要点。" 
                             : "正在进行全盘算路..."}
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100 shadow-inner">
                            <p className="text-xs text-indigo-900 leading-relaxed font-bold italic">“{analysis.summary}”</p>
                        </div>
                        
                        <div className="space-y-4">
                            <h4 className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em] border-b border-emerald-100 pb-2">最优推演 (RECOMMENDED)</h4>
                            {analysis.recommendations.map((move, idx) => (
                                <div key={idx} className="group p-4 bg-white border border-emerald-50 rounded-2xl flex flex-col space-y-3 shadow-sm hover:shadow-md transition-all">
                                    <div className="flex space-x-4 items-start">
                                        <div className="w-8 h-8 bg-emerald-500 text-white text-xs flex items-center justify-center rounded-xl flex-shrink-0 font-black shadow-lg">#{idx+1}</div>
                                        <div className="space-y-1">
                                            <span className="text-xs font-black text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md">({move.x+1}, {move.y+1})</span>
                                            <p className="text-[11px] text-emerald-700 leading-relaxed font-medium mt-1">{move.reason}</p>
                                        </div>
                                    </div>
                                    {move.tacticName && (
                                        <div className="p-2.5 bg-indigo-600 text-white rounded-xl text-[10px] font-bold shadow-sm animate-in slide-in-from-left duration-300">
                                            <span className="mr-1">🔖</span> {move.tacticName}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        <div className="space-y-4">
                            <h4 className="text-[10px] font-black text-red-600 uppercase tracking-[0.2em] border-b border-red-100 pb-2">避开盲点 (WARNING)</h4>
                            {analysis.warnings.map((move, idx) => (
                                <div key={idx} className="p-4 bg-red-50/50 border border-red-100 rounded-2xl flex space-x-4 items-start">
                                    <div className="w-8 h-8 bg-red-500 text-white text-xs flex items-center justify-center rounded-xl flex-shrink-0 font-black">×</div>
                                    <div className="space-y-2">
                                        <span className="text-xs font-black text-red-800 bg-red-100 px-2 py-0.5 rounded-md">({move.x+1}, {move.y+1})</span>
                                        <p className="text-[11px] text-red-700 leading-relaxed font-medium">{move.reason}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
              </div>
            </div>
            
            <div className="bg-amber-50 rounded-[24px] p-5 border border-amber-100 shadow-sm relative overflow-hidden">
                <div className="absolute -right-4 -bottom-6 text-amber-100/50 text-6xl font-black select-none rotate-12">GUIDE</div>
              <h4 className="text-[10px] font-black text-amber-800 uppercase mb-3 tracking-widest flex items-center">
                  <span className="mr-2">💡</span> 围棋小课堂
              </h4>
              <p className="text-xs text-amber-800 leading-relaxed italic font-bold relative z-10 bg-white/40 p-3 rounded-xl backdrop-blur-sm border border-amber-200/50">
                “{currentTip}”
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
