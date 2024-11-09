<script>
    import { ChessEngine } from "./ChessEngine.js";
    import { ChessAI } from "./aiModule.js";
    import { ChessGameClient } from "../client/chessGameClient.js";
    import { storage } from "$lib/utils/storage";
    import { browser } from "$app/environment";
    import { onDestroy } from "svelte";
    import { backIn } from "svelte/easing";

    let theme = $state(storage.get("chess-theme", "light"));

    let gameMode = $state(null); // 'ai' or 'multiplayer'
    let username = storage.get("chess-username", "");
    let lobbyPlayers = $state([]);
    let availableGames = $state([]);
    let gameClient = $state(null);
    let playerColor = $state(null);
    let opponent = $state(null);

    // AI mode states
    let engine = $state(new ChessEngine());
    let ai = $state(new ChessAI(engine));
    let difficulty = $state("medium");

    // Shared game states
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
                player: currentPlayer,
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
                await new Promise((resolve) => setTimeout(resolve, 1000));
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

    async function handleSquareClick(row, col) {
        if (
            promotionPending ||
            (gameMode === "ai" && isAIThinking) ||
            (gameStatus !== "active" && gameStatus !== "check")
        )
            return;

        if (gameMode === "multiplayer" && currentPlayer !== playerColor) return;

        const square = engine.board[row][col];

        if (selectedPiece) {
            const [selectedRow, selectedCol] = selectedPiece;

            if (engine.isValidMove(selectedRow, selectedCol, row, col, currentPlayer)) {
                try {
                    const movingPiece = engine.board[selectedRow][selectedCol].piece;
                    const result = engine.makeMove(selectedRow, selectedCol, row, col);

                    if (gameMode === "multiplayer") {
                        gameClient.makeMove({
                            fromRow: selectedRow,
                            fromCol: selectedCol,
                            toRow: row,
                            toCol: col,
                            newBoard: result.board,
                            piece: movingPiece,
                        });

                        selectedPiece = null;
                    } else {
                        engine = new ChessEngine(result.board);
                        updateMoveHistory(selectedRow, selectedCol, row, col);

                        if (result.needsPromotion) {
                            promotionPending = result.promotionData;
                            updateGameStatus();
                        } else {
                            finishMove();
                            if (gameMode === "ai") {
                                ai = new ChessAI(engine, difficulty);
                            }
                        }
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

    function switchGameMode(mode) {
        gameMode = mode;
        resetGame();
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

    // WebSockets functions
    function handleLobbyUpdate(players, games) {
        lobbyPlayers = players;
        availableGames = games;
    }

    function handleGameStart(data) {
        engine = new ChessEngine(data.gameState.board);
        playerColor = data.color;
        opponent = data.opponent;
        gameStatus = data.gameState.status || "active";
        currentPlayer = data.gameState.currentPlayer || "white";
        moveHistory = data.gameState.moveHistory || [];

        if (data.gameId) {
            gameClient.gameId = data.gameId;
        }
        updateGameStatus();
    }

    function handleGameUpdate(gameState) {
        engine = new ChessEngine(gameState.board);
        currentPlayer = gameState.currentPlayer;

        if (gameState.moveHistory) {
            moveHistory = gameState.moveHistory.map((move) => ({
                ...move,
                from:
                    move.from?.row !== undefined
                        ? `${String.fromCharCode(97 + move.from.col)}${8 - move.from.row}`
                        : move.from,
                to: move.to?.row !== undefined ? `${String.fromCharCode(97 + move.to.col)}${8 - move.to.row}` : move.to,
                player: move.player || (currentPlayer === "white" ? "black" : "white"),
            }));
        }

        selectedPiece = null;
        updateGameStatus();
    }

    function handleGameEnd(reason) {
        gameStatus = "ended";
        statusMessage = reason;
    }

    async function joinLobby() {
        if (username.trim() === "") return;

        storage.set("chess-username", username);

        if (!gameClient) {
            gameClient = new ChessGameClient();

            try {
                const wsUrl = import.meta.env.PROD
                    ? `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}`
                    : "ws://localhost:3000/chess";
                await gameClient.connect(wsUrl);

                gameClient.setCallbacks({
                    onLobbyUpdate: (players, games) => {
                        handleLobbyUpdate(players, games);
                    },
                    onGameStart: handleGameStart,
                    onGameUpdate: handleGameUpdate,
                    onGameEnd: handleGameEnd,
                    onError: (error) => {
                        console.error("WebSocket error:", error);
                        statusMessage = "Connection error occurred";
                    },
                });

                gameClient.joinLobby(username);
            } catch (error) {
                console.error("Failed to connect to game server:", error);
                statusMessage = "Failed to connect to game server";
                gameClient = null;
            }
        }
    }

    function createGame() {
        if (gameClient) {
            gameClient.createGame();
        }
    }

    function joinGame(gameId) {
        if (gameClient) {
            gameClient.joinGame(gameId);
        }
    }

    // Watch for player moves and respond with AI moves
    $effect(() => {
        if (
            gameMode === "ai" &&
            currentPlayer === "black" &&
            !isAIThinking &&
            (gameStatus === "active" || gameStatus === "check")
        ) {
            makeAIMove();
        }
    });

    $effect(() => {
        if (browser) {
            document.documentElement.setAttribute("data-theme", theme);
        }
    });

    onDestroy(() => {
        if (gameClient) {
            gameClient.disconnect();
        }
    });

    updateGameStatus();
</script>

<div class="game">
    <button
        class="ui-button theme-toggle"
        onclick={toggleTheme}
    >
        {#if theme === "light"}
            ☾ Dark Mode
        {:else}
            ☼ Light Mode
        {/if}
    </button>
    {#if gameMode}
        <button
            class="ui-button back-button"
            onclick={() => (gameMode = null)}
        >
            Back
        </button>
    {/if}
    {#if !gameMode}
        <div class="mode-select">
            <h2>Select Game Mode</h2>
            <div class="mode-buttons">
                <button
                    class="ui-button mode-button"
                    class:selected={gameMode === "ai"}
                    onclick={() => switchGameMode("ai")}
                >
                    Play vs AI
                </button>
                <button
                    class="ui-button mode-button"
                    class:selected={gameMode === "multiplayer"}
                    onclick={() => switchGameMode("multiplayer")}
                >
                    Multiplayer
                </button>
            </div>
        </div>
    {:else if gameMode === "multiplayer" && !gameClient}
        <div class="mode-select">
            <h2>Enter Username</h2>
            <div class="username-input">
                <input
                    type="text"
                    bind:value={username}
                    placeholder="Enter your username"
                />
                <button
                    onclick={joinLobby}
                    class="ui-button join-lobby"
                >
                    Join Lobby
                </button>
            </div>
        </div>
    {:else if gameMode === "multiplayer" && !opponent}
        <div class="lobby">
            <h2>Chess Lobby</h2>
            <div class="lobby-container">
                <div class="players-list">
                    <h3>Players Online ({lobbyPlayers?.length || 0})</h3>
                    <ul>
                        {#each lobbyPlayers as player}
                            <li class="player-item">
                                {player.username}
                                <span class="status {player.status}">{player.status}</span>
                            </li>
                        {/each}
                    </ul>
                </div>

                <div class="games-list">
                    <h3>Available Games</h3>
                    <button
                        class="ui-button create-game"
                        onclick={createGame}
                    >
                        Create New Game
                    </button>
                    <ul>
                        {#each availableGames as game}
                            {#if game.status === "waiting"}
                                <li class="player-item">
                                    {game.white} vs {game.black}
                                    {#if game.white !== username}
                                        <button
                                            class="ui-button join-game"
                                            onclick={() => joinGame(game.gameId)}
                                        >
                                            Join
                                        </button>
                                    {:else}
                                        <span class="inline-badge your-game">Your game</span>
                                    {/if}
                                </li>
                            {/if}
                        {/each}
                    </ul>
                </div>
            </div>
        </div>
    {:else}
        <div class="controls">
            <div class="control-group">
                {#if gameMode === "ai"}
                    <div class="difficulty-selector">
                        <label
                            for="difficulty"
                            class="difficulty-title"
                        >
                            AI Difficulty:
                        </label>
                        <select
                            id="difficulty"
                            bind:value={difficulty}
                            onchange={(e) => handleDifficultyChange(e.target.value)}
                        >
                            <option value="easy">Easy</option>
                            <option value="medium">Medium</option>
                            <option value="hard">Hard</option>
                        </select>
                    </div>
                {:else}
                    <div class="game-info">
                        <p>Playing as: <span class="inline-badge">{playerColor}</span></p>
                        <p>Opponent: <span class="inline-badge">{opponent}</span></p>
                    </div>
                {/if}

                <button
                    class="ui-button new-game-button"
                    onclick={resetGame}
                >
                    New Game
                </button>

                {#if gameMode === "multiplayer"}
                    <button
                        class="ui-button resign-button"
                        onclick={() => gameClient.resign()}
                    >
                        Resign
                    </button>
                    <button
                        class="ui-button draw-button"
                        onclick={() => gameClient.offerDraw()}
                    >
                        Offer Draw
                    </button>
                {/if}
            </div>
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
                        <div class="move">
                            {i + 1}. {move.player === "white" ? "White" : "Black"}:
                            {move.piece || "♙"}
                            {move.from}-{move.to}
                        </div>
                    {/each}
                </div>
            </div>
        </div>
    {/if}
</div>

<style lang="scss">
    @mixin button-base {
        padding: $spacing-sm $spacing-md;
        border-radius: $border-radius;
        border: 1px solid var(--border-color);
        background-color: var(--button-bg);
        color: var(--button-text);
        cursor: pointer;
        transition: all 0.2s ease;
        font-weight: 500;

        &:hover {
            background-color: var(--button-hover);
        }
    }

    @mixin card-base {
        background-color: var(--bg-secondary);
        border: 1px solid var(--border-color);
        border-radius: $border-radius;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    .game {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: $spacing-md;
        padding: $spacing-md;
        background-color: var(--bg-primary);
        color: var(--text-primary);
        min-height: 100vh;
    }

    .game-info {
        display: flex;
        gap: $spacing-md;

        p {
            display: flex;
            align-items: center;
            gap: $spacing-sm;
            text-wrap: nowrap;
        }
    }

    .game-container {
        display: flex;
        gap: $spacing-lg;
        align-items: flex-start;
        position: relative;
        width: 100%;
    }

    .status {
        font-size: 1.2rem;
        font-weight: bold;
        margin-bottom: $spacing-md;
        color: var(--text-primary);
        align-self: flex-start;
        padding: 2px 6px;
        border-radius: $border-radius;
        font-size: 0.8em;
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

        .promotion-piece {
            @include button-base;
            font-size: 2em;
            padding: $spacing-md;
        }
    }

    .move-history {
        @include card-base;
        min-width: 200px;
        max-height: $board-size;
        overflow-y: auto;
        padding: $spacing-md;

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

    .mode-buttons {
        display: flex;
        gap: $spacing-md;
    }

    .username-input {
        display: flex;
        margin-top: 1rem;

        input {
            border-top-right-radius: 0;
            border-bottom-right-radius: 0;
        }

        button {
            border-top-left-radius: 0;
            border-bottom-left-radius: 0;
        }
    }

    .controls {
        display: flex;
        gap: $spacing-md;
        margin-bottom: $spacing-md;
        align-items: center;
        width: 100%;
        justify-content: space-between;

        .control-group {
            display: flex;
            gap: $spacing-md;
            align-items: center;
            width: 100%;
        }

        button {
            text-wrap: nowrap;
        }
    }

    .theme-toggle {
        @include button-base;
        position: absolute;
        top: $spacing-md;
        right: $spacing-md;
    }

    .back-button {
        @include button-base;
        position: absolute;
        top: $spacing-md;
        left: $spacing-md;
    }

    .difficulty-selector {
        display: flex;
        gap: $spacing-sm;
        align-items: center;

        select {
            @include button-base;
            padding: $spacing-sm;
        }

        .difficulty-title {
            text-wrap: nowrap;
        }
    }

    .lobby {
        width: 100%;
        max-width: 800px;
        margin: 0 auto;
        padding: $spacing-lg;

        h2 {
            text-align: center;
            margin-bottom: $spacing-lg;
        }
    }

    .lobby-container {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: $spacing-lg;
    }

    .players-list,
    .games-list {
        @include card-base;
        padding: $spacing-md;

        h3 {
            margin-top: 0;
            margin-bottom: $spacing-md;
        }

        ul {
            list-style: none;
            padding: 0;
            margin: 0;
        }
    }

    .player-item,
    .game-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: $spacing-sm;
        border-bottom: 1px solid var(--border-color);

        &:last-child {
            border-bottom: none;
        }
    }

    .status {
        &.available {
            background: var(--success);
            color: white;
        }

        &.playing {
            background: var(--error);
            color: white;
        }
    }

    .create-game {
        width: 100%;
        margin-bottom: $spacing-md;
    }

    .your-game {
        font-style: italic;
        color: var(--text-secondary);
        font-size: 0.9em;
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
