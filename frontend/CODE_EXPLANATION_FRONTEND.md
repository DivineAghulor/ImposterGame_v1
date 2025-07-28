# Frontend Code Explanations

This file documents the code for the Impostor game frontend, broken down by implementation phase.

## Phase 1: Project Setup & Authentication View

### Project Setup
*   A new React application was created in the `frontend` directory using `create-react-app`.
*   `react-router-dom` was installed for client-side routing.
*   `socket.io-client` was installed to handle WebSocket communication in later phases.

### Files Created:
*   `frontend/src/App.css`: Contains all the styling for the application, including the "Cosmic Pop" theme defined with CSS variables. It provides a modern, responsive base style for all components.
*   `frontend/src/contexts/AuthContext.js`: Implements a React Context for global state management of authentication.
    *   **AuthProvider**: A wrapper component that provides the auth state (JWT token, username) and functions (`login`, `logout`) to all components nested within it.
    *   **useAuth**: A custom hook that allows any component to easily access the authentication context. The JWT is stored in React's state, which is more secure than `localStorage` as it's not vulnerable to XSS attacks.
*   `frontend/src/components/Auth.js`: The user-facing component for signing up and logging in.
    *   It features a tabbed interface to switch between "Login" and "Sign Up" forms.
    *   It handles user input and form submission.
    *   On submit, it makes the appropriate `POST` request to the backend's `/api/auth/login` or `/api/auth/signup` endpoints.
    *   It provides user feedback for success or error scenarios.
    *   On successful login, it calls the `login` function from `AuthContext` and navigates the user to the dashboard.
*   `frontend/src/App.js`: The main application component.
    *   It sets up the `AuthProvider` to wrap the entire application.
    *   It uses `react-router-dom` to define the application's routes.
    *   It includes a `PrivateRoute` component that checks for a valid JWT in the `AuthContext`. This protects routes like `/dashboard` from being accessed by unauthenticated users, redirecting them to the login page if they are not logged in.
    *   A placeholder `Dashboard` component is included to demonstrate the private routing.

## Phase 2: Dashboard & Game Lobby

### Files Created:
*   `frontend/src/contexts/SocketContext.js`: A new React Context to manage the lifecycle of the WebSocket connection.
    *   **SocketProvider**: Establishes a connection to the backend's `socket.io` server when a user enters a game-related route. It provides the `socket` instance to all child components. The connection is automatically closed when the user navigates away from the game routes.
*   `frontend/src/components/Dashboard.js`: The main hub for authenticated users.
    *   It allows a user to create a new game by specifying the number of rounds and sending a `POST` request to `/api/games`.
    *   It also allows a user to join an existing game by entering a `gameCode` and sending a `POST` request to `/api/games/:gameCode/join`.
    *   Upon a successful response for either action, it navigates the user to the corresponding game lobby.
*   `frontend/src/components/Lobby.js`: The waiting area for the game.
    *   It retrieves the `gameCode` from the URL parameters.
    *   It uses the `useSocket` hook to get the WebSocket instance and listens for events.
    *   **Game Info Fetch**: On mount, the component fetches the game object from the backend (`/api/games/:gameCode`) to get the `admin_id` and the current list of players.
    *   **Real-time Updates**: It listens for the `playerUpdate` event to display a live list of players who have joined the lobby.
    *   **Admin View**: The Lobby UI checks if the logged-in user's ID matches the `admin_id` from the backend game object. If so, it displays two controls:
        1. A button to start the game, which sends a POST request to `/api/admin/games/:gameCode/start`.
        2. Input fields for the original and impostor questions, and a button to submit them, which sends a POST request to `/api/admin/games/:gameCode/rounds`.
      These controls are only visible to the admin. All other players see a message: "Waiting for the Admin to start the game...". This ensures only the admin can transition the game from the lobby to the question input and answering phases.
    *   **Navigation**: It listens for the `newRound` event from the server, which signals that the game is starting. Upon receiving this event, it navigates all players to the `Answering` view for the first round.

### Files Modified:
*   `frontend/src/App.js`:
    *   The routing was updated to include a new `GameLayout`. This layout component wraps all game-specific routes (lobby, round, vote, etc.) with the `SocketProvider`, ensuring they all share the same WebSocket connection.
    *   The routes for the `Dashboard` and `Lobby` were added, protected by the `PrivateRoute`.
*   `frontend/src/App.css`:
    *   New styles were added for the `Dashboard` and `Lobby` components to match the "Cosmic Pop" theme, ensuring a consistent and visually appealing user interface.

## Phase 3: Core Gameplay Loop (Answering, Voting, Results)

### Files Created:
*   `frontend/src/components/AnsweringView.js`: The view where players submit their answers.
    *   It receives the question and role from the `Lobby` via navigation state.
    *   It displays a prominent 60-second countdown timer. When the timer hits zero, input is disabled.
    *   It provides a text area for the user to enter their answer and a submit button, which emits a `submitAnswer` event to the server.
    *   It listens for the `votingPhase` event to automatically navigate all players to the `VotingView`.
*   `frontend/src/components/VotingView.js`: The view for reviewing answers and voting.
    *   It receives the list of all player answers from the previous state.
    *   It displays the answers in a grid and provides a list of players to vote for.
    *   It features a 3-minute countdown timer.
    *   Clicking a "Vote" button emits a `submitVote` event and disables further voting for that user.
    *   It listens for `voteReceived` events to provide a live-updating log of who is voting for whom.
    *   It listens for the `roundResult` event to navigate to the `ResultsView`.
*   `frontend/src/components/ResultsView.js`: Displays the outcome of a round.
    *   It receives the results data (impostor, scores) from the `VotingView`.
    *   It clearly reveals the impostor and shows the updated scoreboard.
    *   It listens for two possible events for navigation:
        *   `newRound`: Navigates players to the next `AnsweringView`.
        *   `nextRoundReady`: Navigates the Admin back to the `Lobby` to input the next set of questions.
        *   `gameOver`: Navigates all users to the final summary screen.
*   `frontend/src/components/GameOverView.js`: The final screen of the game.
    *   It displays the final winner and the ranked scoreboard.
    *   It provides a button to navigate back to the `/dashboard`.

### Files Modified:
*   `frontend/src/App.js`: The routes for `/round`, `/vote`, `/results`, and `/summary` were added to the `GameLayout` to ensure they have access to the shared WebSocket connection.
*   `frontend/src/App.css`: New styles for all the gameplay components were added. This includes styling for timers, question displays, answer cards, voting buttons, and scoreboards, all adhering to the "Cosmic Pop" theme.
