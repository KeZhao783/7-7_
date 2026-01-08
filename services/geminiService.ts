
import { GoogleGenAI, Type } from "@google/genai";
import { Color } from "../types";
// Fix: Import BOARD_SIZE from constants instead of types
import { BOARD_SIZE } from "../constants";

export class GeminiService {
  private ai: GoogleGenAI;

  constructor() {
    // Fix: Initialize GoogleGenAI with mandatory process.env.API_KEY
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  async getAiMove(board: Color[][], myColor: 'black' | 'white'): Promise<{ x: number, y: number } | 'pass'> {
    const boardStr = board.map(row => row.map(cell => cell === null ? '.' : cell === 'black' ? 'B' : 'W').join('')).join('\n');
    
    const prompt = `You are a professional 7x7 Go (Weiqi) player. You are playing as ${myColor}. 
    Board (B=Black, W=White, .=Empty):
    ${boardStr}
    
    What is your next best move on a 7x7 grid (coordinates 0-6)? 
    Return as JSON: { "x": number, "y": number } or { "pass": true }.
    Think strategically about liberties, eyes, and territory.`;

    try {
      // Fix: Use gemini-3-pro-preview for complex reasoning tasks like Go
      const response = await this.ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              x: { type: Type.INTEGER },
              y: { type: Type.INTEGER },
              pass: { type: Type.BOOLEAN }
            }
          }
        }
      });

      // Fix: Access response.text property directly
      const result = JSON.parse(response.text || '{}');
      if (result.pass) return 'pass';
      if (typeof result.x === 'number' && typeof result.y === 'number') {
        return { x: result.x, y: result.y };
      }
      return 'pass';
    } catch (error) {
      console.error("Gemini Move Error:", error);
      return 'pass';
    }
  }

  async analyzeGame(board: Color[][], turn: string): Promise<string> {
    const boardStr = board.map(row => row.map(cell => cell === null ? '.' : cell === 'black' ? 'B' : 'W').join('')).join('\n');
    const prompt = `Analyze this 7x7 Go board from the perspective of a master teacher. 
    Current Turn: ${turn}
    Board:
    ${boardStr}
    
    Provide a brief, insightful summary of the current situation and possible strategies for both sides. Use friendly language.`;

    try {
      // Fix: Use gemini-3-pro-preview for complex reasoning tasks like Go analysis
      const response = await this.ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt,
      });
      // Fix: Access response.text property directly
      return response.text || "Unable to analyze the board at this moment.";
    } catch (error) {
      console.error("Gemini Analysis Error:", error);
      return "Analysis failed.";
    }
  }
}
