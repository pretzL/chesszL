# Chess Game

A modern, feature-rich chess game built with SvelteKit featuring multiple game modes, WebSocket-based multiplayer, and an AI opponent.

## Features

- **Multiple Game Modes**:
  - Play against AI with adjustable difficulty (Easy, Medium, Hard)
  - Online multiplayer with real-time gameplay
  - Local multiplayer with board rotation
  
- **Game Features**:
  - Color selection for AI and online games
  - Full chess rule implementation including special moves (castling, en passant, pawn promotion)
  - Move history with algebraic notation
  - Visual move indicators
  - Piece movement animations
  - Automatic board rotation in local multiplayer
  - Check and checkmate detection
  - Draw offers in multiplayer games

- **Multiplayer Features**:
  - Real-time game lobby
  - Create and join games
  - Player status tracking
  - Game state synchronization
  - Resignation option
  - Draw offers and agreements

- **UI Features**:
  - Responsive design
  - Light/Dark theme support
  - Move highlighting
  - Last move indicator
  - Legal move highlighting
  - Coordinate notation

## Technologies Used

- SvelteKit + Svelte 5
- WebSocket for real-time communication
- SCSS for styling
- Node.js for the backend server

## Prerequisites

- Node.js (v18 or higher)
- npm or pnpm

## Installation

1. Clone the repository:
```bash
git clone https://github.com/pretzL/chesszL.git
cd chess-game
```

2. Install dependencies:
```bash
npm install
# or
pnpm install
```

3. Start the development server:
```bash
# Start both the WebSocket server and the SvelteKit dev server
npm run dev
```

## Game Modes

### AI Mode
- Play against an AI opponent
- Choose your preferred color (white/black)
- Three difficulty levels:
  - Easy: Makes random valid moves
  - Medium: Evaluates basic tactics
  - Hard: Uses deeper position analysis

The "AI" uses basic weighting parameters to decide which moves are preferrable, which means it's not necessarily an intelligent player. Nevertheless, it is an opponent.

### Online Multiplayer
- Create or join games in the lobby
- Real-time gameplay with other players
- Offer/accept draws
- Resign games
- Chat with opponents (coming soon)

### Local Multiplayer
- Play on the same device
- Automatic board rotation between moves
- Smooth rotation animations
- Perfect for casual games with friends

## Development

### Running in Development Mode

The project uses two servers in development:
1. SvelteKit dev server for the frontend
2. WebSocket server for multiplayer functionality (`dev-server.js` for local development)

Run both simultaneously with:
```bash
npm run dev
```

### Building for Production

```bash
npm run build
```

The build process will create a production-ready application in the `build` directory.

### Starting Production Server

```bash
npm run start
```

This will start the production server `server.js` which handles both the web application and WebSocket connections.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

[MIT License](LICENSE)

## Acknowledgments

- Chess piece Unicode characters
- [Svelte](https://svelte.dev/) team for the amazing framework

## Support

For support, please open an issue in the GitHub repository or contact the maintainers.