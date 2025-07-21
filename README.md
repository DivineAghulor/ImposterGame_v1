# Impostor Game Backend

This repository contains the backend system for a real-time multiplayer social deduction game, as specified in the project's Functional Requirements Document. The system manages game sessions, user authentication, and the complete game loop from lobby to game over.

## Features

*   **Game State Management**: A robust state machine that handles the entire game flow (Lobby, Answering, Voting, Scoring, etc.).
*   **Real-time Communication**: Uses WebSockets (`socket.io`) for all real-time gameplay interactions.
*   **User Authentication**: Secure user signup and login using JSON Web Tokens (JWT).
*   **Database Persistence**: All game and user data is stored in a PostgreSQL database.
*   **Admin and Player Roles**: Supports distinct roles for game administration (creating games, setting rules) and playing.
*   **Dynamic Game Logic**: Supports a variable number of rounds, random impostor assignment, and a full scoring system.

## Technology Stack

*   **Backend**: Node.js with Express.js
*   **Real-time Communication**: Socket.IO
*   **Database**: PostgreSQL
*   **Authentication**: JWT (jsonwebtoken)
*   **Password Hashing**: bcrypt

## Prerequisites

Before you begin, ensure you have the following installed on your system:

*   [Node.js](https://nodejs.org/) (v14.x or later recommended)
*   [npm](https://www.npmjs.com/) (usually comes with Node.js)
*   [PostgreSQL](https://www.postgresql.org/download/)

## Setup and Installation

Follow these steps to get the application running locally.

### 1. Clone the Repository

First, clone this repository to your local machine (or simply download the source files).

```bash
git clone <repository-url>
cd impostor-question-v1
```

### 2. Install Dependencies

Navigate to the project's root directory and install the required npm packages.

```bash
npm install
```

### 3. Configure Environment Variables

The application requires a `.env` file for configuration, primarily for database credentials and a JWT secret.

Create a file named `.env` in the root of the project and add the following content. **Remember to replace the placeholder values with your actual PostgreSQL and secret credentials.**

```env
# PostgreSQL Database Configuration
DB_USER=your_postgres_user
DB_HOST=localhost
DB_DATABASE=your_database_name
DB_PASSWORD=your_postgres_password
DB_PORT=5432

# JWT Secret for Authentication
JWT_SECRET=your_super_secret_jwt_key
```

### 4. Set Up the Database

Make sure your PostgreSQL server is running and that you have created the database specified in your `.env` file.

Then, run the provided setup script from the root directory to create all the necessary tables (`Users`, `Games`, `Players`, etc.).

```bash
node setup.js
```

You should see a confirmation message: `Database tables created successfully.`

## Running the Application

Once the setup is complete, you can start the application server.

```bash
node src/server.js
```

The server will start, and you should see the following message in your console:

```
Server is running on port 3000
```

The backend is now running and ready to accept API requests and WebSocket connections on port 3000.
