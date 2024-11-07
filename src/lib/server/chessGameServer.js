// server/chessGameServer.js
import { WebSocketServer } from "ws";
import { nanoid } from "nanoid";

class ChessGameServer {
    constructor(server) {
        this.wss = new WebSocketServer({ server });
        this.games = new Map(); // gameId -> { white, black, spectators, gameState }
        this.lobby = new Map(); // userId -> { username, ws, status }

        this.setupWebSocketServer();
    }

    setupWebSocketServer() {
        this.wss.on("connection", (ws) => {
            const userId = nanoid();

            ws.on("message", (message) => {
                try {
                    const data = JSON.parse(message);
                    this.handleMessage(userId, ws, data);
                } catch (error) {
                    console.error("Error handling message:", error);
                }
            });

            ws.on("close", () => {
                this.handleDisconnect(userId);
            });
        });
    }

    handleMessage(userId, ws, data) {
        switch (data.type) {
            case "join_lobby":
                this.handleJoinLobby(userId, ws, data.username);
                break;
            case "create_game":
                this.handleCreateGame(userId);
                break;
            case "join_game":
                this.handleJoinGame(userId, data.gameId);
                break;
            case "spectate_game":
                this.handleSpectateGame(userId, data.gameId);
                break;
            case "make_move":
                this.handleMove(userId, data.gameId, data.move);
                break;
            case "offer_draw":
                this.handleDrawOffer(userId, data.gameId);
                break;
            case "resign":
                this.handleResign(userId, data.gameId);
                break;
        }
    }

    handleJoinLobby(userId, ws, username) {
        this.lobby.set(userId, {
            username,
            ws,
            status: "available",
        });

        // Send current lobby state to all users
        this.broadcastLobbyState();
    }

    handleCreateGame(userId) {
        const gameId = nanoid();
        const player = this.lobby.get(userId);

        if (!player) return;

        this.games.set(gameId, {
            white: { userId, username: player.username },
            black: null,
            spectators: [],
            gameState: {
                board: null, // Initial board state
                currentPlayer: "white",
                moveHistory: [],
                status: "waiting",
            },
        });

        player.status = "playing";
        player.ws.send(
            JSON.stringify({
                type: "game_created",
                gameId,
                color: "white",
            })
        );

        this.broadcastLobbyState();
    }

    handleJoinGame(userId, gameId) {
        const game = this.games.get(gameId);
        const player = this.lobby.get(userId);

        if (!game || !player || game.black) return;

        game.black = { userId, username: player.username };
        game.gameState.status = "active";
        player.status = "playing";

        // Notify both players
        const whitePlayer = this.lobby.get(game.white.userId);
        if (whitePlayer) {
            whitePlayer.ws.send(
                JSON.stringify({
                    type: "game_started",
                    gameState: game.gameState,
                    opponent: player.username,
                })
            );
        }

        player.ws.send(
            JSON.stringify({
                type: "game_joined",
                gameId,
                gameState: game.gameState,
                color: "black",
                opponent: game.white.username,
            })
        );

        this.broadcastLobbyState();
    }

    handleMove(userId, gameId, move) {
        const game = this.games.get(gameId);
        if (!game) return;

        const isWhite = game.white.userId === userId;
        const isBlack = game.black.userId === userId;

        if (!isWhite && !isBlack) return;
        if (
            (isWhite && game.gameState.currentPlayer !== "white") ||
            (isBlack && game.gameState.currentPlayer !== "black")
        )
            return;

        // Update game state
        game.gameState.board = move.newBoard;
        game.gameState.currentPlayer = game.gameState.currentPlayer === "white" ? "black" : "white";
        game.gameState.moveHistory.push(move);

        // Broadcast move to all players and spectators
        this.broadcastGameState(gameId);
    }

    handleDisconnect(userId) {
        const player = this.lobby.get(userId);
        if (!player) return;

        // Handle active games
        for (const [gameId, game] of this.games.entries()) {
            if (game.white.userId === userId || game.black.userId === userId) {
                this.handleGameEnd(gameId, `${player.username} disconnected`);
            }
        }

        this.lobby.delete(userId);
        this.broadcastLobbyState();
    }

    handleGameEnd(gameId, reason) {
        const game = this.games.get(gameId);
        if (!game) return;

        // Notify players and spectators
        const message = JSON.stringify({
            type: "game_ended",
            reason,
        });

        const whitePlayer = this.lobby.get(game.white.userId);
        const blackPlayer = this.lobby.get(game.black.userId);

        if (whitePlayer) {
            whitePlayer.status = "available";
            whitePlayer.ws.send(message);
        }
        if (blackPlayer) {
            blackPlayer.status = "available";
            blackPlayer.ws.send(message);
        }

        game.spectators.forEach((spectatorId) => {
            const spectator = this.lobby.get(spectatorId);
            if (spectator) {
                spectator.ws.send(message);
            }
        });

        this.games.delete(gameId);
        this.broadcastLobbyState();
    }

    broadcastLobbyState() {
        const lobbyState = Array.from(this.lobby.entries()).map(([id, player]) => ({
            userId: id,
            username: player.username,
            status: player.status,
        }));

        const games = Array.from(this.games.entries()).map(([id, game]) => ({
            gameId: id,
            white: game.white.username,
            black: game.black?.username || "Waiting...",
            status: game.gameState.status,
        }));

        const message = JSON.stringify({
            type: "lobby_update",
            lobby: lobbyState,
            games,
        });

        for (const player of this.lobby.values()) {
            player.ws.send(message);
        }
    }

    broadcastGameState(gameId) {
        const game = this.games.get(gameId);
        if (!game) return;

        const message = JSON.stringify({
            type: "game_update",
            gameState: game.gameState,
        });

        const whitePlayer = this.lobby.get(game.white.userId);
        const blackPlayer = this.lobby.get(game.black.userId);

        if (whitePlayer) whitePlayer.ws.send(message);
        if (blackPlayer) blackPlayer.ws.send(message);

        game.spectators.forEach((spectatorId) => {
            const spectator = this.lobby.get(spectatorId);
            if (spectator) spectator.ws.send(message);
        });
    }
}

export default ChessGameServer;
