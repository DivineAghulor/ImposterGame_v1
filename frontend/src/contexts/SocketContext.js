import React, { createContext, useContext, useState, useEffect } from 'react';
import io from 'socket.io-client';

const SocketContext = createContext(null);

export const useSocket = () => {
    return useContext(SocketContext);
};

export const SocketProvider = ({ children }) => {
    const [socket, setSocket] = useState(null);

    // Effect to create and tear down the socket connection.
    useEffect(() => {
        // Connect to the backend server.
        // The URL should be the address of your backend.
        const newSocket = io(process.env.REACT_APP_BACKEND_URL); 
        setSocket(newSocket);

        // Cleanup on component unmount
        return () => newSocket.close();
    }, []);

    return (
        <SocketContext.Provider value={socket}>
            {children}
        </SocketContext.Provider>
    );
};
