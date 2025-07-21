This document outlines the backend system for a multiplayer social deduction game. The system manages game sessions, user authentication, and the core game loop. A user can act as an **Admin** by creating a game, setting the rules, and inputting the questions for each round. Other users, as **Players**, join the game lobby and participate.

Each round, one player is secretly assigned the **Impostor** role and receives a slightly different question from everyone else. Players submit answers, which are then revealed publicly. A voting phase follows, where players vote for who they believe the Impostor is. Points are awarded based on the voting outcome, and the game proceeds to the next round until a winner is determined. All real-time communication is handled via WebSockets.

---

### **Core Game Logic (State Machine)**

The game's lifecycle can be modeled as a state machine. The backend will manage the current state of each game session and transition between states based on admin actions, player inputs, or timers.

1. **LOBBY**:  
   * An admin creates a game, receiving a unique gameCode.  
   * Players use the gameCode to join the lobby.  
   * The admin sets the total number of rounds.  
   * The system broadcasts playerJoined events to everyone in the lobby.  
   * The admin can start the game, transitioning the state to QUESTION\_INPUT.  
2. **QUESTION\_INPUT**:  
   * The system prompts the Admin to submit the "Original Question" and the "Impostor Question" for the current round.  
   * Once the Admin submits the questions, the state transitions to ANSWERING.  
3. **ANSWERING**:  
   * The system randomly assigns the **Impostor** role to one active player.  
   * The system sends the "Impostor Question" to the Impostor and the "Original Question" to all other players.  
   * A **60-second timer** starts. Players submit their answers during this time. Late answers are discarded.  
   * When the timer expires, the state transitions to VOTING.  
4. **VOTING**:  
   * All submitted answers are broadcast to all players, displayed alongside the name of the player who wrote them.  
   * A **3-minute timer** starts for voting.  
   * Players vote for another player they suspect is the Impostor. Votes are public and broadcast in real-time.  
   * When the timer expires, the state transitions to SCORING.  
5. **SCORING**:  
   * The system tallies the votes.  
   * Points are awarded based on the following logic:  
     * **If the Impostor receives the most votes (no ties):** All other players get **2 points**. The Impostor gets **0 points**.  
     * **If there is a tie for the most votes:** The Impostor gets **1 point**. Everyone else gets **0 points**.  
     * **If the Impostor does not receive the most votes:** The Impostor gets **2 points**. Players who correctly voted for the Impostor get **1 point**. Everyone else gets **0 points**.  
   * The system broadcasts the round results, revealing the Impostor and the updated cumulative scores.  
   * The state transitions to ROUND\_END.  
6. **ROUND\_END**:  
   * The system checks if the current round number equals the total rounds set by the admin.  
   * **If not the final round:** The round counter increments, and the state returns to QUESTION\_INPUT.  
   * **If it is the final round:** The state transitions to GAME\_OVER.  
7. **GAME\_OVER**:  
   * The system broadcasts the final results and winner(s).  
   * The game session is concluded and can be archived in the database.

---

### **Technology Stack**

* **Backend Framework**: **Node.js** with **Express.js**  
* **Language**: **JavaScript** (configured for ES6 Modules: "type": "module" in package.json)  
* **Database**: **PostgreSQL**  
* **Real-time Communication**: **WebSockets** (using the socket.io library is recommended for its fallback mechanisms and ease of use)  
* **Authentication**: JWT (JSON Web Tokens) for securing endpoints.

---

### **Database Schema**

Here is a potential database schema using PostgreSQL.

* **Users Table**: Stores user credentials.  
  SQL  
  CREATE TABLE Users (  
      user\_id SERIAL PRIMARY KEY,  
      username VARCHAR(50) UNIQUE NOT NULL,  
      password\_hash VARCHAR(255) NOT NULL,  
      created\_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT\_TIMESTAMP  
  );

* **Games Table**: Stores game session information.  
  SQL  
  CREATE TABLE Games (  
      game\_id SERIAL PRIMARY KEY,  
      game\_code VARCHAR(8) UNIQUE NOT NULL,  
      admin\_id INTEGER REFERENCES Users(user\_id),  
      total\_rounds INTEGER NOT NULL,  
      current\_round INTEGER DEFAULT 0,  
      game\_state VARCHAR(20) NOT NULL DEFAULT 'LOBBY', \-- LOBBY, ANSWERING, VOTING, etc.  
      created\_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT\_TIMESTAMP  
  );

* **Players Table**: A linking table to track which users are in which game and their scores.  
  SQL  
  CREATE TABLE Players (  
      player\_id SERIAL PRIMARY KEY,  
      game\_id INTEGER NOT NULL REFERENCES Games(game\_id),  
      user\_id INTEGER NOT NULL REFERENCES Users(user\_id),  
      score INTEGER DEFAULT 0,  
      is\_active BOOLEAN DEFAULT TRUE, \-- To handle disconnects  
      UNIQUE (game\_id, user\_id)  
  );

* **Rounds Table**: Stores data for each round, including questions and the imposter.  
  SQL  
  CREATE TABLE Rounds (  
      round\_id SERIAL PRIMARY KEY,  
      game\_id INTEGER NOT NULL REFERENCES Games(game\_id),  
      round\_number INTEGER NOT NULL,  
      original\_question TEXT NOT NULL,  
      impostor\_question TEXT NOT NULL,  
      impostor\_player\_id INTEGER REFERENCES Players(player\_id)  
  );

* **Submissions Table**: Stores answers and votes for each round.  
  SQL  
  CREATE TABLE Submissions (  
      submission\_id SERIAL PRIMARY KEY,  
      round\_id INTEGER NOT NULL REFERENCES Rounds(round\_id),  
      player\_id INTEGER NOT NULL REFERENCES Players(player\_id),  
      answer\_text TEXT,  
      voted\_for\_player\_id INTEGER REFERENCES Players(player\_id)  
  );

---

### **API Endpoints & WebSocket Events**

#### **REST API Endpoints**

These endpoints handle actions that don't need to be instantaneous, like setup and authentication.

**Authentication (/api/auth)**

* POST /signup  
  * **Body**: { "username": "...", "password": "..." }  
  * **Action**: Creates a new user in the Users table.  
* POST /login  
  * **Body**: { "username": "...", "password": "..." }  
  * **Action**: Authenticates a user and returns a JWT.

**Game Management (/api/games)**

* POST / (Authenticated)  
  * **Body**: { "totalRounds": 5 }  
  * **Action**: Creates a new game, sets the creator as Admin, and returns the unique gameCode.  
* POST /:gameCode/join (Authenticated)  
  * **Action**: Allows a logged-in player to join the lobby of the game specified by :gameCode.

**Admin Actions (/api/admin/games/:gameCode)**

* POST /start (Authenticated, Admin only)  
  * **Action**: Starts the game, changing its state from LOBBY.  
* POST /rounds (Authenticated, Admin only)  
  * **Body**: { "originalQuestion": "...", "impostorQuestion": "..." }  
  * **Action**: Submits the questions for the current round.

#### **WebSocket Events 💬**

WebSockets will handle all real-time gameplay interactions. The client connects to the WebSocket server after joining a game.

**Server to Client Events (Server \-\> Client)**

* playerUpdate: Sends the updated list of players in the lobby or game.  
* gameStarted: Notifies all players that the game has begun.  
* newRound(data): Announces the start of a new round.  
  * data: { roundNumber: 1, role: 'IMPOSTOR' | 'ORIGINAL', question: 'Your question...' }  
* votingPhase(data): Announces the start of voting.  
  * data: \[{ player: 'username1', answer: '...' }, { player: 'username2', answer: '...' }\]  
* voteReceived(data): Announces in real-time that a vote has been cast.  
  * data: { voter: 'username1', votedFor: 'username2' }  
* roundResult(data): Announces the round outcome.  
  * data: { impostor: 'username3', scores: \[{ player: 'username1', score: 2 }, ...\] }  
* gameOver(data): Announces the final game results.  
  * data: { finalScores: \[...\] }  
* timerUpdate(data): Sends a tick from the server countdown.  
  * data: { secondsLeft: 59 }

**Client to Server Events (Client \-\> Server)**

* submitAnswer(data)  
  * data: { answer: 'My answer...' }  
* submitVote(data)  
  * data: { votedForPlayerId: 123 }  
* reconnect  
  * **Action**: Allows a disconnected player to attempt to rejoin their active game session.