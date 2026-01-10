
export type Color = 'black' | 'white' | null;

export type GameMode = 'practice' | 'tournament';

export type PlayerRole = 'black' | 'white';

export interface Move {
  x: number;
  y: number;
  color: Color;
  step: number;
}

export interface GameState {
  board: Color[][];
  turn: 'black' | 'white';
  history: Color[][][];
  moveHistory: Move[];
  lastMove: { x: number; y: number } | null;
  isGameOver: boolean;
  isScoringMode: boolean;
  deadStones: boolean[][];
  captures: { black: number; white: number };
}

export interface User {
  email: string;
  isLoggedIn: boolean;
}

export interface GameTimer {
  global: number;
  player: number;
  move: number;
}

export interface AnalysisInsight {
  type: 'danger' | 'warning' | 'info' | 'opportunity';
  text: string;
  coords?: { x: number; y: number }[];
}

export interface StrategicMove {
  x: number;
  y: number;
  reason: string;
  tacticName?: string;
}

export interface SituationAnalysis {
  summary: string;
  insights: AnalysisInsight[];
  blackPotential: number;
  whitePotential: number;
  recommendations: StrategicMove[];
  warnings: StrategicMove[];
}
