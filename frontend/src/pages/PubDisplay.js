import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Mic2, Sparkles, Music, Trophy, ArrowRight, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/lib/supabase";
import { createPub, joinPub } from "@/lib/api"; // Assicurati che joinPub sia importato
import { useAuth } from "@/context/AuthContext";

export default function LandingPage() {
  const navigate = useNavigate();
  const { login } = useAuth(); // Importiamo login dal context per i clienti
  
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authTab, setAuthTab] = useState("client"); // Default su Client
  const [loading, setLoading] = useState(false);

  // Client Join
  const [joinCode, setJoinCode] = useState("");
  const [nickname, setNickname] = useState("");

  // Admin Login
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");

  // Create Pub
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPubName, setNewPubName] = useState("");

  // CONTROLLO AUTOMATICO: Se l'admin è già loggato, cerchiamo il suo evento attivo
  useEffect(() => {
    const checkActiveSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        // Cerca evento attivo
        const { data: event } = await supabase
          .from('events')
          .select('*')
          .eq('owner_id', session.user.id)
          .eq('status', 'active')
          .single();
        
        if (event) {
          console.log("Evento attivo trovato:", event.code);
          localStorage.setItem("neonpub_pub_code", event.code);
          navigate("/admin");
        }
      }
    };
    checkActiveSession();
  }, [navigate]);

  const handleClientJoin = async (e) => {
    e.preventDefault();
    if (!joinCode || !nickname) {
      toast.error("Inserisci codice e nickname");
      return;
    }

    setLoading(true);
    try {
      const { data } = await joinPub({ pub_code: joinCode, nickname });
      
      localStorage.setItem("neonpub_token", data.token);
      localStorage.setItem("neonpub_user", JSON.stringify(data.user));
      
      // Aggiorna AuthContext
      if (login) login(data.token, data.user);
      
      toast.success(`Benvenuto al ${joinCode}!`);
      navigate("/app");
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Codice non valido o nickname in uso");
    } finally {
      setLoading(false);
    }
  };

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    if (!adminEmail.trim() || !adminPassword.trim()) {
      toast.error("Inserisci email e password");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: adminEmail,
        password: adminPassword
      });

      if (error) throw error;

      toast.success("Login effettuato!");
      
      // DOPO IL LOGIN: Controllo se ha già un evento attivo
      const { data: event } = await supabase
        .from('events')
        .select('*')
        .eq('owner_id', data.session.user.id)
        .eq('status', 'active')
        .single();

      if (event) {
        // HA GIA' UN EVENTO -> VAI IN DASHBOARD
        localStorage.setItem("neonpub_pub_code", event.code);
        navigate("/admin");
      } else {
        // NON HA UN EVENTO -> APRI MODALE CREAZIONE
        setShowAuthModal(false);
        setShowCreateModal(true);
      }

    } catch (error) {
      toast.error(error.message || "Credenziali non valide");
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePub = async (e) => {
    e.preventDefault();
    if (!newPubName.trim()) {
      toast.error("Inserisci nome pub");
      return;
    }

    setLoading(true);
    try {
      const { data } = await createPub({ name: newPubName });
      toast.success(`Pub "${data.name}" creato! Codice: ${data.code}`);
      localStorage.setItem("neonpub_pub_code", data.code);
      setShowCreateModal(false);
      navigate(`/admin`);
    } catch (error) {
      if (error.message === 'No credits available') {
        toast.error("Nessun gettone disponibile");
      } else if (error.message === 'Not authenticated') {
        toast.error("Devi fare login prima");
        setShowCreateModal(false);
        setShowAuthModal(true);
      } else {
        toast.error("Errore nella creazione: " + error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen hero-gradient relative overflow-hidden">
      {/* Background Blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-fuchsia-600/20 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-cyan-600/20 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="container mx-auto px-6 py-12 relative z-10">
        <div className="flex justify-end mb-8">
             <Button 
              variant="ghost"
              onClick={() => { setAuthTab("admin"); setShowAuthModal(true); }}
              className="text-zinc-400 hover:text-white"
            >
              Area Regia
            </Button>
        </div>

        <div className="text-center mb-16">
          <div className="flex justify-center mb-6">
            <div className="w-24 h-24 rounded-full bg-fuchsia-500/20 flex items-center justify-center neon-primary animate-pulse-slow">
              <Mic2 className="w-12 h-12 text-fuchsia-400" />
            </div>
          </div>
          
          <h1 className="text-6xl font-bold mb-6 tracking-tight">
            <span className="text-white">Karaoke</span>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-400 to-cyan-400"> + Quiz</span>
          </h1>
          
          <p className="text-xl text-zinc-400 mb-10 max-w-2xl mx-auto">
            L'esperienza Karaoke interattiva definitiva.
          </p>

          {/* MAIN ACTION BUTTONS */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button 
              size="lg"
              onClick={() => { setAuthTab("client"); setShowAuthModal(true); }}
              className="w-full sm:w-auto rounded-full bg-white text-black hover:bg-zinc-200 text-lg px-8 py-6 shadow-lg shadow-white/10 transition-transform hover:scale-105"
            >
              <User className="w-5 h-5 mr-2" />
              Partecipa a un Evento
            </Button>
            
            <Button 
              size="lg"
              onClick={() => { setAuthTab("admin"); setShowAuthModal(true); }}
              className="w-full sm:w-auto rounded-full bg-gradient-to-r from-fuchsia-500 to-cyan-500 hover:from-fuchsia-600 hover:to-cyan-600 text-lg px-8 py-6 shadow-lg shadow-fuchsia-500/20 transition-transform hover:scale-105"
            >
              <Sparkles className="w-5 h-5 mr-2" />
              Gestisci Locale
            </Button>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-8 mt-20">
          <div className="glass p-8 rounded-2xl border border-white/5 hover:border-fuchsia-500/30 transition-colors">
            <div className="w-14 h-14 rounded-xl bg-fuchsia-500/20 flex items-center justify-center mb-4">
              <Music className="w-7 h-7 text-fuchsia-400" />
            </div>
            <h3 className="text-xl font-bold mb-2">Karaoke Live</h3>
            <p className="text-zinc-400">
              Coda automatica, testi su smartphone e gestione semplice.
            </p>
          </div>

          <div className="glass p-8 rounded-2xl border border-white/5 hover:border-cyan-500/30 transition-colors">
            <div className="w-14 h-14 rounded-xl bg-cyan-500/20 flex items-center justify-center mb-4">
              <Sparkles className="w-7 h-7 text-cyan-400" />
            </div>
            <h3 className="text-xl font-bold mb-2">Reazioni Live</h3>
            <p className="text-zinc-400">
              Il pubblico vota e reagisce in tempo reale durante le esibizioni.
            </p>
          </div>

          <div className="glass p-8 rounded-2xl border border-white/5 hover:border-pink-500/30 transition-colors">
            <div className="w-14 h-14 rounded-xl bg-pink-500/20 flex items-center justify-center mb-4">
              <Trophy className="w-7 h-7 text-pink-400" />
            </div>
            <h3 className="text-xl font-bold mb-2">Quiz Musicali</h3>
            <p className="text-zinc-400">
              Ingaggia i clienti con sfide musicali tra un cantante e l'altro.
            </p>
          </div>
        </div>
      </div>

      {/* Unified Auth Modal */}
      <Dialog open={showAuthModal} onOpenChange={setShowAuthModal}>
        <DialogContent className="bg-zinc-900 border-zinc-800 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center text-xl">
              {authTab === "client" ? "Entra nel Pub" : "Accesso Regia"}
            </DialogTitle>
          </DialogHeader>

          <Tabs value={authTab} onValueChange={setAuthTab} className="mt-4">
            <TabsList className="grid w-full grid-cols-2 bg-zinc-800 mb-6">
              <TabsTrigger value="client">Cliente</TabsTrigger>
              <TabsTrigger value="admin">Gestore</TabsTrigger>
            </TabsList>

            <TabsContent value="client" className="space-y-4 animate-in slide-in-from-left-2">
              <form onSubmit={handleClientJoin} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-500 uppercase">Codice Pub</label>
                  <Input
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    placeholder="Es: AB12CD"
                    className="bg-zinc-800 border-zinc-700 h-12 text-lg tracking-widest uppercase"
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-500 uppercase">Il tuo Nickname</label>
                  <Input
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    placeholder="Nome d'arte"
                    className="bg-zinc-800 border-zinc-700 h-12"
                  />
                </div>
                <Button 
                  type="submit" 
                  disabled={loading}
                  className="w-full h-12 bg-white text-black hover:bg-zinc-200"
                >
                  {loading ? "Ingresso..." : "Entra nel Pub"} <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="admin" className="space-y-4 animate-in slide-in-from-right-2">
              <form onSubmit={handleAdminLogin} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-500 uppercase">Email</label>
                  <Input
                    type="email"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    placeholder="admin@neonpub.com"
                    className="bg-zinc-800 border-zinc-700 h-12"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-500 uppercase">Password</label>
                  <Input
                    type="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="••••••••"
                    className="bg-zinc-800 border-zinc-700 h-12"
                  />
                </div>
                <Button 
                  type="submit" 
                  disabled={loading}
                  className="w-full h-12 bg-fuchsia-500 hover:bg-fuchsia-600"
                >
                  {loading ? "Verifica..." : "Accedi alla Regia"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Create Pub Modal (Only for Admin after login) */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle>Crea Nuovo Evento</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreatePub} className="space-y-4 pt-4">
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 mb-4">
              <p className="text-sm text-yellow-200">
                ⚠️ Non hai eventi attivi. Creane uno nuovo per iniziare.
              </p>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm text-zinc-400">Nome Evento</label>
              <Input
                value={newPubName}
                onChange={(e) => setNewPubName(e.target.value)}
                placeholder="Es: Karaoke Night"
                className="bg-zinc-800 border-zinc-700 h-12"
                autoFocus
              />
            </div>

            <Button 
              type="submit" 
              disabled={loading}
              className="w-full h-12 bg-gradient-to-r from-fuchsia-500 to-pink-500 hover:from-fuchsia-600 hover:to-pink-600"
            >
              {loading ? "Creazione..." : "Crea Evento (1 Gettone)"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}