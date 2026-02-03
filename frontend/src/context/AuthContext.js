import { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem("neonpub_token");
    const storedUser = localStorage.getItem("neonpub_user");
    
    if (storedToken && storedUser) {
      try {
        const userData = JSON.parse(storedUser);
        setToken(storedToken);
        setUser(userData);
      } catch (e) {
        console.error("Error parsing user data:", e);
        localStorage.removeItem("neonpub_token");
        localStorage.removeItem("neonpub_user");
      }
    }
    setLoading(false);
  }, []);

  const login = (tokenData, userData) => {
    localStorage.setItem("neonpub_token", tokenData);
    localStorage.setItem("neonpub_user", JSON.stringify(userData));
    setToken(tokenData);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem("neonpub_token");
    localStorage.removeItem("neonpub_user");
    localStorage.removeItem("neonpub_pub_code");
    setToken(null);
    setUser(null);
  };

  const isAuthenticated = !!token;
  const isAdmin = user?.is_admin || false;

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, isAuthenticated, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};
