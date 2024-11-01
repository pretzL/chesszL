import { ChessEngine } from "./ChessEngine.js";

export class ChessAI {
    constructor(engine, depth = 3) {
        this.engine = engine;
        this.depth = depth;
    }

    static PIECE_VALUES = {
        pawn: 100,
        knight: 320,
        bishop: 330,
        rook: 500,
        queen: 900,
        king: 20000,
    };

    static POSITION_BONUSES = {
        pawn: [
            [0, 0, 0, 0, 0, 0, 0, 0],
            [50, 50, 50, 50, 50, 50, 50, 50],
            [10, 10, 20, 30, 30, 20, 10, 10],
            [5, 5, 10, 25, 25, 10, 5, 5],
            [0, 0, 0, 20, 20, 0, 0, 0],
            [5, -5, -10, 0, 0, -10, -5, 5],
            [5, 10, 10, -20, -20, 10, 10, 5],
            [0, 0, 0, 0, 0, 0, 0, 0],
        ],
        knight: [
            [-50, -40, -30, -30, -30, -30, -40, -50],
            [-40, -20, 0, 0, 0, 0, -20, -40],
            [-30, 0, 10, 15, 15, 10, 0, -30],
            [-30, 5, 15, 20, 20, 15, 5, -30],
            [-30, 0, 15, 20, 20, 15, 0, -30],
            [-30, 5, 10, 15, 15, 10, 5, -30],
            [-40, -20, 0, 5, 5, 0, -20, -40],
            [-50, -40, -30, -30, -30, -30, -40, -50],
        ],
        bishop: [
            [-20, -10, -10, -10, -10, -10, -10, -20],
            [-10, 0, 0, 0, 0, 0, 0, -10],
            [-10, 0, 5, 10, 10, 5, 0, -10],
            [-10, 5, 5, 10, 10, 5, 5, -10],
            [-10, 0, 10, 10, 10, 10, 0, -10],
            [-10, 10, 10, 10, 10, 10, 10, -10],
            [-10, 5, 0, 0, 0, 0, 5, -10],
            [-20, -10, -10, -10, -10, -10, -10, -20],
        ],
        rook: [
            [0, 0, 0, 0, 0, 0, 0, 0],
            [5, 10, 10, 10, 10, 10, 10, 5],
            [-5, 0, 0, 0, 0, 0, 0, -5],
            [-5, 0, 0, 0, 0, 0, 0, -5],
            [-5, 0, 0, 0, 0, 0, 0, -5],
            [-5, 0, 0, 0, 0, 0, 0, -5],
            [-5, 0, 0, 0, 0, 0, 0, -5],
            [0, 0, 0, 5, 5, 0, 0, 0],
        ],
        queen: [
            [-20, -10, -10, -5, -5, -10, -10, -20],
            [-10, 0, 0, 0, 0, 0, 0, -10],
            [-10, 0, 5, 5, 5, 5, 0, -10],
            [-5, 0, 5, 5, 5, 5, 0, -5],
            [0, 0, 5, 5, 5, 5, 0, -5],
            [-10, 5, 5, 5, 5, 5, 0, -10],
            [-10, 0, 5, 0, 0, 0, 0, -10],
            [-20, -10, -10, -5, -5, -10, -10, -20],
        ],
        king: [
            [-30, -40, -40, -50, -50, -40, -40, -30],
            [-30, -40, -40, -50, -50, -40, -40, -30],
            [-30, -40, -40, -50, -50, -40, -40, -30],
            [-30, -40, -40, -50, -50, -40, -40, -30],
            [-20, -30, -30, -40, -40, -30, -30, -20],
            [-10, -20, -20, -20, -20, -20, -20, -10],
            [20, 20, 0, 0, 0, 0, 20, 20],
            [20, 30, 10, 0, 0, 10, 30, 20],
        ],
    };

    evaluateBoard(isWhite) {
        let score = 0;
        const board = this.engine.board;

        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const square = board[row][col];
                if (!square.piece) continue;

                const pieceType = this.engine.getPieceType(square.piece);
                if (!pieceType) continue;

                const baseValue = ChessAI.PIECE_VALUES[pieceType];
                const positionBonus =
                    ChessAI.POSITION_BONUSES[pieceType][square.color === "white" ? row : 7 - row][col];

                const value = baseValue + positionBonus;
                score += square.color === "white" ? value : -value;
            }
        }

        return isWhite ? score : -score;
    }

    minimax(depth, alpha, beta, isMaximizing) {
        if (depth === 0) {
            return this.evaluateBoard(isMaximizing);
        }

        const moves = this.engine.getAllValidMoves(isMaximizing ? "white" : "black");

        if (moves.length === 0) {
            if (this.engine.isInCheck(isMaximizing ? "white" : "black")) {
                return isMaximizing ? -Infinity : Infinity;
            }
            return 0;
        }

        let bestValue = isMaximizing ? -Infinity : Infinity;

        for (const move of moves) {
            const engineCopy = new ChessEngine(this.engine.createBoardCopy(this.engine.board));
            engineCopy.makeMove(move.fromRow, move.fromCol, move.toRow, move.toCol);

            const value = this.minimax(depth - 1, alpha, beta, !isMaximizing);

            if (isMaximizing) {
                bestValue = Math.max(bestValue, value);
                alpha = Math.max(alpha, bestValue);
            } else {
                bestValue = Math.min(bestValue, value);
                beta = Math.min(beta, bestValue);
            }

            if (beta <= alpha) break;
        }

        return bestValue;
    }

    getBestMove() {
        const moves = this.engine.getAllValidMoves("black");
        let bestMove = null;
        let bestValue = Infinity;

        for (const move of moves) {
            const engineCopy = new ChessEngine(this.engine.createBoardCopy(this.engine.board));
            engineCopy.makeMove(move.fromRow, move.fromCol, move.toRow, move.toCol);

            const value = this.minimax(this.depth - 1, -Infinity, Infinity, true);

            if (value < bestValue) {
                bestValue = value;
                bestMove = move;
            }
        }

        return bestMove;
    }
}
