# Code Explanations

This file documents the code for the Impostor game backend, broken down by implementation phase.

## Phase 1: Project Setup and Lobby Management

### Files Created:
*   `src/server.js`: The main entry point for the application.
*   `src/game/game.js`: Handles the core game logic.
*   `src/utils/db.js`: For database connection and queries.

### Code Explanation:

*   **`src/server.js`**: This file sets up the Express server and integrates `socket.io`. It includes two API endpoints:
    *   `POST /api/games`: Creates a new game session and returns a unique `gameCode`.
    *   `POST /api/games/:gameCode/join`: Allows a player to join an existing game lobby.
    It also includes a basic `socket.io` connection handler.

*   **`src/game/game.js`**: This file manages the in-memory game state. For now, it includes:
    *   `createGame`: A function to create a new game with a unique `gameCode`.
    *   `joinGame`: A function to add a player to a game.
    *   `getPlayers`: A function to get the list of players in a game.

*   **`src/utils/db.js`**: This file configures the connection to the PostgreSQL database using the `pg` library. It exports a connection pool that can be used to query the database.

## Phase 2: QUESTION_INPUT and ANSWERING States

### Files Modified:
*   `src/server.js`
*   `src/game/game.js`

### Code Explanation:

*   **`src/server.js`**:
    *   Added a `socketId` to the `joinGame` endpoint to associate a player with their WebSocket connection. This is crucial for sending direct messages.
    *   Added `POST /api/admin/games/:gameCode/start`: An endpoint for the admin to start the game, which transitions the game state from `LOBBY` to `QUESTION_INPUT`.
    *   Added `POST /api/admin/games/:gameCode/rounds`: An endpoint for the admin to submit the questions for the round. This triggers the `ANSWERING` state.
    *   When questions are submitted, the server now emits a `newRound` event to each player individually, sending the correct question (`Original` or `Impostor`) and their role.
    *   Added a WebSocket listener for the `submitAnswer` event to receive answers from clients.

*   **`src/game/game.js`**:
    *   `joinGame` now accepts a `socketId` and stores it with the player's data.
    *   `startGame`: New function to change the `gameState` to `QUESTION_INPUT`.
    *   `submitQuestions`: New function that:
        *   Transitions the `gameState` to `ANSWERING`.
        *   Increments the `currentRound`.
        *   Randomly assigns the `isImpostor` role to one player.
        *   Stores the submitted questions in the game object.
        *   Starts a 60-second timer. After the timer, the game will transition to the `VOTING` state (the event emission for this is a placeholder for the next phase).
    *   `submitAnswer`: New function to store a player's answer in the game state.

## Phase 3: VOTING and SCORING States

### Files Modified:
*   `src/server.js`
*   `src/game/game.js`

### Code Explanation:

*   **`src/server.js`**:
    *   The `createGame` function now passes an `eventEmitter` callback to the game logic. This allows the game logic to emit events back to the server, decoupling the game state management from the `socket.io` instance.
    *   Added a WebSocket listener for the `submitVote` event. When a vote is received, it calls the `submitVote` function in `game.js` and then broadcasts a `voteReceived` event to all players in the room.

*   **`src/game/game.js`**:
    *   `createGame` now accepts the `eventEmitter` and stores it in the game object.
    *   `submitQuestions` now correctly transitions to the `VOTING` state by calling `transitionToVoting` after the 60-second answer timer.
    *   `transitionToVoting`: This new function changes the `gameState` to `VOTING`, emits the `votingPhase` event with all the answers, and starts a 3-minute timer for voting.
    *   `submitVote`: This new function records a player's vote. It ensures a player can only vote once.
    *   `transitionToScoring`: This new function is called after the voting timer expires. It:
        *   Changes the `gameState` to `SCORING`.
        *   Tallies the votes to find the player(s) with the most votes.
        *   Implements the scoring logic based on whether the Impostor was correctly identified.
        *   Emits the `roundResult` event with the outcome and updated scores.
        *   Calls `transitionToRoundEnd` to proceed.
    *   `transitionToRoundEnd`: This new function checks if the game is over.
        *   If it's the final round, it sets the `gameState` to `GAME_OVER` and emits the `gameOver` event.
        *   Otherwise, it sets the `gameState` to `ROUND_END` and then back to `QUESTION_INPUT` after a short delay, allowing the admin to input questions for the next round.

## Phase 4: Database Integration and Authentication

### Files Created:
*   `setup.js`: A script to create the database tables.
*   `src/auth/auth.js`: Handles user signup and login.
*   `src/auth/middleware.js`: Provides JWT authentication middleware.

### Files Modified:
*   `src/server.js`
*   `src/game/game.js`

### Code Explanation:

*   **`setup.js`**: This script connects to the database and creates the `Users`, `Games`, `Players`, `Rounds`, and `Submissions` tables if they don't already exist.

*   **`src/auth/auth.js`**:
    *   `signup`: Hashes the user's password with `bcrypt` and inserts the new user into the `Users` table.
    *   `login`: Compares the provided password with the stored hash. If they match, it generates a JWT for the user.

*   **`src/auth/middleware.js`**:
    *   `authenticateToken`: An Express middleware that verifies the JWT from the `Authorization` header. It protects routes that require a logged-in user.

*   **`src/server.js`**:
    *   The auth routes (`/api/auth/signup`, `/api/auth/login`) are added.
    *   The `authenticateToken` middleware is applied to all game management and admin endpoints.
    *   The user's ID is now retrieved from the JWT (`req.user.userId`) instead of the request body.
    *   All calls to game logic functions are now `async/await` as they interact with the database.

*   **`src/game/game.js`**:
    *   The entire file has been refactored to be asynchronous and use the PostgreSQL database for all state management instead of an in-memory `games` map.
    *   **State Storage**: Game state is now stored in the `Games` table. Player data, scores, and associations are in the `Players` table. Round questions and the impostor are in the `Rounds` table. Answers and votes are stored in the `Submissions` table.
    *   **In-Memory Cache**: A small in-memory cache (`gameEmitters`, `playerSockets`) is maintained to map `gameCode` to its `socket.io` event emitter and `playerId` to their `socketId`. This avoids constant database lookups for sending real-time events.
    *   **Functions**: All functions (`createGame`, `joinGame`, `startGame`, etc.) now perform SQL queries to create, read, and update the game state in the database.
    *   **Transactions**: For more complex operations in a production environment, these database calls would ideally be wrapped in transactions to ensure data integrity.
