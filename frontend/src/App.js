import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SocketProvider } from './contexts/SocketContext';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import Lobby from './components/Lobby';
import AnsweringView from './components/AnsweringView';
import VotingView from './components/VotingView';
import ResultsView from './components/ResultsView';
import GameOverView from './components/GameOverView';
import './App.css';

const PrivateRoute = ({ children }) => {
    const { token } = useAuth();
    return token ? children : <Navigate to="/" />;
};

const GameLayout = () => (
    <SocketProvider>
        <Outlet />
    </SocketProvider>
);

function App() {
    return (
        <AuthProvider>
            <Router>
                <div className="App">
                    <Routes>
                        <Route path="/" element={<Auth />} />
                        <Route 
                            path="/dashboard" 
                            element={<PrivateRoute><Dashboard /></PrivateRoute>} 
                        />
                        
                        <Route path="/game/:gameCode" element={<PrivateRoute><GameLayout /></PrivateRoute>}>
                            <Route path="lobby" element={<Lobby />} />
                            <Route path="round" element={<AnsweringView />} />
                            <Route path="vote" element={<VotingView />} />
                            <Route path="results" element={<ResultsView />} />
                            <Route path="summary" element={<GameOverView />} />
                        </Route>

                    </Routes>
                </div>
            </Router>
        </AuthProvider>
    );
}

export default App;
