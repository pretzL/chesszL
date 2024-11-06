export class ChessEngine {
    constructor(initialBoard = null) {
        this.board = initialBoard || this.initializeBoard();
        this.lastMove = null;
    }

    initializeBoard() {
        const initialPosition = {
            0: ["♜", "♞", "♝", "♛", "♚", "♝", "♞", "♜"],
            1: ["♟", "♟", "♟", "♟", "♟", "♟", "♟", "♟"],
            6: ["♙", "♙", "♙", "♙", "♙", "♙", "♙", "♙"],
            7: ["♖", "♘", "♗", "♕", "♔", "♗", "♘", "♖"],
        };

        return Array(8)
            .fill(null)
            .map((_, row) =>
                Array(8)
                    .fill(null)
                    .map((_, col) => {
                        if (row in initialPosition) {
                            return {
                                piece: initialPosition[row][col],
                                color: row < 2 ? "black" : "white",
                                hasMoved: false,
                            };
                        }
                        return { piece: "", color: null, hasMoved: false };
                    })
            );
    }

    getPieceType(piece) {
        const pieceTypes = {
            "♙": "pawn",
            "♟": "pawn",
            "♖": "rook",
            "♜": "rook",
            "♘": "knight",
            "♞": "knight",
            "♗": "bishop",
            "♝": "bishop",
            "♕": "queen",
            "♛": "queen",
            "♔": "king",
            "♚": "king",
        };
        return pieceTypes[piece] || null;
    }

    createBoardCopy(boardToCopy = this.board) {
        return boardToCopy.map((row) => row.map((square) => ({ ...square })));
    }

    isValidMove(fromRow, fromCol, toRow, toCol, currentPlayer, checkingCheck = false) {
        const fromSquare = this.board[fromRow][fromCol];
        const toSquare = this.board[toRow][toCol];

        if (!checkingCheck && fromSquare.color !== currentPlayer) return false;
        if (toSquare.color === fromSquare.color) return false;

        const pieceType = this.getPieceType(fromSquare.piece);
        if (!pieceType) return false;

        const isValidPieceMove = this.isValidPieceMove(fromRow, fromCol, toRow, toCol, pieceType, fromSquare.color);
        if (!isValidPieceMove) return false;

        if (checkingCheck) return true;

        return !this.wouldBeInCheck(fromRow, fromCol, toRow, toCol, currentPlayer);
    }

    isValidPieceMove(fromRow, fromCol, toRow, toCol, pieceType, color) {
        const rowDiff = toRow - fromRow;
        const colDiff = toCol - fromCol;
        const absRowDiff = Math.abs(rowDiff);
        const absColDiff = Math.abs(colDiff);
        const isWhite = color === "white";

        switch (pieceType) {
            case "pawn": {
                const direction = isWhite ? -1 : 1;
                const startRow = isWhite ? 6 : 1;

                // Regular move forward
                if (colDiff === 0 && rowDiff === direction && !this.board[toRow][toCol].piece) {
                    return true;
                }

                // Initial two-square move
                if (
                    colDiff === 0 &&
                    fromRow === startRow &&
                    rowDiff === direction * 2 &&
                    !this.board[toRow][toCol].piece &&
                    !this.board[fromRow + direction][fromCol].piece
                ) {
                    return true;
                }

                // Regular capture
                if (absColDiff === 1 && rowDiff === direction && this.board[toRow][toCol].piece) {
                    return true;
                }

                // En passant
                if (
                    this.lastMove &&
                    this.getPieceType(this.board[this.lastMove.toRow][this.lastMove.toCol].piece) === "pawn" &&
                    Math.abs(this.lastMove.fromRow - this.lastMove.toRow) === 2 &&
                    this.lastMove.toRow === fromRow &&
                    Math.abs(this.lastMove.toCol - fromCol) === 1 &&
                    rowDiff === direction &&
                    absColDiff === 1
                ) {
                    return true;
                }

                return false;
            }

            case "rook": {
                if ((rowDiff === 0 || colDiff === 0) && this.isPathClear(fromRow, fromCol, toRow, toCol)) {
                    return true;
                }
                return false;
            }

            case "knight": {
                return (absRowDiff === 2 && absColDiff === 1) || (absRowDiff === 1 && absColDiff === 2);
            }

            case "bishop": {
                if (absRowDiff === absColDiff && this.isPathClear(fromRow, fromCol, toRow, toCol)) {
                    return true;
                }
                return false;
            }

            case "queen": {
                if (
                    (rowDiff === 0 || colDiff === 0 || absRowDiff === absColDiff) &&
                    this.isPathClear(fromRow, fromCol, toRow, toCol)
                ) {
                    return true;
                }
                return false;
            }

            case "king": {
                if (absRowDiff <= 1 && absColDiff <= 1) {
                    return true;
                }

                if (!this.board[fromRow][fromCol].hasMoved && rowDiff === 0 && absColDiff === 2) {
                    const isKingside = colDiff > 0;
                    const rookCol = isKingside ? 7 : 0;
                    const rook = this.board[fromRow][rookCol];

                    if (
                        rook.piece &&
                        !rook.hasMoved &&
                        this.isPathClear(fromRow, fromCol, fromRow, rookCol) &&
                        !this.isInCheck(color)
                    ) {
                        const intermediateCol = fromCol + (isKingside ? 1 : -1);
                        const tempEngine = new ChessEngine(this.createBoardCopy());
                        tempEngine.board[fromRow][intermediateCol] = tempEngine.board[fromRow][fromCol];
                        tempEngine.board[fromRow][fromCol] = { piece: "", color: null, hasMoved: false };

                        if (!tempEngine.isInCheck(color)) {
                            return true;
                        }
                    }
                }
                return false;
            }

            default:
                return false;
        }
    }

    isPathClear(fromRow, fromCol, toRow, toCol) {
        const rowStep = fromRow === toRow ? 0 : (toRow - fromRow) / Math.abs(toRow - fromRow);
        const colStep = fromCol === toCol ? 0 : (toCol - fromCol) / Math.abs(toCol - fromCol);

        let currentRow = fromRow + rowStep;
        let currentCol = fromCol + colStep;

        while (currentRow !== toRow || currentCol !== toCol) {
            if (this.board[currentRow][currentCol].piece) {
                return false;
            }
            currentRow += rowStep;
            currentCol += colStep;
        }

        return true;
    }

    findKing(color) {
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                if (this.getPieceType(this.board[row][col].piece) === "king" && this.board[row][col].color === color) {
                    return [row, col];
                }
            }
        }
        return null;
    }

    isInCheck(color) {
        const kingPos = this.findKing(color);
        if (!kingPos) return false;

        const [kingRow, kingCol] = kingPos;
        const oppositeColor = color === "white" ? "black" : "white";

        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                if (
                    this.board[row][col].color === oppositeColor &&
                    this.isValidMove(row, col, kingRow, kingCol, oppositeColor, true)
                ) {
                    return true;
                }
            }
        }
        return false;
    }

    wouldBeInCheck(fromRow, fromCol, toRow, toCol, color) {
        // Create a deep copy of the board to simulate the move
        const boardCopy = this.createBoardCopy();

        // Make the move on the copy
        const piece = boardCopy[fromRow][fromCol];
        boardCopy[toRow][toCol] = { ...piece, hasMoved: true };
        boardCopy[fromRow][fromCol] = { piece: "", color: null, hasMoved: false };

        const tempEngine = new ChessEngine(boardCopy);

        return tempEngine.isInCheck(color);
    }

    isCheckmate(currentPlayer) {
        if (!this.isInCheck(currentPlayer)) return false;
        return this.getAllValidMoves(currentPlayer).length === 0;
    }

    isStalemate(currentPlayer) {
        if (this.isInCheck(currentPlayer)) return false;
        return this.getAllValidMoves(currentPlayer).length === 0;
    }

    getAllValidMoves(color) {
        const moves = [];

        for (let fromRow = 0; fromRow < 8; fromRow++) {
            for (let fromCol = 0; fromCol < 8; fromCol++) {
                const piece = this.board[fromRow][fromCol];
                if (!piece.piece || piece.color !== color) continue;

                for (let toRow = 0; toRow < 8; toRow++) {
                    for (let toCol = 0; toCol < 8; toCol++) {
                        if (this.isValidMove(fromRow, fromCol, toRow, toCol, color)) {
                            moves.push({ fromRow, fromCol, toRow, toCol });
                        }
                    }
                }
            }
        }

        return moves;
    }

    makeMove(fromRow, fromCol, toRow, toCol) {
        const newBoard = this.createBoardCopy();
        const fromSquare = newBoard[fromRow][fromCol];
        const pieceType = this.getPieceType(fromSquare.piece);

        // Handle en passant capture
        if (
            pieceType === "pawn" &&
            this.lastMove &&
            this.getPieceType(this.board[this.lastMove.toRow][this.lastMove.toCol].piece) === "pawn" &&
            Math.abs(this.lastMove.fromRow - this.lastMove.toRow) === 2 &&
            this.lastMove.toRow === fromRow &&
            Math.abs(this.lastMove.toCol - fromCol) === 1
        ) {
            newBoard[this.lastMove.toRow][this.lastMove.toCol] = { piece: "", color: null, hasMoved: false };
        }

        // Handle castling
        if (pieceType === "king" && Math.abs(toCol - fromCol) === 2) {
            const isKingside = toCol > fromCol;
            const rookFromCol = isKingside ? 7 : 0;
            const rookToCol = isKingside ? toCol - 1 : toCol + 1;
            newBoard[toRow][rookToCol] = newBoard[toRow][rookFromCol];
            newBoard[toRow][rookFromCol] = { piece: "", color: null, hasMoved: false };
            newBoard[toRow][rookToCol].hasMoved = true;
        }

        newBoard[toRow][toCol] = { ...fromSquare, hasMoved: true };
        newBoard[fromRow][fromCol] = { piece: "", color: null, hasMoved: false };

        this.board = newBoard;
        this.lastMove = { fromRow, fromCol, toRow, toCol };

        return {
            board: newBoard,
            needsPromotion: pieceType === "pawn" && (toRow === 0 || toRow === 7),
            promotionData:
                pieceType === "pawn" && (toRow === 0 || toRow === 7)
                    ? { row: toRow, col: toCol, color: fromSquare.color }
                    : null,
        };
    }

    promotePawn(row, col, newPiece) {
        const square = this.board[row][col];
        if (this.getPieceType(square.piece) === "pawn") {
            this.board[row][col].piece = newPiece;
            return true;
        }
        return false;
    }

    getGameStatus(currentPlayer) {
        if (this.isCheckmate(currentPlayer)) return "checkmate";
        if (this.isStalemate(currentPlayer)) return "stalemate";
        if (this.isInCheck(currentPlayer)) return "check";
        return "active";
    }

    getMoveNotation(fromRow, fromCol, toRow, toCol) {
        const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
        const ranks = ["8", "7", "6", "5", "4", "3", "2", "1"];

        return {
            from: `${files[fromCol]}${ranks[fromRow]}`,
            to: `${files[toCol]}${ranks[toRow]}`,
        };
    }
}
