import { ChessEngine } from "./ChessEngine.js";

export class ChessAI {
    constructor(engine, difficulty = "medium", color = "black") {
        this.engine = engine;
        this.difficulty = difficulty;
        this.color = color;
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
            [15, 15, 25, 35, 35, 25, 15, 15],
            [10, 10, 20, 35, 35, 20, 10, 10],
            [5, 5, 10, 25, 25, 10, 5, 5],
            [0, 0, 0, 20, 20, 0, 0, 0],
            [5, 10, 10, -20, -20, 10, 10, 5],
            [0, 0, 0, 0, 0, 0, 0, 0],
        ],
        knight: [
            [-50, -40, -30, -30, -30, -30, -40, -50],
            [-40, -20, 0, 5, 5, 0, -20, -40],
            [-30, 5, 15, 20, 20, 15, 5, -30],
            [-30, 0, 20, 25, 25, 20, 0, -30],
            [-30, 5, 20, 25, 25, 20, 5, -30],
            [-30, 0, 15, 20, 20, 15, 0, -30],
            [-40, -20, 0, 5, 5, 0, -20, -40],
            [-50, -40, -30, -30, -30, -30, -40, -50],
        ],
        bishop: [
            [-20, -10, -10, -10, -10, -10, -10, -20],
            [-10, 5, 0, 0, 0, 0, 5, -10],
            [-10, 10, 10, 15, 15, 10, 10, -10],
            [-10, 0, 15, 20, 20, 15, 0, -10],
            [-10, 5, 15, 20, 20, 15, 5, -10],
            [-10, 10, 10, 15, 15, 10, 10, -10],
            [-10, 5, 0, 0, 0, 0, 5, -10],
            [-20, -10, -10, -10, -10, -10, -10, -20],
        ],
        rook: [
            [0, 0, 0, 5, 5, 0, 0, 0],
            [-5, 0, 0, 0, 0, 0, 0, -5],
            [-5, 0, 0, 0, 0, 0, 0, -5],
            [-5, 0, 0, 0, 0, 0, 0, -5],
            [-5, 0, 0, 0, 0, 0, 0, -5],
            [-5, 0, 0, 0, 0, 0, 0, -5],
            [5, 10, 10, 10, 10, 10, 10, 5],
            [0, 0, 0, 0, 0, 0, 0, 0],
        ],
        queen: [
            [-20, -10, -10, -5, -5, -10, -10, -20],
            [-10, 0, 0, 0, 0, 0, 0, -10],
            [-10, 0, 5, 5, 5, 5, 0, -10],
            [-5, 0, 5, 10, 10, 5, 0, -5],
            [0, 0, 5, 10, 10, 5, 0, -5],
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

    static DIFFICULTY_WEIGHTS = {
        easy: {
            material: 1,
            position: 0.3,
            attack: 0.2,
            center: 0.1
        },
        medium: {
            material: 1,
            position: 0.5,
            attack: 0.4,
            center: 0.3
        },
        hard: {
            material: 1,
            position: 0.7,
            attack: 0.6,
            center: 0.5
        }
    };

    setDifficulty(difficulty) {
        this.difficulty = difficulty;
    }

    evaluateBoard(isMaximizing) {
        let materialScore = 0;
        let positionalScore = 0;
        let attackScore = 0;
        let centerControlScore = 0;

        const centerSquares = [
            [3, 3], [3, 4],
            [4, 3], [4, 4]
        ];

        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const square = this.engine.board[row][col];
                if (!square.piece) continue;

                const pieceType = this.engine.getPieceType(square.piece);
                if (!pieceType) continue;

                const isOurPiece = square.color === this.color;
                const multiplier = isOurPiece ? 1 : -1;

                const baseValue = ChessAI.PIECE_VALUES[pieceType];
                materialScore += baseValue * multiplier;

                const positionBonus = ChessAI.POSITION_BONUSES[pieceType][square.color === "white" ? row : 7 - row][col];
                positionalScore += positionBonus * multiplier;

                if (isOurPiece) {
                    const attacks = this.evaluateAttacks(row, col, pieceType);
                    attackScore += attacks * (baseValue / 100);
                }

                if (centerSquares.some(([r, c]) => r === row && c === col)) {
                    centerControlScore += baseValue * 0.1 * multiplier;
                }
            }
        }

        const weights = ChessAI.DIFFICULTY_WEIGHTS[this.difficulty];
        const score = (materialScore * weights.material) +
                     (positionalScore * weights.position) +
                     (attackScore * weights.attack) +
                     (centerControlScore * weights.center);

        return isMaximizing ? score : -score;
    }

    evaluateAttacks(row, col, pieceType) {
        let attackScore = 0;
        const moves = this.engine.getAllValidMoves(this.color);
        
        for (const move of moves) {
            if (move.fromRow === row && move.fromCol === col) {
                const targetSquare = this.engine.board[move.toRow][move.toCol];
                if (targetSquare.piece) {
                    const targetType = this.engine.getPieceType(targetSquare.piece);
                    if (targetType) {
                        attackScore += ChessAI.PIECE_VALUES[targetType] / 100;
                    }
                }
                if ((move.toRow === 3 || move.toRow === 4) && 
                    (move.toCol === 3 || move.toCol === 4)) {
                    attackScore += 0.5;
                }
            }
        }

        return attackScore;
    }

    minimax(engine, depth, alpha, beta, isMaximizing) {
        if (depth === 0 || this.isTimeUp()) {
            return this.evaluateBoard(isMaximizing);
        }

        const moves = engine.getAllValidMoves(isMaximizing ? this.color : (this.color === "white" ? "black" : "white"));

        if (moves.length === 0) {
            if (engine.isInCheck(isMaximizing ? this.color : (this.color === "white" ? "black" : "white"))) {
                return isMaximizing ? -20000 : 20000;
            }
            return 0;
        }

        moves.sort((a, b) => {
            const aScore = this.getInitialMoveScore(a);
            const bScore = this.getInitialMoveScore(b);
            return isMaximizing ? bScore - aScore : aScore - bScore;
        });

        let bestValue = isMaximizing ? -Infinity : Infinity;

        for (const move of moves) {
            if (this.isTimeUp()) break;

            const engineCopy = new ChessEngine(engine.createBoardCopy());
            engineCopy.makeMove(move.fromRow, move.fromCol, move.toRow, move.toCol);

            const value = this.minimax(engineCopy, depth - 1, alpha, beta, !isMaximizing);

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
            case "easy": return 0.3;
            case "medium": return 0.1;
            case "hard": return 0.05;
            default: return 0.15;
        }
    }

    getSearchDepth() {
        switch (this.difficulty) {
            case "easy": return 2;
            case "medium": return 3;
            case "hard": return 4;
            default: return 3;
        }
    }

    isTimeUp() {
        return Date.now() - this.startTime > this.maxThinkingTime;
    }

    findEscapeFromCheck() {
        const moves = this.engine.getAllValidMoves(this.color);
        const escapeMoves = [];

        for (const move of moves) {
            if (this.isTimeUp()) break;

            const engineCopy = new ChessEngine(this.engine.createBoardCopy());
            try {
                engineCopy.makeMove(move.fromRow, move.fromCol, move.toRow, move.toCol);
                if (!engineCopy.isInCheck(this.color)) {
                    escapeMoves.push(move);
                }
            } catch (error) {
                console.error("Error testing escape move:", error);
                continue;
            }
        }

        if (escapeMoves.length === 0) return null;

        if (this.difficulty !== "easy") {
            let bestScore = -Infinity;
            let bestMove = escapeMoves[0];

            for (const move of escapeMoves) {
                if (this.isTimeUp()) break;

                const engineCopy = new ChessEngine(this.engine.createBoardCopy());
                engineCopy.makeMove(move.fromRow, move.fromCol, move.toRow, move.toCol);
                const score = this.evaluateBoard(false);

                if (score > bestScore) {
                    bestScore = score;
                    bestMove = move;
                }
            }
            return bestMove;
        }

        return escapeMoves[Math.floor(Math.random() * escapeMoves.length)];
    }

    getBestMove() {
        this.startTime = Date.now();
        const moves = this.engine.getAllValidMoves(this.color);
        if (moves.length === 0) return null;

        if (this.engine.isInCheck(this.color)) {
            return this.findEscapeFromCheck();
        }

        const depth = this.getSearchDepth();
        let bestMove = null;
        let bestScore = -Infinity;

        moves.sort((a, b) => {
            const aScore = this.getInitialMoveScore(a);
            const bScore = this.getInitialMoveScore(b);
            return bScore - aScore;
        });

        for (const move of moves) {
            if (this.isTimeUp()) break;

            const engineCopy = new ChessEngine(this.engine.createBoardCopy());
            engineCopy.makeMove(move.fromRow, move.fromCol, move.toRow, move.toCol);

            const score = this.minimax(engineCopy, depth - 1, -Infinity, Infinity, false);

            if (score > bestScore) {
                bestScore = score;
                bestMove = move;
            }
        }

        if (Math.random() < this.getMoveRandomization()) {
            const randomIndex = Math.floor(Math.random() * Math.min(3, moves.length));
            return moves[randomIndex];
        }

        return bestMove;
    }

    getInitialMoveScore(move) {
        let score = 0;
        const targetSquare = this.engine.board[move.toRow][move.toCol];
        
        if (targetSquare.piece) {
            const targetType = this.engine.getPieceType(targetSquare.piece);
            if (targetType) {
                score += ChessAI.PIECE_VALUES[targetType];
            }
        }

        if ((move.toRow === 3 || move.toRow === 4) && 
            (move.toCol === 3 || move.toCol === 4)) {
            score += 50;
        }

        return score;
    }
}