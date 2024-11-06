export class ChessGameClient {
    constructor() {
        this.ws = null;
        this.gameId = null;
        this.callbacks = {
            onLobbyUpdate: null,
            onGameStart: null,
            onGameUpdate: null,
            onGameEnd: null,
            onError: null,
        };
    }

    connect(url) {
        return new Promise((resolve, reject) => {
            this.ws = new WebSocket(url);

            this.ws.onopen = () => {
                this.setupMessageHandler();
                resolve();
            };

            this.ws.onerror = (error) => {
                console.error("WebSocket connection error:", error);
                reject(error);
            };

            this.ws.onclose = () => {
                console.log("WebSocket connection closed");
            };
        });
    }

    setupMessageHandler() {
        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.handleMessage(data);
            } catch (error) {
                console.error("Error handling message:", error);
                if (this.callbacks.onError) {
                    this.callbacks.onError(error);
                }
            }
        };
    }

    handleMessage(data) {
        switch (data.type) {
            case "lobby_update":
                if (this.callbacks.onLobbyUpdate) {
                    this.callbacks.onLobbyUpdate(data.lobby, data.games);
                }
                break;

            case "game_started":
            case "game_joined":
                if (data.gameId) {
                    this.gameId = data.gameId;
                }
                if (this.callbacks.onGameStart) {
                    this.callbacks.onGameStart(data);
                }
                break;

            case "game_update":
                if (this.callbacks.onGameUpdate) {
                    this.callbacks.onGameUpdate(data.gameState);
                }
                break;

            case "game_ended":
                if (this.callbacks.onGameEnd) {
                    this.callbacks.onGameEnd(data.reason);
                }
                break;
        }
    }

    joinLobby(username) {
        this.send({
            type: "join_lobby",
            username,
        });
    }

    createGame() {
        this.send({
            type: "create_game",
        });
    }

    joinGame(gameId) {
        this.send({
            type: "join_game",
            gameId,
        });
    }

    makeMove(move) {
        this.send({
            type: "make_move",
            gameId: this.gameId,
            move: {
                fromRow: move.fromRow,
                fromCol: move.fromCol,
                toRow: move.toRow,
                toCol: move.toCol,
                newBoard: move.newBoard,
                piece: move.piece,
            },
        });
    }

    offerDraw() {
        this.send({
            type: "offer_draw",
            gameId: this.gameId,
        });
    }

    resign() {
        this.send({
            type: "resign",
            gameId: this.gameId,
        });
    }

    send(data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
        } else {
            console.error("WebSocket is not connected. ReadyState:", this.ws?.readyState);
        }
    }

    setCallbacks(callbacks) {
        this.callbacks = { ...this.callbacks, ...callbacks };
    }

    disconnect() {
        if (this.ws) {
            this.ws.close();
        }
    }
}
