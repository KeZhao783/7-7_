
export type Color = 'black' | 'white' | null;

export type GameMode = 'practice' | 'tournament';

export interface GameState {
  board: Color[][];
  turn: 'black' | 'white';
  history: Color[][][];
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
