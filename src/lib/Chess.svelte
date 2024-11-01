<script>
    import { ChessEngine } from "./ChessEngine.js";
    import { ChessAI } from "./aiModule.js";

    // Initialize engine and AI
    let engine = $state(new ChessEngine());
    let ai = new ChessAI(engine);

    // Game state
    let currentPlayer = $state("white");
    let selectedPiece = $state(null);
    let moveHistory = $state([]);
    let gameStatus = $state("active");
    let promotionPending = $state(null);
    let statusMessage = $state("White's turn");
    let isAIThinking = $state(false);

    // Initialize the game
    function updateGameStatus() {
        if (promotionPending) {
            statusMessage = "Choose promotion piece";
            return;
        }

        if (gameStatus === "checkmate") {
            statusMessage = `${currentPlayer === "white" ? "Black" : "White"} wins by checkmate!`;
        } else if (gameStatus === "stalemate") {
            statusMessage = "Game drawn by stalemate";
        } else if (gameStatus === "check") {
            statusMessage = `${currentPlayer}, you are in check!`;
        } else {
            statusMessage = `${currentPlayer}'s turn`;
        }
    }

    function updateMoveHistory(fromRow, fromCol, toRow, toCol) {
        const notation = engine.getMoveNotation(fromRow, fromCol, toRow, toCol);
        const piece = engine.board[toRow][toCol].piece;
        moveHistory = [
            ...moveHistory,
            {
                piece,
                from: notation.from,
                to: notation.to,
            },
        ];
    }

    function finishMove() {
        const nextPlayer = currentPlayer === "white" ? "black" : "white";

        // Check game state
        const newStatus = engine.getGameStatus(nextPlayer);
        gameStatus = newStatus;
        currentPlayer = nextPlayer;
        selectedPiece = null;

        updateGameStatus();
    }

    function handlePromotion(piece) {
        if (!promotionPending) return;

        engine.promotePawn(promotionPending.row, promotionPending.col, piece);
        // Force reactivity update
        engine = new ChessEngine(engine.board);
        // Update AI's reference to the new engine
        ai = new ChessAI(engine);

        promotionPending = null;
        finishMove();
    }

    async function makeAIMove() {
        if (currentPlayer === "black" && !promotionPending && gameStatus === "active") {
            isAIThinking = true;

            // Add a small delay to make the AI seem more "natural"
            await new Promise((resolve) => setTimeout(resolve, 500));

            const move = ai.getBestMove();
            if (move) {
                // Make the move in the engine
                const result = engine.makeMove(move.fromRow, move.fromCol, move.toRow, move.toCol);

                // Force reactivity update by creating a new engine instance
                engine = new ChessEngine(result.board);
                // Update AI's reference to the new engine
                ai = new ChessAI(engine);

                updateMoveHistory(move.fromRow, move.fromCol, move.toRow, move.toCol);

                if (result.needsPromotion) {
                    // AI always promotes to queen
                    const promotionPiece = currentPlayer === "black" ? "♛" : "♕";
                    handlePromotion(promotionPiece);
                } else {
                    finishMove();
                }
            }

            isAIThinking = false;
        }
    }

    function handleSquareClick(row, col) {
        if (promotionPending || isAIThinking || gameStatus !== "active") return;

        const square = engine.board[row][col];

        if (selectedPiece) {
            const [selectedRow, selectedCol] = selectedPiece;

            if (engine.isValidMove(selectedRow, selectedCol, row, col, currentPlayer)) {
                const result = engine.makeMove(selectedRow, selectedCol, row, col);
                updateMoveHistory(selectedRow, selectedCol, row, col);

                if (result.needsPromotion) {
                    promotionPending = result.promotionData;
                    updateGameStatus();
                } else {
                    finishMove();
                }
            } else {
                selectedPiece = null;
            }
        } else if (square.color === currentPlayer) {
            selectedPiece = [row, col];
        }
    }

    function isSquareSelected(row, col) {
        return selectedPiece && selectedPiece[0] === row && selectedPiece[1] === col;
    }

    function isValidMoveTarget(row, col) {
        return selectedPiece && engine.isValidMove(selectedPiece[0], selectedPiece[1], row, col, currentPlayer);
    }

    function isLastMove(row, col) {
        const lastMove = engine.lastMove;
        return (
            lastMove &&
            ((row === lastMove.fromRow && col === lastMove.fromCol) ||
                (row === lastMove.toRow && col === lastMove.toCol))
        );
    }

    function getSquareColor(row, col) {
        return (row + col) % 2 === 0 ? "white" : "black";
    }

    const promotionPieces = {
        white: ["♕", "♖", "♗", "♘"],
        black: ["♛", "♜", "♝", "♞"],
    };

    // Watch for player moves and respond with AI moves
    $effect(() => {
        if (currentPlayer === "black" && !promotionPending && gameStatus === "active") {
            makeAIMove();
        }
    });

    // Initialize game status
    updateGameStatus();
</script>

<div class="game">
    <div class="status">{statusMessage}</div>

    {#if promotionPending}
        <div class="promotion-dialog">
            {#each promotionPieces[promotionPending.color] as piece}
                <button
                    class="promotion-piece"
                    onclick={() => handlePromotion(piece)}
                >
                    {piece}
                </button>
            {/each}
        </div>
    {/if}

    <div class="game-container">
        {#if isAIThinking}
            <div class="ai-thinking">AI is thinking...</div>
        {/if}
        <div class="board">
            {#each engine.board as row, rowIndex}
                {#each row as square, colIndex}
                    {@const isSelected = isSquareSelected(rowIndex, colIndex)}
                    {@const isValidTarget = isValidMoveTarget(rowIndex, colIndex)}
                    {@const isLastMoveTile = isLastMove(rowIndex, colIndex)}
                    <div
                        class="square {getSquareColor(rowIndex, colIndex)}"
                        class:selected={isSelected}
                        class:valid-move={isValidTarget}
                        class:last-move={isLastMoveTile}
                        onclick={() => handleSquareClick(rowIndex, colIndex)}
                        onkeypress={(e) => {
                            if (e.key === "Enter") handleSquareClick(rowIndex, colIndex);
                        }}
                        tabindex="0"
                        role="button"
                    >
                        {square.piece}
                    </div>
                {/each}
            {/each}
        </div>

        <div class="move-history">
            <h3>Move History</h3>
            <div class="moves">
                {#each moveHistory as move, i}
                    {@const playerColor = i % 2 === 0 ? "White" : "Black"}
                    <div class="move">
                        {i + 1}. {playerColor}: {move.piece}
                        {move.from}-{move.to}
                    </div>
                {/each}
            </div>
        </div>
    </div>
</div>

<style>
    .game {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1rem;
        padding: 1rem;
    }

    .game-container {
        display: flex;
        gap: 2rem;
        align-items: flex-start;
        position: relative;
    }

    .status {
        font-size: 1.2rem;
        font-weight: bold;
        margin-bottom: 1rem;
    }

    .ai-thinking {
        font-style: italic;
        color: #666;
        margin-bottom: 1rem;
        position: absolute;
        top: -1.5rem;
    }

    .board {
        width: 400px;
        height: 400px;
        border: 2px solid #333;
        display: grid;
        grid-template-columns: repeat(8, 1fr);
    }

    .square {
        display: flex;
        justify-content: center;
        align-items: center;
        font-size: 2em;
        cursor: pointer;
        transition: background-color 0.2s;
        aspect-ratio: 1 / 1;
    }

    .square.white {
        background-color: #fff;
    }

    .square.black {
        background-color: #ccc;
    }

    .square.selected {
        background-color: #7f7fff;
    }

    .square.valid-move {
        background-color: #7fff7f;
    }

    .square.last-move {
        background-color: #ffffa0;
    }

    .promotion-dialog {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background-color: white;
        border: 2px solid #333;
        padding: 1rem;
        display: flex;
        gap: 1rem;
        z-index: 10;
    }

    .promotion-piece {
        font-size: 2em;
        padding: 0.5rem 1rem;
        cursor: pointer;
        border: 1px solid #ccc;
        background: white;
        transition: background-color 0.2s;
    }

    .promotion-piece:hover {
        background-color: #f0f0f0;
    }

    .move-history {
        min-width: 200px;
        max-height: 400px;
        overflow-y: auto;
        border: 1px solid #ccc;
        padding: 1rem;
        background-color: #f8f8f8;
    }

    .move-history h3 {
        margin-top: 0;
        margin-bottom: 0.5rem;
        text-align: center;
    }

    .moves {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .move {
        font-family: monospace;
        padding: 0.2rem 0;
    }
</style>
