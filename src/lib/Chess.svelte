<script>
    import "./styles/components/chess.scss";
    import { ChessEngine } from "./ChessEngine.js";
    import { ChessAI } from "./aiModule.js";
    import { storage } from "$lib/utils/storage";
    import { browser } from "$app/environment";

    let theme = $state(storage.get("chess-theme", "light"));

    // Initialize engine and AI
    let engine = $state(new ChessEngine());
    let ai = new ChessAI(engine);
    let difficulty = $state("medium");

    // Game state
    let currentPlayer = $state("white");
    let selectedPiece = $state(null);
    let moveHistory = $state([]);
    let gameStatus = $state("active");
    let promotionPending = $state(null);
    let statusMessage = $state("White's turn");
    let isAIThinking = $state(false);

    function toggleTheme() {
        theme = theme === "light" ? "dark" : "light";
        storage.set("chess-theme", theme);
    }

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

    function handleDifficultyChange(newDifficulty) {
        difficulty = newDifficulty;
        ai.setDifficulty(newDifficulty);
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
        const newStatus = engine.getGameStatus(nextPlayer);

        gameStatus = newStatus;
        currentPlayer = nextPlayer;
        selectedPiece = null;

        updateGameStatus();
    }

    function handlePromotion(piece) {
        if (!promotionPending) return;

        engine.promotePawn(promotionPending.row, promotionPending.col, piece);
        engine = new ChessEngine(engine.board);
        ai = new ChessAI(engine);

        promotionPending = null;
        finishMove();
    }

    async function makeAIMove() {
        if (currentPlayer === "black" && !promotionPending && (gameStatus === "active" || gameStatus === "check")) {
            isAIThinking = true;

            try {
                await new Promise((resolve) => setTimeout(resolve, 100));
                const move = ai.getBestMove();

                if (move) {
                    const result = engine.makeMove(move.fromRow, move.fromCol, move.toRow, move.toCol);
                    engine = new ChessEngine(result.board);

                    updateMoveHistory(move.fromRow, move.fromCol, move.toRow, move.toCol);

                    if (result.needsPromotion) {
                        const promotionPiece = "♛"; // Black queen
                        handlePromotion(promotionPiece);
                    } else {
                        finishMove();
                    }

                    ai = new ChessAI(engine);
                } else {
                    gameStatus = engine.isInCheck("black") ? "checkmate" : "stalemate";
                    updateGameStatus();
                }
            } catch (error) {
                gameStatus = "checkmate";
                console.error("Error making AI move:", error);
                updateGameStatus();
            } finally {
                isAIThinking = false;
            }
        }
    }

    function handleSquareClick(row, col) {
        if (promotionPending || isAIThinking || (gameStatus !== "active" && gameStatus !== "check")) return;

        const square = engine.board[row][col];

        if (selectedPiece) {
            const [selectedRow, selectedCol] = selectedPiece;

            if (engine.isValidMove(selectedRow, selectedCol, row, col, currentPlayer)) {
                try {
                    const result = engine.makeMove(selectedRow, selectedCol, row, col);
                    engine = new ChessEngine(result.board);

                    updateMoveHistory(selectedRow, selectedCol, row, col);

                    if (result.needsPromotion) {
                        promotionPending = result.promotionData;
                        updateGameStatus();
                    } else {
                        finishMove();
                        ai = new ChessAI(engine, difficulty);
                    }
                } catch (error) {
                    console.error("Error making move:", error);
                    selectedPiece = null;
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

    function resetGame() {
        engine = new ChessEngine();
        ai = new ChessAI(engine, difficulty);
        currentPlayer = "white";
        selectedPiece = null;
        moveHistory = [];
        gameStatus = "active";
        promotionPending = null;
        statusMessage = "White's turn";
        isAIThinking = false;
    }

    // Watch for player moves and respond with AI moves
    $effect(() => {
        if (currentPlayer === "black" && !isAIThinking && (gameStatus === "active" || gameStatus === "check")) {
            makeAIMove();
        }
    });

    $effect(() => {
        if (browser) {
            document.documentElement.setAttribute("data-theme", theme);
        }
    });

    updateGameStatus();
</script>

<div class="game">
    <div class="controls">
        <div class="control-group">
            <div class="difficulty-selector">
                <label
                    for="difficulty"
                    class="difficulty-title">AI Difficulty:</label
                >
                <select
                    id="difficulty"
                    value={difficulty}
                    onchange={(e) => handleDifficultyChange(e.target.value)}
                >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                </select>
            </div>
            <button
                class="reset-button"
                onclick={resetGame}
            >
                New Game
            </button>
        </div>
        <button
            class="theme-toggle"
            onclick={toggleTheme}
        >
            {#if theme === "light"}
                ☾ Dark Mode
            {:else}
                ☼ Light Mode
            {/if}
        </button>
    </div>

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

<style lang="scss">
    .game {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: $spacing-md;
        padding: $spacing-md;
        background-color: var(--bg-primary);
        min-height: 100vh;
    }

    .game-container {
        display: flex;
        gap: $spacing-lg;
        align-items: flex-start;
        position: relative;
    }

    .status {
        font-size: 1.2rem;
        font-weight: bold;
        margin-bottom: $spacing-md;
        color: var(--text-primary);
    }

    .ai-thinking {
        font-style: italic;
        color: var(--text-secondary);
        margin-bottom: $spacing-md;
        position: absolute;
        top: -1.5rem;
    }

    .board {
        width: $board-size;
        height: $board-size;
        border: 2px solid var(--border-color);
        border-radius: $border-radius;
        display: grid;
        grid-template-columns: repeat(8, 1fr);
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    }

    .square {
        display: flex;
        justify-content: center;
        align-items: center;
        font-size: 2em;
        cursor: pointer;
        transition: all 0.2s ease;
        aspect-ratio: 1 / 1;

        &.white {
            background-color: var(--bg-board-light);
        }

        &.black {
            background-color: var(--bg-board-dark);
        }

        &.selected {
            background-color: var(--highlight-selected);
        }

        &.valid-move {
            background-color: var(--highlight-move);
        }

        &.last-move {
            background-color: var(--highlight-last-move);
        }

        &:hover {
            filter: brightness(1.1);
        }
    }

    .promotion-dialog {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background-color: var(--bg-primary);
        border: 2px solid var(--border-color);
        border-radius: $border-radius;
        padding: $spacing-md;
        display: flex;
        gap: $spacing-md;
        z-index: $z-modal;
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
    }

    .promotion-piece {
        font-size: 2em;
        padding: $spacing-sm $spacing-md;
        cursor: pointer;
        border: 1px solid var(--border-color);
        border-radius: $border-radius;
        background: var(--bg-primary);
        transition: all 0.2s ease;

        &:hover {
            background-color: var(--button-hover);
        }
    }

    .move-history {
        min-width: 200px;
        max-height: $board-size;
        overflow-y: auto;
        border: 1px solid var(--border-color);
        border-radius: $border-radius;
        padding: $spacing-md;
        background-color: var(--bg-secondary);
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);

        h3 {
            margin-top: 0;
            margin-bottom: $spacing-sm;
            text-align: center;
            color: var(--text-primary);
        }
    }

    .moves {
        display: flex;
        flex-direction: column;
        gap: $spacing-sm;
    }

    .move {
        font-family: monospace;
        padding: $spacing-sm 0;
        color: var(--text-secondary);
    }

    .controls {
        display: flex;
        gap: $spacing-md;
        margin-bottom: $spacing-md;
        align-items: center;
        width: 100%;
        max-width: $board-size;
        justify-content: space-between;

        .control-group {
            display: flex;
            gap: $spacing-md;
            align-items: center;
        }

        button {
            text-wrap: nowrap;
        }
    }

    .difficulty-selector {
        display: flex;
        gap: $spacing-sm;
        align-items: center;

        select {
            padding: $spacing-sm;
            border-radius: $border-radius;
            border: 1px solid var(--border-color);
            background-color: var(--button-bg);
            color: var(--button-text);
            cursor: pointer;
            transition: all 0.2s ease;

            &:hover {
                background-color: var(--button-hover);
            }
        }

        .difficulty-title {
            text-wrap: nowrap;
        }
    }

    .reset-button,
    .theme-toggle {
        padding: $spacing-sm $spacing-md;
        border-radius: $border-radius;
        border: 1px solid var(--border-color);
        background-color: var(--button-bg);
        color: var(--button-text);
        cursor: pointer;
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        gap: $spacing-sm;
        font-weight: 500;

        &:hover {
            background-color: var(--button-hover);
        }
    }

    @media (max-width: $breakpoint-md) {
        .game-container {
            flex-direction: column;
            align-items: center;
        }

        .move-history {
            width: 100%;
            max-width: $board-size;
            max-height: 200px;
        }
    }
</style>
