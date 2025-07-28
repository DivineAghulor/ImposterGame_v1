### **Frontend Functional Requirements: Impostor Game**

#### **1\. High-Level Overview**

This document outlines the functional requirements for the frontend of the Impostor game. The frontend will be a Single Page Application (SPA) that communicates with the existing backend via a combination of a REST API (for authentication and game setup) and WebSockets (for all real-time gameplay events). The application will guide users through authentication, game creation/joining, a game lobby, and the core game loop of answering, voting, and viewing results across multiple rounds.

#### **2\. Visual Design & Theme**

The application will adopt a bold, vibrant, and modern "Cosmic Pop" color theme to create an engaging and fun user experience. All styling will be implemented with pure CSS, using CSS variables for maintainability and consistency.

**Color Palette (CSS Variables):**

:root {  
  \--background-dark: \#1A1A2E; /\* Deep Space Blue \*/  
  \--primary-purple: \#9C27B0; /\* Vibrant Purple \*/  
  \--accent-pink: \#E91E63;     /\* Hot Pink \*/  
  \--accent-cyan: \#00BCD4;      /\* Bright Cyan \*/  
  \--text-light: \#F0F0F0;      /\* Off-white \*/  
  \--text-dark: \#1A1A2E;  
  \--success-green: \#4CAF50;  
  \--error-red: \#F44336;  
  \--disabled-gray: \#555;  
}

* **Typography:** A clean, sans-serif font like "Poppins" or "Nunito" will be used for readability.  
* **Layout:** All views will be centered and responsive, ensuring a seamless experience on both desktop and mobile devices.

#### **3\. Page Flow & Component Breakdown**

**3.1. Auth View (/)**

* **Purpose:** The entry point for all users to either sign up for a new account or log into an existing one.  
* **UI Elements:**  
  * A main container with a prominent game logo.  
  * Tabs or a toggle switch to select between "Login" and "Sign Up".  
  * Input fields for username and password.  
  * A primary action button (e.g., "Login" or "Create Account") styled with \--primary-purple.  
  * A message area to display success or error messages (e.g., "User already exists," "Login successful").  
* **Backend Connection:**  
  * On submit, sends a POST request to /api/auth/signup or /api/auth/login.  
  * On successful login, the received JWT is stored securely in client-side state (e.g., memory, not localStorage for better security).  
  * The user is automatically navigated to the /dashboard view.

**3.2. Dashboard View (/dashboard)**

* **Purpose:** A central hub for authenticated users to either create a new game or join an existing one.  
* **UI Elements:**  
  * A "Welcome, \[Username\]\!" message.  
  * **Create Game Section:**  
    * An input field to specify the "Number of Rounds".  
    * A "Create Game" button.  
  * **Join Game Section:**  
    * An input field for the "Game Code".  
    * A "Join Game" button.  
* **Backend Connection:**  
  * **Create Game:** Sends a POST request to /api/games with the number of rounds. On success, the backend returns a gameCode.  
  * **Join Game:** Sends a POST request to /api/games/:gameCode/join.  
  * Upon successful creation or joining, the user is immediately navigated to the /game/:gameCode/lobby view.

**3.3. Lobby View (/game/:gameCode/lobby)**

* **Purpose:** A waiting area where the Admin prepares the game and players gather before it begins.  
* **UI Elements:**  
  * **For All Users:**  
    * A large display of the **Game Code** for easy sharing.  
    * A real-time list of all players currently in the lobby.  
    * A status message area (e.g., "Waiting for the Admin to input questions...").  
  * **Admin-Only View:**  
    * Two input fields: "Originals' Question" and "Impostor's Question".  
    * A "Submit Questions & Start Game" button. This button is disabled until both question fields are filled.  
* **Backend Connection (WebSockets):**  
  * The client establishes a WebSocket connection upon entering this view.  
  * Listens for playerUpdate events to update the player list in real-time.  
  * **Admin Action:** Clicking "Start Game" sends a POST request to /api/admin/games/:gameCode/rounds with the questions, followed by a POST to /api/admin/games/:gameCode/start.  
  * Listens for the gameStarted event, which triggers navigation for all players to the /game/:gameCode/round view.

**3.4. Answering View (/game/:gameCode/round)**

* **Purpose:** Where players receive their question and submit an answer within a time limit.  
* **UI Elements:**  
  * A prominent display of the question received from the server.  
  * A large, multi-line text area for the player's answer.  
  * A "Submit Answer" button.  
  * A **Live Countdown Clock**. It will be visually prominent (e.g., a large circular timer) and will start at **55 seconds**. When the timer hits zero, the input and button are disabled.  
* **Backend Connection (WebSockets):**  
  * Receives the question and role via the newRound event.  
  * On submit, emits a submitAnswer event with the answer text.  
  * Listens for the votingPhase event, which triggers navigation to the /game/:gameCode/vote view.

**3.5. Voting View (/game/:gameCode/vote)**

* **Purpose:** Players review all submitted answers and vote for who they believe is the Impostor.  
* **UI Elements:**  
  * A **Live Countdown Clock**, starting at **2 minutes and 55 seconds**.  
  * A grid or list displaying all submitted answers. Each entry will clearly show:  
    * The player's username.  
    * The answer they submitted.  
  * A separate list of all players who can be voted for. Each player in this list will have:  
    * Their username.  
    * A "Vote" button next to their name.  
    * A vote counter, which starts at 0\.  
  * A real-time log or feed that displays voting actions as they happen (e.g., "Player A voted for Player B").  
* **Backend Connection (WebSockets):**  
  * Receives the list of answers via the votingPhase event.  
  * When a user clicks "Vote", it emits a submitVote event with the ID of the player they voted for. The user can only vote once.  
  * Listens for the voteReceived event to update the vote log and increment the vote counter next to the corresponding player's name.  
  * Listens for the roundResult event, which triggers navigation to the /game/:gameCode/results view.

**3.6. Results View (/game/:gameCode/results)**

* **Purpose:** To display the outcome of the round, reveal the Impostor, and show updated scores.  
* **UI Elements:**  
  * A clear message revealing the Impostor (e.g., "**\[Username\]** was the Impostor\!").  
  * A summary of points awarded for the round.  
  * An updated scoreboard showing the cumulative scores for all players.  
  * A message indicating the next action (e.g., "The next round will begin shortly..." or "Final Results...").  
* **Backend Connection (WebSockets):**  
  * Receives all data via the roundResult event.  
  * Listens for newRound to navigate back to the Answering View for the next round.  
  * Listens for gameOver to navigate to the final summary view.

**3.7. Game Over View (/game/:gameCode/summary)**

* **Purpose:** To display the final results and declare the winner(s).  
* **UI Elements:**  
  * A "Game Over\!" title.  
  * A declaration of the winner(s).  
  * The final, ranked scoreboard.  
  * A "Return to Dashboard" button.  
* **Backend Connection (WebSockets):**  
  * Receives data via the gameOver event.  
  * The "Return to Dashboard" button navigates the user back to the /dashboard view, where the WebSocket connection for the game can be terminated.