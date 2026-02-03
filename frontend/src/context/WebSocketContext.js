import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "./AuthContext";

const WebSocketContext = createContext(null);

export const WebSocketProvider = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState(null);
  const wsRef = useRef(null);
  const lastMessageRef = useRef(null);
  const lastQuizIdRef = useRef(null);

  const reconnectTimeoutRef = useRef(null);
  const reconnectAttempts = useRef(0);

  const connect = useCallback(() => {
    // Get pub code from localStorage
    const pubCode = localStorage.getItem("neonpub_pub_code");
    
    if (!pubCode) {
      console.log("No pub code found, skipping WebSocket connection");
      return;
    }

    // Don't reconnect if already connected
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log("WebSocket already connected");
      return;
    }

    // Close existing connection if any
    if (wsRef.current) {
      wsRef.current.close();
    }

    const backendUrl = process.env.REACT_APP_BACKEND_URL;
    if (!backendUrl) {
      console.error("REACT_APP_BACKEND_URL not set");
      return;
    }

    const wsUrl = backendUrl.replace("https://", "wss://").replace("http://", "ws://");
    const fullUrl = `${wsUrl}/api/ws/${pubCode}`;
    
    console.log("Connecting to WebSocket:", fullUrl);
    
    try {
      const ws = new WebSocket(fullUrl);

      ws.onopen = () => {
        console.log("WebSocket connected!");
        setIsConnected(true);
        reconnectAttempts.current = 0;
        
        // Start ping interval to keep connection alive
        const pingInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send("ping");
          }
        }, 25000);
        ws.pingInterval = pingInterval;
      };

ws.onmessage = (event) => {
  if (event.data === "pong") return;

  let data;
  try {
    data = JSON.parse(event.data);
  } catch (e) {
    console.error("WebSocket message parse error:", e);
    return;
  }

  // 🔒 BLOCCO DUPLICATI IDENTICI
  const fingerprint = JSON.stringify(data);
  if (lastMessageRef.current === fingerprint) {
    return;
  }
  lastMessageRef.current = fingerprint;

  // 🔥 BLOCCO QUIZ RIPETUTI
  if (data.type === "quiz_started") {
    const quizId =
      data.quiz_id ||
      data.data?.quiz_id ||
      data.data?.id;

    if (quizId && lastQuizIdRef.current === quizId) {
      return;
    }

    lastQuizIdRef.current = quizId;
  }

  console.log("WebSocket accepted:", data.type);
  setLastMessage(data);
};


      ws.onclose = (event) => {
        console.log("WebSocket closed:", event.code, event.reason);
        setIsConnected(false);
        
        if (ws.pingInterval) {
          clearInterval(ws.pingInterval);
        }
        
        // Reconnect with exponential backoff
        if (reconnectAttempts.current < 10) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
          reconnectAttempts.current++;
          console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
      };

      wsRef.current = ws;
    } catch (error) {
      console.error("Failed to create WebSocket:", error);
    }
  }, []);
lastMessageRef.current = null;
lastQuizIdRef.current = null;

  const disconnect = useCallback(() => {
    console.log("Disconnecting WebSocket");
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (wsRef.current) {
      if (wsRef.current.pingInterval) {
        clearInterval(wsRef.current.pingInterval);
      }
      wsRef.current.close();
      wsRef.current = null;
    }
    
    setIsConnected(false);
    reconnectAttempts.current = 0;
  }, []);

  // Connect when authenticated
  useEffect(() => {
    const pubCode = localStorage.getItem("neonpub_pub_code");
    
    if (isAuthenticated && pubCode) {
      // Small delay to ensure everything is set up
      const timer = setTimeout(() => {
        connect();
      }, 500);
      return () => clearTimeout(timer);
    } else {
      disconnect();
    }
  }, [isAuthenticated, connect, disconnect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return (
    <WebSocketContext.Provider value={{ isConnected, lastMessage, connect, disconnect }}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error("useWebSocket must be used within WebSocketProvider");
  }
  return context;
};
