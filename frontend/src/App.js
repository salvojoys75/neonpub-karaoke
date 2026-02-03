import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/context/AuthContext";
import { WebSocketProvider } from "@/context/WebSocketContext";
import LandingPage from "@/pages/LandingPage";
import ClientApp from "@/pages/ClientApp";
import AdminDashboard from "@/pages/AdminDashboard";
import PubDisplay from "@/pages/PubDisplay";
import JoinRedirect from "@/pages/JoinRedirect";
import "@/App.css";

function App() {
  return (
    <AuthProvider>
      <WebSocketProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/join/:pubCode" element={<JoinRedirect />} />
            <Route path="/app" element={<ClientApp />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/display/:pubCode" element={<PubDisplay />} />
          </Routes>
        </BrowserRouter>
        <Toaster position="top-center" richColors />
      </WebSocketProvider>
    </AuthProvider>
  );
}

export default App;
