import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Mic2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { joinPub, getPub } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export default function JoinRedirect() {
  const { pubCode } = useParams();
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuth();
  
  const [pubName, setPubName] = useState("");
  const [nickname, setNickname] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // If already authenticated, go to app
  useEffect(() => {
    if (isAuthenticated) {
      navigate("/app");
    }
  }, [isAuthenticated, navigate]);

  // Fetch pub info
  useEffect(() => {
    const fetchPub = async () => {
      try {
        const { data } = await getPub(pubCode);
        setPubName(data.name);
        setLoading(false);
      } catch (error) {
        setError("Pub non trovato");
        setLoading(false);
      }
    };
    
    if (pubCode) {
      fetchPub();
    }
  }, [pubCode]);

const handleJoin = async (e) => {
  e.preventDefault();
  if (!nickname.trim()) {
    toast.error("Inserisci il tuo nickname");
    return;
  }
  
  setSubmitting(true);
  try {
    const { data } = await joinPub({ pub_code: pubCode.toUpperCase(), nickname });
    
    // Controllo sicurezza: se manca token o user, non crasha
    if (!data?.token || !data?.user) {
      throw new Error("Risposta dal server incompleta");
    }

    localStorage.setItem("neonpub_pub_code", pubCode.toUpperCase());
    login(data.token, data.user);
    toast.success(`Benvenuto ${nickname}!`);
    navigate("/app");
  } catch (error) {
    console.error("Errore join:", error);  // ← questo aiuta a vedere l'errore in console
    toast.error(error.message || error.response?.data?.detail || "Errore di connessione");
  } finally {
    setSubmitting(false);
  }
};

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="spinner"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-6">
        <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center mb-6">
          <Mic2 className="w-10 h-10 text-red-400" />
        </div>
        <h1 className="text-2xl font-bold text-red-400 mb-2">Pub non trovato</h1>
        <p className="text-zinc-500 mb-6">Il codice "{pubCode}" non esiste</p>
        <Button 
          onClick={() => navigate("/")}
          className="rounded-full bg-fuchsia-500 hover:bg-fuchsia-600"
        >
          Torna alla Home
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen hero-gradient flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-full bg-fuchsia-500/20 flex items-center justify-center mx-auto mb-4 neon-primary">
            <Mic2 className="w-10 h-10 text-fuchsia-400" />
          </div>
          <h1 className="text-3xl font-bold mb-2">{pubName}</h1>
          <p className="text-zinc-400">Inserisci il tuo nickname per entrare</p>
        </div>

        {/* Form */}
        <form onSubmit={handleJoin} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm text-zinc-400">Il tuo Nickname</label>
            <Input
              data-testid="join-nickname-input"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Come ti chiami?"
              className="bg-zinc-800/50 border-zinc-700 text-lg py-6"
              maxLength={20}
              autoFocus
            />
          </div>
          
          <Button 
            data-testid="join-submit-btn"
            type="submit" 
            disabled={submitting}
            className="w-full rounded-full bg-fuchsia-500 hover:bg-fuchsia-600 py-6 text-lg"
          >
            {submitting ? (
              "Connessione..."
            ) : (
              <>
                <Send className="w-5 h-5 mr-2" /> Entra
              </>
            )}
          </Button>
        </form>

        {/* Footer */}
        <p className="text-center text-zinc-600 text-sm mt-8">
          Codice: <span className="mono text-cyan-400">{pubCode}</span>
        </p>
      </div>
    </div>
  );
}
