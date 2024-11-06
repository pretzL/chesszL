// aiModule.js
import { ChessEngine } from "./ChessEngine.js";

export class ChessAI {
    constructor(engine, difficulty = "medium") {
        this.engine = engine;
        this.difficulty = difficulty;
        this.maxThinkingTime = 3000;
        this.startTime = 0;
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

    setDifficulty(difficulty) {
        this.difficulty = difficulty;
    }

    evaluateBoard(isMaximizing) {
        let score = 0;

        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const square = this.engine.board[row][col];
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

        return isMaximizing ? score : -score;
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

    getMoveRandomization() {
        switch (this.difficulty) {
            // % chance of making a suboptimal move
            case "easy":
                return 0.3;
            case "medium":
                return 0.15;
            case "hard":
                return 0;
            default:
                return 0.15;
        }
    }

    getSearchDepth() {
        switch (this.difficulty) {
            case "easy":
                return 1;
            case "medium":
                return 2;
            case "hard":
                return 3;
            default:
                return 2;
        }
    }

    isTimeUp() {
        return Date.now() - this.startTime > this.maxThinkingTime;
    }

    findEscapeFromCheck() {
        const moves = this.engine.getAllValidMoves("black");
        const escapeMoves = [];

        for (const move of moves) {
            if (this.isTimeUp()) {
                console.error("Time up while finding escape moves");
                break;
            }

            const engineCopy = new ChessEngine(this.engine.createBoardCopy());
            try {
                engineCopy.makeMove(move.fromRow, move.fromCol, move.toRow, move.toCol);
                if (!engineCopy.isInCheck("black")) {
                    escapeMoves.push(move);
                }
            } catch (error) {
                console.error("Error testing escape move:", error);
                continue;
            }
        }

        if (escapeMoves.length === 0) {
            return null;
        }

        // For medium/hard, try to find the best escape move
        if (this.difficulty !== "easy") {
            let bestScore = -Infinity;
            let bestMove = escapeMoves[0];

            for (const move of escapeMoves) {
                if (this.isTimeUp()) break;

                try {
                    const engineCopy = new ChessEngine(this.engine.createBoardCopy());
                    engineCopy.makeMove(move.fromRow, move.fromCol, move.toRow, move.toCol);
                    const score = this.evaluateBoard(false);

                    if (score > bestScore) {
                        bestScore = score;
                        bestMove = move;
                    }
                } catch (error) {
                    console.error("Error evaluating escape move:", error);
                    continue;
                }
            }
            return bestMove;
        }

        // For easy difficulty or if evaluation fails, return random escape move
        return escapeMoves[Math.floor(Math.random() * escapeMoves.length)];
    }

    getBestMove() {
        this.startTime = Date.now();

        try {
            const moves = this.engine.getAllValidMoves("black");

            if (moves.length === 0) return null;

            // If in check, prioritize escaping check
            if (this.engine.isInCheck("black")) {
                const escapeMoves = [];

                for (const move of moves) {
                    // Test each move in a new engine instance to see if it escapes check
                    const engineCopy = new ChessEngine(this.engine.createBoardCopy());

                    try {
                        engineCopy.makeMove(move.fromRow, move.fromCol, move.toRow, move.toCol);

                        if (!engineCopy.isInCheck("black")) {
                            // For each escape move, calculate a simple material score
                            const score = this.quickEvaluate(engineCopy.board);
                            escapeMoves.push({ move, score });
                        }
                    } catch (error) {
                        console.error("Error testing escape move:", error);
                        continue;
                    }
                }

                if (escapeMoves.length > 0) {
                    escapeMoves.sort((a, b) => b.score - a.score);

                    // Choose move based on difficulty
                    let chosenMove;
                    if (this.difficulty === "easy") {
                        const randomIndex = Math.floor(Math.random() * escapeMoves.length);
                        chosenMove = escapeMoves[randomIndex].move;
                    } else {
                        chosenMove = escapeMoves[0].move;
                    }

                    return chosenMove;
                }

                return null;
            }

            const evaluatedMoves = [];

            // Filter obvious blunders for medium/hard
            let validMoves = moves;
            if (this.difficulty !== "easy") {
                validMoves = moves.filter((move) => !this.isBlunder(move));
                if (validMoves.length === 0) {
                    // If all moves are blunders, use original moves
                    validMoves = moves;
                }
            }

            for (const move of validMoves) {
                if (this.isTimeUp()) break;

                const engineCopy = new ChessEngine(this.engine.createBoardCopy());
                engineCopy.makeMove(move.fromRow, move.fromCol, move.toRow, move.toCol);
                const score = this.quickEvaluate(engineCopy.board);
                evaluatedMoves.push({ move, score });
            }

            if (evaluatedMoves.length === 0) {
                // If no moves were evaluated (due to time limit), pick a random valid move
                const randomMove = validMoves[Math.floor(Math.random() * validMoves.length)];
                return randomMove;
            }

            evaluatedMoves.sort((a, b) => b.score - a.score);

            let chosenMove;
            if (this.difficulty === "easy") {
                const randomIndex = Math.floor(Math.random() * Math.min(3, evaluatedMoves.length));
                chosenMove = evaluatedMoves[randomIndex].move;
            } else if (this.difficulty === "medium") {
                const topHalf = evaluatedMoves.slice(0, Math.ceil(evaluatedMoves.length / 2));
                chosenMove = topHalf[Math.floor(Math.random() * topHalf.length)].move;
            } else {
                chosenMove = evaluatedMoves[0].move;
            }

            return chosenMove;
        } catch (error) {
            console.error("Error in getBestMove:", error);
            // Emergency fallback - make any legal move
            try {
                const moves = this.engine.getAllValidMoves("black");
                if (moves.length > 0) {
                    const randomMove = moves[Math.floor(Math.random() * moves.length)];
                    return randomMove;
                }
            } catch (e) {
                console.error("Emergency fallback failed:", e);
            }
            return null;
        }
    }

    quickEvaluate(board) {
        let score = 0;
        const values = {
            pawn: 100,
            knight: 320,
            bishop: 330,
            rook: 500,
            queen: 900,
            king: 20000,
        };

        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const square = board[row][col];
                if (!square.piece) continue;

                const pieceType = this.engine.getPieceType(square.piece);
                if (!pieceType) continue;

                const value = values[pieceType];
                score += square.color === "white" ? -value : value;
            }
        }

        return score;
    }

    isBlunder(move) {
        const engineCopy = new ChessEngine(this.engine.createBoardCopy());
        const movingPiece = engineCopy.board[move.fromRow][move.fromCol];
        const pieceType = engineCopy.getPieceType(movingPiece.piece);

        if (!pieceType) return false;

        engineCopy.makeMove(move.fromRow, move.fromCol, move.toRow, move.toCol);

        // Check if the piece can be immediately captured
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const square = engineCopy.board[row][col];
                if (square.color === "white" && engineCopy.isValidMove(row, col, move.toRow, move.toCol, "white")) {
                    return true;
                }
            }
        }
        return false;
    }

    getBlunderThreshold() {
        switch (this.difficulty) {
            case "easy":
                return 1000; // Allow any moves
            case "medium":
                return 300; // Don't blunder pieces bigger than a knight
            case "hard":
                return 100; // Don't even blunder pawns
            default:
                return 300;
        }
    }
}
