<script>
    import { ChessEngine } from "./ChessEngine.js";
    import { ChessAI } from "./aiModule.js";
    import { ChessGameClient } from "../client/chessGameClient.js";
    import { storage } from "$lib/utils/storage";
    import { Modal, GameControls } from "$components";
    import { browser } from "$app/environment";
    import { onDestroy } from "svelte";

    let theme = $state(storage.get("chess-theme", "light"));

    let gameMode = $state(null); // 'ai' or 'multiplayer'
    let username = storage.get("chess-username", "");
    let lobbyPlayers = $state([]);
    let availableGames = $state([]);
    let gameClient = $state(null);
    let playerColor = $state(null);
    let playerPreferredColor = $state("white");
    let opponent = $state(null);
    let gameResult = $state(null);

    // AI mode states
    let engine = $state(new ChessEngine());
    let ai = $state(new ChessAI(engine));
    let difficulty = $state("medium");

    // Shared game states
    let currentPlayer = $state("white");
    let selectedPiece = $state(null);
    let moveHistory = $state([]);
    let reversedMoveHistory = $derived([...moveHistory].reverse());
    let gameStatus = $state("active");
    let promotionPending = $state(null);
    let statusMessage = $state("White's turn");
    let isAIThinking = $state(false);
    let drawOffer = $state(null); // { offeredBy: 'white' | 'black' }
    let drawOfferTimeout = $state(null);
    let showDrawOfferModal = $state(false);
    let showResignModal = $state(false);
    let lastMove = $state(null);
    let selectedHistoryMove = $state(null);
    let showMoveHighlight = $state(false);
    let ghostPiece = $state(null);
    let movingPiece = $state(null);
    let opponentDisconnected = $state(false);
    let disconnectionMessage = $state("");
    let lastCheck = $state(null);
    let capturedPieces = $state({
        byWhite: {},
        byBlack: {}
    });
    let materialAdvantage = $derived(calculateMaterialAdvantage());

    function toggleTheme() {
        theme = theme === "light" ? "dark" : "light";
        storage.set("chess-theme", theme);
    }

    function updateGameStatus() {
        if (promotionPending) {
            statusMessage = "Choose promotion piece";
            return;
        }

        if (gameStatus === "ended") {
            return;
        }

        const inCheck = engine.isInCheck(currentPlayer);
        if (inCheck) {
            statusMessage = `${currentPlayer === "white" ? "White" : "Black"} is in check!`;
            
            const [kingRow, kingCol] = engine.findKing(currentPlayer);
            lastCheck = { row: kingRow, col: kingCol };
        } else {
            statusMessage = `${currentPlayer === "white" ? "White" : "Black"}'s turn`;
            lastCheck = null;
        }
    }

    function calculateMaterialAdvantage() {
        const pieceValues = {
            '♙': 1, '♟': 1,  // pawns
            '♘': 3, '♞': 3,  // knights
            '♗': 3, '♝': 3,  // bishops
            '♖': 5, '♜': 5,  // rooks
            '♕': 9, '♛': 9   // queens
        };

        let whiteAdvantage = 0;
        
        // Add value of pieces white has captured
        for (const [piece, count] of Object.entries(capturedPieces.byWhite)) {
            whiteAdvantage += (pieceValues[piece] || 0) * count;
        }
        
        // Subtract value of pieces black has captured
        for (const [piece, count] of Object.entries(capturedPieces.byBlack)) {
            whiteAdvantage -= (pieceValues[piece] || 0) * count;
        }

        return whiteAdvantage;
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

    function checkGameState(newBoard) {
        const nextPlayer = currentPlayer === "white" ? "black" : "white";
        const tempEngine = new ChessEngine(newBoard);
        const newStatus = tempEngine.getGameStatus(nextPlayer);
        
        if (newStatus === "checkmate") {
            gameStatus = "ended";
            const winner = currentPlayer;
            gameResult = {
                winner,
                reason: `${winner === "white" ? "White" : "Black"} wins by checkmate!`
            };
            return "checkmate";
        } else if (newStatus === "stalemate") {
            gameStatus = "ended";
            gameResult = {
                winner: null,
                reason: "Game drawn by stalemate"
            };
            return "stalemate";
        } else if (newStatus === "check") {
            return "check";
        }
        return "active";
    }

    async function makeAIMove() {
    if (!promotionPending && (gameStatus === "active" || gameStatus === "check")) {
        isAIThinking = true;

        try {
            await new Promise((resolve) => setTimeout(resolve, 1000));
            const move = ai.getBestMove();

            if (move) {
                const piece = engine.board[move.fromRow][move.fromCol].piece;
                
                movingPiece = {
                    piece,
                    fromRow: move.fromRow,
                    fromCol: move.fromCol,
                    toRow: move.toRow,
                    toCol: move.toCol
                };

                await new Promise(resolve => setTimeout(resolve, 300));

                const result = engine.makeMove(move.fromRow, move.fromCol, move.toRow, move.toCol);
                movingPiece = null;
                lastMove = { 
                    fromRow: move.fromRow, 
                    fromCol: move.fromCol, 
                    toRow: move.toRow, 
                    toCol: move.toCol 
                };

                engine = new ChessEngine(result.board);
                updateMoveHistory(move.fromRow, move.fromCol, move.toRow, move.toCol);

                if (result.needsPromotion) {
                    const promotionPiece = currentPlayer === "white" ? "♕" : "♛";
                    handlePromotion(promotionPiece);
                } else {
                    finishMove();
                }

                ai = new ChessAI(engine, difficulty, playerColor === "white" ? "black" : "white");
            } else {
                gameStatus = engine.isInCheck(currentPlayer) ? "checkmate" : "stalemate";
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
            (gameStatus !== "active" && gameStatus !== "check") ||
            movingPiece
        )
            return;

        if (gameMode === "multiplayer" && currentPlayer !== playerColor) return;

        clearHistorySelection();

        const square = engine.board[row][col];

        if (selectedPiece) {
            const [selectedRow, selectedCol] = selectedPiece;

            if (engine.isValidMove(selectedRow, selectedCol, row, col, currentPlayer)) {
                try {
                    const piece = engine.board[selectedRow][selectedCol].piece;
                    const pieceColor = engine.board[selectedRow][selectedCol].color;
                    const targetSquare = engine.board[row][col];
                    
                    let capturedPiece = null;
                    
                    if (targetSquare.piece && targetSquare.color !== pieceColor) {
                        capturedPiece = targetSquare.piece;
                    }
                    
                    // En passant
                    if (!capturedPiece &&
                        engine.getPieceType(piece) === 'pawn' &&
                        Math.abs(selectedCol - col) === 1 &&
                        !targetSquare.piece) {
                        
                        const lastMove = engine.lastMove;
                        if (lastMove &&
                            engine.getPieceType(engine.board[lastMove.toRow][lastMove.toCol].piece) === 'pawn' &&
                            Math.abs(lastMove.fromRow - lastMove.toRow) === 2 &&
                            lastMove.toRow === selectedRow &&
                            lastMove.toCol === col) {
                            
                            capturedPiece = engine.board[lastMove.toRow][lastMove.toCol].piece;
                        }
                    }

                    movingPiece = {
                        piece,
                        fromRow: selectedRow,
                        fromCol: selectedCol,
                        toRow: row,
                        toCol: col
                    };

                    await new Promise(resolve => setTimeout(resolve, 300));
                    
                    const result = engine.makeMove(selectedRow, selectedCol, row, col);
                    movingPiece = null;
                    
                    lastMove = { 
                        fromRow: selectedRow, 
                        fromCol: selectedCol, 
                        toRow: row, 
                        toCol: col,
                        piece: piece
                    };
                    selectedHistoryMove = null;

                    if (gameMode === "multiplayer") {
                        const moveData = {
                            fromRow: selectedRow,
                            fromCol: selectedCol,
                            toRow: row,
                            toCol: col,
                            newBoard: result.board,
                            piece: piece,
                            capturedPiece,
                            capturedBy: currentPlayer
                        };

                        gameClient.makeMove(moveData);
                        selectedPiece = null;
                    } else {
                        // Local game logic for AI/local multiplayer
                        if (capturedPiece) {
                            if (currentPlayer === 'white') {
                                capturedPieces.byWhite[capturedPiece] = 
                                    (capturedPieces.byWhite[capturedPiece] || 0) + 1;
                            } else {
                                capturedPieces.byBlack[capturedPiece] = 
                                    (capturedPieces.byBlack[capturedPiece] || 0) + 1;
                            }
                        }

                        engine = new ChessEngine(result.board);
                        updateMoveHistory(selectedRow, selectedCol, row, col);

                        if (result.needsPromotion) {
                            promotionPending = result.promotionData;
                            updateGameStatus();
                        } else {
                            const newState = checkGameState(result.board);
                            if (newState === "active" || newState === "check") {
                                finishMove();
                                if (gameMode === "ai") {
                                    ai = new ChessAI(engine, difficulty, playerColor === "white" ? "black" : "white");
                                }
                            }
                        }
                    }
                } catch (error) {
                    console.error("Error making move:", error);
                    selectedPiece = null;
                    movingPiece = null;
                }
            } else {
                selectedPiece = null;
            }
        } else if (square.color === currentPlayer) {
            selectedPiece = [row, col];
        }
    }

    function handleHistoryMoveClick(move, index) {
        if (selectedHistoryMove?.moveNumber === reversedMoveHistory.length - index) {
            selectedHistoryMove = null;
            ghostPiece = null;
            return;
        }

        // Convert algebraic notation to board coordinates
        const files = "abcdefgh";
        const fromCol = files.indexOf(move.from[0]);
        const fromRow = 8 - parseInt(move.from[1]);
        const toCol = files.indexOf(move.to[0]);
        const toRow = 8 - parseInt(move.to[1]);

        selectedHistoryMove = {
            fromRow,
            fromCol,
            toRow,
            toCol,
            piece: move.piece,
            moveNumber: reversedMoveHistory.length - index
        };

        ghostPiece = {
            piece: move.piece,
            fromRow,
            fromCol,
            toRow,
            toCol
        };
    }

    function clearHistorySelection() {
        selectedHistoryMove = null;
        ghostPiece = null;
    }

    function handleDrawOffered(offeredBy) {
        drawOffer = { offeredBy };
        showDrawOfferModal = true;

        if (drawOfferTimeout) {
            clearInterval(drawOfferTimeout);
        }

        let timeLeft = 30;
        drawOfferTimeout = setInterval(() => {
            timeLeft--;
            if (timeLeft <= 0) {
                clearInterval(drawOfferTimeout);
                drawOfferTimeout = null;
                drawOffer = null;
                showDrawOfferModal = false;
            }
        }, 1000);
    }

    function handleDrawCancelled() {
        if (drawOfferTimeout) {
            clearInterval(drawOfferTimeout);
            drawOfferTimeout = null;
        }
        drawOffer = null;
        showDrawOfferModal = false;
    }

    function handleDrawResponse(accepted) {
        if (gameClient) {
            gameClient.respondToDraw(accepted);
            handleDrawCancelled();
        }
    }

    function handleResignClick() {
        showResignModal = true;
    }

    function confirmResign() {
        showResignModal = false;

        if (gameMode === "multiplayer" && gameClient) {
            gameClient.resign();
        } else if (gameMode === "ai") {
            const winner = "black";
            gameStatus = "ended";
            gameResult = {
                winner,
                reason: `White resigned. Black wins!`
            };
            statusMessage = gameResult.reason;
        }
    }

    function switchGameMode(mode) {
        gameMode = mode;
        if (mode === "ai") {
            startGame();
        } else if (mode === "local") {
            startLocalGame();
        } else {
            resetGame();
        }
    }

    function isSquareSelected(row, col) {
        return selectedPiece && selectedPiece[0] === row && selectedPiece[1] === col;
    }

    function isValidMoveTarget(row, col) {
        return selectedPiece && engine.isValidMove(selectedPiece[0], selectedPiece[1], row, col, currentPlayer);
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
        currentPlayer = "white";
        selectedPiece = null;
        moveHistory = [];
        gameStatus = "active";
        promotionPending = null;
        statusMessage = "White's turn";
        gameResult = null;
        capturedPieces = {
            byWhite: {},
            byBlack: {}
        };
        clearHistorySelection();

        if (gameMode === "ai") {
            isAIThinking = false;
            ai = new ChessAI(engine, difficulty);
        }
    }

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
        
        if (gameState.captures) {
            capturedPieces = {
                byWhite: { ...gameState.captures.byWhite },
                byBlack: { ...gameState.captures.byBlack }
            };
        }

        if (gameState.moveHistory) {
            moveHistory = gameState.moveHistory.map((move) => ({
                ...move,
                from: move.from?.row !== undefined
                    ? `${String.fromCharCode(97 + move.from.col)}${8 - move.from.row}`
                    : move.from,
                to: move.to?.row !== undefined
                    ? `${String.fromCharCode(97 + move.to.col)}${8 - move.to.row}`
                    : move.to,
                player: move.player || (currentPlayer === "white" ? "black" : "white"),
            }));
        }

        selectedPiece = null;
        updateGameStatus();
    }

    function handleGameEnd(reason) {
        gameStatus = "ended";
        statusMessage = reason;
        clearHistorySelection();
        
        if (reason.includes("resigned")) {
            const winner = reason.includes("white wins") ? "white" : "black";
            gameResult = { 
                winner,
                reason
            };
        }
        
        if (gameMode === "multiplayer") {
            opponent = null;
            playerColor = null;
        } else if (gameMode === "ai") {
            isAIThinking = false;
        }
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
                    onDrawOffered: handleDrawOffered,
                    onDrawCancelled: handleDrawCancelled,
                    onOpponentDisconnected: (message) => {
                        opponentDisconnected = true;
                        disconnectionMessage = message;
                        statusMessage = message;
                    },
                    onOpponentReconnected: (gameState) => {
                        opponentDisconnected = false;
                        disconnectionMessage = "";
                        statusMessage = `${currentPlayer}'s turn`;
                        engine = new ChessEngine(gameState.board);
                        currentPlayer = gameState.currentPlayer;
                        if (gameState.moveHistory) {
                            moveHistory = gameState.moveHistory;
                        }
                    },
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
            gameClient.send({
                type: "create_game",
                preferredColor: playerPreferredColor
            });
        }
    }

    function joinGame(gameId) {
        if (gameClient) {
            gameClient.joinGame(gameId);
        }
    }

    function deleteGame(gameId) {
        if (gameClient) {
            gameClient.deleteGame(gameId);
        }
    }

    function startGame() {
        engine = new ChessEngine();
        currentPlayer = "white";
        selectedPiece = null;
        moveHistory = [];
        gameStatus = "active";
        promotionPending = null;
        statusMessage = "White's turn";
        gameResult = null;
        
        playerColor = playerPreferredColor;
        isAIThinking = false;
        ai = new ChessAI(engine, difficulty, playerColor === "white" ? "black" : "white");
        
        if (playerPreferredColor === "black") {
            makeAIMove();
        }
    }

    function startLocalGame() {
        engine = new ChessEngine();
        currentPlayer = "white";
        selectedPiece = null;
        moveHistory = [];
        gameStatus = "active";
        promotionPending = null;
        statusMessage = "White's turn";
        gameResult = null;
        playerColor = "white";
    }

    // Watch for player moves and respond with AI moves
    $effect(() => {
        if (
            gameMode === "ai" &&
            currentPlayer !== playerPreferredColor &&
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

    let showGameResultModal = $state(false);
    $effect(() => {
        if (gameStatus === "ended" && gameResult) {
            showGameResultModal = true;
        }
    })

    let isMobile = $state(false);
    $effect(() => {
        if (typeof window !== "undefined") {
            const checkMobile = () => {
                isMobile = window.innerWidth < 768;
            };

            checkMobile();
            window.addEventListener("resize", checkMobile);

            return () => window.removeEventListener("resize", checkMobile);
        }
    });

    onDestroy(() => {
        if (gameClient) {
            gameClient.disconnect();
        }
        if (drawOfferTimeout) {
            clearInterval(drawOfferTimeout);
        }
    });

    updateGameStatus();
</script>

{#snippet drawOfferModalContent()}
<div class="draw-offer-modal-content">
    {#if drawOffer && ((drawOffer.offeredBy === "white" && playerColor === "black") || 
                      (drawOffer.offeredBy === "black" && playerColor === "white"))}
        <p>Your opponent has offered a draw. Do you accept?</p>
        <div class="modal-buttons">
            <button
                class="ui-button decline-draw"
                onclick={() => {
                    handleDrawResponse(false);
                    showDrawOfferModal = false;
                }}
            >
                Decline
            </button>
            <button
                class="ui-button accept-draw"
                onclick={() => {
                    handleDrawResponse(true);
                    showDrawOfferModal = false;
                }}
            >
                Accept Draw
            </button>
        </div>
    {:else}
        <p>Are you sure you want to offer a draw to your opponent?</p>
        <div class="modal-buttons">
            <button
                class="ui-button cancel-draw"
                onclick={() => showDrawOfferModal = false}
            >
                Cancel
            </button>
            <button
                class="ui-button confirm-draw"
                onclick={() => {
                    gameClient.offerDraw();
                    showDrawOfferModal = false;
                }}
            >
                Yes, Offer Draw
            </button>
        </div>
    {/if}
</div>
{/snippet}

<Modal
    bind:showModal={showDrawOfferModal}
    title={drawOffer ? "Draw Offered" : "Offer Draw"}
    content={drawOfferModalContent}
>
</Modal>

{#snippet resignModalContent()}
<div class="resign-modal-content">
    <p>Are you sure you want to resign this game? This action cannot be undone.</p>
    <div class="modal-buttons">
        <button
            class="ui-button cancel-resign"
            onclick={() => (showResignModal = false)}
            >
            Cancel
        </button>
        <button
            class="ui-button confirm-resign"
            onclick={confirmResign}
        >
            Yes, Resign
        </button>
    </div>
</div>
{/snippet}

<Modal
    bind:showModal={showResignModal}
    title="Confirm Resignation"
    content={resignModalContent}
>
</Modal>

{#snippet gameResultModalContent()}
<div class="game-end-modal-content">
    <p>{gameResult.reason}</p>
    <div class="modal-buttons">
        <button 
            class="ui-button new-game"
            onclick={() => {
                gameStatus = "active";
                gameResult = null;
                resetGame();
            }}
        >
            New Game
        </button>
        <button 
            class="ui-button return-lobby"
            onclick={() => {
                gameMode = null;
                gameStatus = "active";
                gameResult = null;
                opponent = null;
                playerColor = null;
                resetGame();
            }}
        >
            Return to Lobby
        </button>
    </div>
</div>
{/snippet}

{#if gameStatus === "ended" && gameResult}
    <Modal 
        bind:showModal={showGameResultModal}
        title="Game Over"
        content={gameResultModalContent}
    >
    </Modal>
{/if}

{#snippet themeButton(elementClass)}
    <button
        class={elementClass}
        onclick={toggleTheme}
    >
        {#if theme === "light"}
            ☾ Dark Mode
        {:else}
            ☼ Light Mode
        {/if}
    </button>
{/snippet}

{#snippet backButton(elementClass)}
    {#if gameMode}
        <button
            class={elementClass}
            onclick={() => (gameMode = null)}
        >
            Back
        </button>
    {/if}
{/snippet}

<div class="game">
    {#if !isMobile}
        {@render themeButton("ui-button theme-toggle")}
        {@render backButton("ui-button back-button")}
    {/if}
    {#if !gameMode}
    <div class="mode-select">
        <h2>Select Game Mode</h2>
        <div class="game-options">
            <div class="color-preference">
                <label for="color-select" class="color-label">Preferred Color:</label>
                <select 
                    id="color-select"
                    bind:value={playerPreferredColor}
                >
                    <option value="white">White</option>
                    <option value="black">Black</option>
                </select>
            </div>
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
                    Online Multiplayer
                </button>
                <button
                    class="ui-button mode-button"
                    class:selected={gameMode === "local"}
                    onclick={() => switchGameMode("local")}
                >
                    Local Multiplayer
                </button>
            </div>
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
                        disabled={availableGames.some(game => 
                            game.white?.username === username || game.black?.username === username
                        )}
                    >
                        Create New Game
                    </button>
                    <ul>
                        {#each availableGames as game}
                            {#if game.status === "waiting"}
                                <li class="player-item">
                                    {game.white} vs {game.black}
                                    {#if game.white !== username && game.black !== username}
                                        <button
                                            class="ui-button join-game"
                                            onclick={() => joinGame(game.gameId)}
                                        >
                                            Join
                                        </button>
                                    {:else}
                                        <div class="game-actions">
                                            <span class="inline-badge your-game">Your game</span>
                                            <button
                                                class="ui-button delete-game"
                                                onclick={() => deleteGame(game.gameId)}
                                            >
                                                x
                                            </button>
                                        </div>
                                    {/if}
                                </li>
                            {/if}
                        {/each}
                    </ul>
                </div>
            </div>
        </div>
    {:else}
        <GameControls
            {isMobile}
            {gameMode}
            {playerColor}
            {opponent}
            {difficulty}
            {showMoveHighlight}
            {drawOffer}
            {themeButton}
            {backButton}
            onDifficultyChange={handleDifficultyChange}
            onNewGame={resetGame}
            onResign={handleResignClick}
            onDrawOffer={() => showDrawOfferModal = true}
            onToggleMoveHighlight={() => showMoveHighlight = !showMoveHighlight}
        />

        <div class="status">{statusMessage}</div>
        {#if opponentDisconnected}
            <div class="disconnection-banner">
                {disconnectionMessage}
            </div>
        {/if}

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
            <div class="board-and-pieces">
                <div class="captured-bar {playerColor === 'white' ? 'black' : 'white'}">
                    {#each Object.entries(playerColor === 'white' ? capturedPieces.byBlack : capturedPieces.byWhite) as [piece, count]}
                        <div class="captured-piece">
                            <span class="piece">{piece}</span>
                            {#if count > 1}
                                <span class="count">{count}</span>
                            {/if}
                        </div>
                    {/each}
                    {#if materialAdvantage * (playerColor === 'white' ? -1 : 1) > 0}
                        <span class="material-advantage">+{Math.abs(materialAdvantage)}</span>
                    {/if}
                </div>
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <div class="board-container" onclick={(e) => {
                if (e.target.classList.contains('board-container')) {
                    clearHistorySelection();
                }
            }}
            tabindex="0"
            role="button"
            >
                <div class="rank-markers">
                    {#each Array(8) as _, index}
                        <div class="rank-marker">
                            {playerColor === "white" ? 8 - index : index + 1}
                        </div>
                    {/each}
                </div>
            
                <div class="board-and-files">
                    <div class="board">
                        {#each engine.board as row, rowIndex}
                            {#each row as square, colIndex}
                                {@const displayRowIndex = playerColor === "white" ? rowIndex : 7 - rowIndex}
                                {@const displayColIndex = playerColor === "white" ? colIndex : 7 - colIndex}
                                {@const isSelected = isSquareSelected(rowIndex, colIndex)}
                                {@const isValidTarget = isValidMoveTarget(rowIndex, colIndex)}
                                {@const isLastMove = showMoveHighlight && lastMove && 
                                    ((lastMove.fromRow === rowIndex && lastMove.fromCol === colIndex) ||
                                    (lastMove.toRow === rowIndex && lastMove.toCol === colIndex))}
                                {@const isHistoryMove = selectedHistoryMove && 
                                    ((selectedHistoryMove.fromRow === rowIndex && selectedHistoryMove.fromCol === colIndex) ||
                                    (selectedHistoryMove.toRow === rowIndex && selectedHistoryMove.toCol === colIndex))}
                                {@const isInCheck = lastCheck && lastCheck.row === rowIndex && lastCheck.col === colIndex}
                                <div
                                    class="square {getSquareColor(displayRowIndex, displayColIndex)}"
                                    class:selected={isSelected}
                                    class:valid-move={isValidTarget}
                                    class:last-move={isLastMove}
                                    class:history-move={isHistoryMove}
                                    class:in-check={isInCheck}
                                    onclick={() => handleSquareClick(rowIndex, colIndex)}
                                    onkeypress={(e) => {
                                        if (e.key === "Enter") handleSquareClick(rowIndex, colIndex);
                                    }}
                                    tabindex="0"
                                    role="button"
                                    style="grid-row: {displayRowIndex + 1}; grid-column: {displayColIndex + 1}"
                                >
                                    {#if !(movingPiece && rowIndex === movingPiece.fromRow && colIndex === movingPiece.fromCol)}
                                        {square.piece}
                                    {/if}
                                </div>
                            {/each}
                        {/each}
                        
                        {#if movingPiece}
                            {@const displayFromRow = playerColor === "white" ? movingPiece.fromRow : 7 - movingPiece.fromRow}
                            {@const displayFromCol = playerColor === "white" ? movingPiece.fromCol : 7 - movingPiece.fromCol}
                            {@const displayToRow = playerColor === "white" ? movingPiece.toRow : 7 - movingPiece.toRow}
                            {@const displayToCol = playerColor === "white" ? movingPiece.toCol : 7 - movingPiece.toCol}
                            <div 
                                class="moving-piece"
                                style="--start-row: {displayFromRow}; --start-col: {displayFromCol}; 
                                    --end-row: {displayToRow}; --end-col: {displayToCol};"
                            >
                                {movingPiece.piece}
                            </div>
                        {/if}

                        {#if ghostPiece}
                            {@const displayFromRow = playerColor === "white" ? ghostPiece.fromRow : 7 - ghostPiece.fromRow}
                            {@const displayFromCol = playerColor === "white" ? ghostPiece.fromCol : 7 - ghostPiece.fromCol}
                            <div 
                                class="ghost-piece"
                                style="--row: {displayFromRow}; --col: {displayFromCol}"
                            >
                                {ghostPiece.piece}
                            </div>
                        {/if}
                    </div>
            
                    <div class="file-markers">
                        {#each Array(8) as _, index}
                            <div class="file-marker">
                                {String.fromCharCode(97 + (playerColor === "white" ? index : 7 - index)).toUpperCase()}
                            </div>
                        {/each}
                    </div>
                </div>
            </div>
            <div class="captured-bar {playerColor === 'white' ? 'white' : 'black'}">
                {#each Object.entries(playerColor === 'white' ? capturedPieces.byWhite : capturedPieces.byBlack) as [piece, count]}
                    <div class="captured-piece">
                        <span class="piece">{piece}</span>
                        {#if count > 1}
                            <span class="count">{count}</span>
                        {/if}
                    </div>
                {/each}
                {#if materialAdvantage * (playerColor === 'white' ? 1 : -1) > 0}
                    <span class="material-advantage">+{Math.abs(materialAdvantage)}</span>
                {/if}
            </div>
        </div>

            <div class="move-history">
                <h3>Move History</h3>
                <div class="moves">
                    {#each reversedMoveHistory as move, i}
                        <div 
                            class="move"
                            class:selected={selectedHistoryMove?.moveNumber === reversedMoveHistory.length - i}
                            onclick={() => handleHistoryMoveClick(move, i)}
                            onkeypress={(e) => {
                                if (e.key === "Enter") handleHistoryMoveClick(move, i);
                            }}
                            tabindex="0"
                            role="button"
                        >
                            {reversedMoveHistory.length - i}. {move.player === "white" ? "White" : "Black"}:
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
    @import "../styles/_mixins.scss";

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
        color: var(--text-primary);
        align-self: flex-start;
        padding: 2px 6px;
        border-radius: $border-radius;
        font-size: 0.8em;

        &.available {
            background: var(--success);
            color: white;
        }

        &.playing {
            background: var(--error);
            color: white;
        }
    }

    .ai-thinking {
        font-style: italic;
        color: var(--text-secondary);
        margin-bottom: $spacing-md;
        position: absolute;
        top: -1.5rem;
    }

    .board-container {
        display: flex;
        gap: 4px;
        transition: transform 0.3s ease;
        width: 100%;
        max-width: $board-size;
    }

    .board-and-files {
        display: flex;
        flex-direction: column;
        gap: 4px;
        flex-grow: 1;
    }

    .rank-markers {
        display: flex;
        flex-direction: column;
        justify-content: space-around;
        padding: 2px 8px;
        font-size: clamp(0.7em, 2vw, 0.9em);
    }

    .file-markers {
        display: flex;
        justify-content: space-around;
        padding: 4px 0;
        font-size: clamp(0.7em, 2vw, 0.9em);
    }

    .rank-marker, .file-marker {
        color: var(--text-secondary);
        font-family: monospace;
        text-align: center;
        user-select: none;
    }

    .board {
        display: grid;
        grid-template-columns: repeat(8, 1fr);
        grid-template-rows: repeat(8, 1fr);
        width: 100%;
        aspect-ratio: 1 / 1;
        border: 2px solid var(--border-color);
        border-radius: $border-radius;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        position: relative;
        transition: transform 0.3s ease;
    }

    .square {
        display: flex;
        justify-content: center;
        align-items: center;
        font-size: clamp(1.5em, 4vw, 2em);
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

        &.move-from {
            background-color: var(--highlight-from);
        }

        &.move-to {
            background-color: var(--highlight-to);
        }

        &.last-move {
            background-color: var(--highlight-last-move);
        }

        &.history-move {
            background-color: var(--highlight-history);
        }

        &.in-check {
            background-color: var(--check-highlight) !important;
            animation: pulse 1s infinite;
        }
    }

    .ghost-piece {
        position: absolute;
        font-size: 2em;
        display: flex;
        justify-content: center;
        align-items: center;
        width: calc(100% / 8);
        height: calc(100% / 8);
        opacity: 0.5;
        pointer-events: none;
        transform: translate(
            calc(var(--col) * 100%),
            calc(var(--row) * 100%)
        );
        transition: transform 0.3s ease;
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

    .board-and-pieces {
        display: flex;
        flex-direction: column;
        gap: 8px;
        align-items: center;
        width: 100%;
        max-width: $board-size;
    }

    .captured-bar {
        display: flex;
        width: 100%;
        min-height: 40px;
        padding: 4px 8px;
        gap: 8px;
        background: var(--bg-secondary);
        border: 1px solid var(--border-color);
        border-radius: $border-radius;

        .captured-piece {
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;

            .piece {
                font-size: clamp(1.2em, 3vw, 1.5em);
                transition: transform 0.2s ease;
                cursor: default;

                &:hover {
                    transform: scale(1.2);
                }
            }

            .count {
                position: absolute;
                bottom: -4px;
                right: -4px;
                background: var(--bg-primary);
                border-radius: 50%;
                width: 16px;
                height: 16px;
                font-size: 0.7em;
                display: flex;
                align-items: center;
                justify-content: center;
                border: 1px solid var(--border-color);
            }
        }

        &.white .piece {
            color: var(--piece-black);
        }

        &.black .piece {
            color: var(--piece-white);
        }

        .material-advantage {
            margin-left: auto;
            padding: 2px 8px;
            background: var(--bg-primary);
            border-radius: $border-radius;
            font-weight: 500;
            font-size: 0.9em;
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
        cursor: pointer;
        padding: $spacing-sm $spacing-md;
        border-radius: $border-radius;
        transition: all 0.2s ease;
        border: 2px solid transparent;

        &:hover {
            background-color: var(--bg-hover);
        }

        &.selected {
            background-color: var(--highlight-selected);
            color: var(--text-primary);
            border-color: var(--primary);
        }
    }

    .mode-buttons {
        display: flex;
        gap: $spacing-md;
    }

    .color-preference {
        margin-bottom: $spacing-sm;
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

    .game-actions {
        display: flex;
        align-items: center;
        gap: $spacing-sm;
    }

    .delete-game {
        padding: $spacing-sm;
        font-size: 0.9em;
        border: none;
        background-color: transparent;

        &:hover {
            filter: brightness(0.9);
        }
    }

    .create-game {
        width: 100%;
        margin-bottom: $spacing-md;
        &:disabled {
            opacity: 0.5;
            cursor: not-allowed;
            
            &:hover {
                background-color: var(--button-bg);
            }
        }
    }

    .your-game {
        font-style: italic;
        color: var(--text-secondary);
        font-size: 0.9em;
    }

    .draw-offer {
        display: flex;
        align-items: center;
        gap: $spacing-sm;
    }

    .accept-draw {
        background-color: var(--success);
        color: white;
        transition: filter 0.2s ease;

        &:hover {
            filter: brightness(0.9);
        }
    }

    .decline-draw {
        background-color: var(--error);
        color: white;
        transition: filter 0.2s ease;

        &:hover {
            filter: brightness(0.9);
        }
    }

    .resign-modal-content {
        p {
            color: var(--text-secondary);
        }
    }

    .modal-buttons {
        display: flex;
        gap: $spacing-md;
        justify-content: flex-end;
        margin-top: $spacing-md;
    }

    .confirm-resign {
        background-color: var(--error);
        color: white;

        &:hover {
            filter: brightness(0.9);
        }
    }

    .cancel-resign {
        background-color: var(--bg-secondary);

        &:hover {
            filter: brightness(0.9);
        }
    }

    .moving-piece {
        position: absolute;
        font-size: 2em;
        display: flex;
        justify-content: center;
        align-items: center;
        width: calc(100% / 8);
        height: calc(100% / 8);
        pointer-events: none;
        z-index: 10;
        animation: movePiece 300ms cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
    }

    .disconnection-banner {
        background-color: var(--warning);
        color: white;
        padding: $spacing-sm $spacing-md;
        border-radius: $border-radius;
        text-align: center;
        margin-bottom: $spacing-md;
    }

    .draw-offer-modal-content {
        p {
            color: var(--text-secondary);
            margin-bottom: $spacing-md;
        }

        .modal-buttons {
            display: flex;
            gap: $spacing-md;
            justify-content: flex-end;
        }

        .accept-draw {
            background-color: var(--success);
            color: white;

            &:hover {
                filter: brightness(0.9);
            }
        }

        .decline-draw, .cancel-draw {
            background-color: var(--error);

            &:hover {
                filter: brightness(0.9);
            }
        }

        .confirm-draw {
            background-color: var(--success);
            color: white;

            &:hover {
                filter: brightness(0.9);
            }
        }
    }

    @keyframes movePiece {
        0% {
            transform: translate(
                calc(var(--start-col) * 100%),
                calc(var(--start-row) * 100%)
            );
        }
        100% {
            transform: translate(
                calc(var(--end-col) * 100%),
                calc(var(--end-row) * 100%)
            );
        }
    }

    @keyframes pulse {
        0% {
            box-shadow: 0 0 0 0 var(--check-highlight-glow);
        }
        70% {
            box-shadow: 0 0 0 10px rgba(255, 0, 0, 0);
        }
        100% {
            box-shadow: 0 0 0 0 rgba(255, 0, 0, 0);
        }
    }

    .toggle-last-move {
        background-color: var(--bg-secondary);
        
        &:hover {
            filter: brightness(0.9);
        }
    }

    .game-container {
        @media (max-width: $breakpoint-md) {
            flex-direction: column;
            align-items: center;
            
            .move-history {
                width: 100%;
                max-width: $board-size;
                max-height: 200px;
            }
        }
    }

    .captured-bar {
        @media (max-width: $breakpoint-md) {
            width: 100%;
        }
    }

    @media (max-width: $breakpoint-md) {
        .game-container {
            flex-direction: column;
            align-items: center;
            padding: $spacing-sm;
            width: 100%;
        }

        .board-container {
            max-width: min(100%, calc(100vh - 300px));
        }

        .move-history {
            width: 100%;
            max-width: min(100%, calc(100vh - 300px));
            max-height: 200px;
        }

        .board-and-pieces {
            max-width: min(100%, calc(100vh - 300px));
        }

        .ghost-piece, .moving-piece {
            font-size: clamp(1.5em, 4vw, 2em);
        }
    }
</style>
