import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Mic2, Sparkles, Music, Trophy, LogIn, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/lib/supabase";
import { createPub } from "@/lib/api";

export default function LandingPage() {
  const navigate = useNavigate();
  
  // Stati per Utente Finale (Giocatore)
  const [roomCode, setRoomCode] = useState("");

  // Stati per Admin/Operatore
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authTab, setAuthTab] = useState("login"); // 'login' o 'register' se serve in futuro
  const [loading, setLoading] = useState(false);

  // Admin Login Inputs
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");

  // Create Pub (Gestito post-login o se admin loggato)
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPubName, setNewPubName] = useState("");

  // --- LOGICA UTENTE FINALE ---
  const handleJoin = (e) => {
    e.preventDefault();
    if (!roomCode.trim()) {
      toast.error("Inserisci il codice della stanza");
      return;
    }
    // Naviga alla pagina di redirect che gestisce l'ingresso
    navigate(`/join/${roomCode.toUpperCase()}`);
  };

  // --- LOGICA OPERATORE / ADMIN ---
  const handleAdminLogin = async (e) => {
    e.preventDefault();
    if (!adminEmail.trim() || !adminPassword.trim()) {
      toast.error("Inserisci email e password");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: adminEmail,
        password: adminPassword
      });

      if (error) throw error;

      toast.success("Bentornato!");
      setShowAuthModal(false);
      // Una volta loggato, mandalo alla dashboard di regia
      navigate("/admin");
    } catch (error) {
      toast.error(error.message || "Credenziali non valide");
    } finally {
      setLoading(false);
    }
  };

  // Manteniamo la logica di creazione pub, ma idealmente andrebbe spostata dentro la AdminDashboard
  const handleCreatePub = async (e) => {
    e.preventDefault();
    if (!newPubName.trim()) {
      toast.error("Inserisci nome pub");
      return;
    }

    setLoading(true);
    try {
      const { data } = await createPub({ name: newPubName });
      toast.success(`Evento "${data.name}" creato!`);
      setShowCreateModal(false);
      localStorage.setItem("neonpub_pub_code", data.code);
      navigate(`/admin`);
    } catch (error) {
      if (error.message === 'No credits available') {
        toast.error("Nessun gettone disponibile");
      } else if (error.message === 'Not authenticated') {
        toast.error("Devi fare login prima");
        setShowCreateModal(false);
        setShowAuthModal(true);
      } else {
        toast.error("Errore nella creazione");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen hero-gradient relative">
      
      {/* --- HEADER / TOP BAR --- */}
      <div className="absolute top-0 left-0 w-full p-6 flex justify-between items-center z-10">
        <div className="flex items-center gap-2">
           {/* Piccolo logo testuale o icona se vuoi */}
           <span className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-400 to-cyan-400">
             NEONPUB
           </span>
        </div>
        
        {/* Pulsante Accesso Operatori (Discreto) */}
        <Button 
          variant="ghost" 
          size="sm"
          onClick={() => setShowAuthModal(true)}
          className="text-zinc-400 hover:text-white hover:bg-white/10 text-xs uppercase tracking-wider"
        >
          <LogIn className="w-4 h-4 mr-2" />
          Area Operatori
        </Button>
      </div>

      {/* --- HERO SECTION (LATO UTENTE) --- */}
      <div className="container mx-auto px-6 pt-32 pb-20 flex flex-col items-center justify-center min-h-[80vh]">
        
        {/* Logo/Icona Centrale */}
        <div className="mb-8 relative">
          <div className="w-32 h-32 rounded-full bg-fuchsia-500/20 flex items-center justify-center neon-primary animate-pulse-slow">
            <Mic2 className="w-16 h-16 text-fuchsia-400" />
          </div>
          <div className="absolute -bottom-2 -right-2 w-12 h-12 rounded-full bg-cyan-500/20 flex items-center justify-center neon-secondary">
             <Sparkles className="w-6 h-6 text-cyan-400" />
          </div>
        </div>

        <h1 className="text-5xl md:text-7xl font-bold mb-6 tracking-tight text-center">
          Pronto a <span className="text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-400 to-pink-500">Cantare?</span>
        </h1>
        
        <p className="text-xl text-zinc-400 mb-10 max-w-lg mx-auto text-center">
          Inserisci il codice che vedi sullo schermo del locale per unirti alla festa, votare e sfidare gli amici.
        </p>

        {/* --- FORM DI INGRESSO UTENTE --- */}
        <div className="w-full max-w-md bg-zinc-900/50 backdrop-blur-md p-2 rounded-2xl border border-white/10 shadow-2xl">
          <form onSubmit={handleJoin} className="flex gap-2">
            <Input 
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              placeholder="CODICE STANZA (es. A1B2)" 
              className="bg-transparent border-none text-white placeholder:text-zinc-600 h-14 text-lg font-mono uppercase tracking-widest focus-visible:ring-0 focus-visible:ring-offset-0"
              maxLength={4}
            />
            <Button 
              type="submit" 
              size="lg"
              className="h-14 px-8 rounded-xl bg-gradient-to-r from-fuchsia-600 to-pink-600 hover:from-fuchsia-500 hover:to-pink-500 text-white font-bold text-lg shadow-lg shadow-fuchsia-500/20"
            >
              GIOCA <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </form>
        </div>
        
        <p className="mt-6 text-sm text-zinc-500">
          Oppure inquadra il QR Code presente nel locale
        </p>

        {/* Features visive (Decorative) */}
        <div className="grid grid-cols-3 gap-8 mt-20 opacity-60">
           <div className="flex flex-col items-center gap-2">
              <Music className="w-6 h-6 text-zinc-400" />
              <span className="text-xs text-zinc-500 uppercase tracking-widest">Karaoke</span>
           </div>
           <div className="flex flex-col items-center gap-2">
              <Trophy className="w-6 h-6 text-zinc-400" />
              <span className="text-xs text-zinc-500 uppercase tracking-widest">Quiz</span>
           </div>
           <div className="flex flex-col items-center gap-2">
              <Sparkles className="w-6 h-6 text-zinc-400" />
              <span className="text-xs text-zinc-500 uppercase tracking-widest">Vota</span>
           </div>
        </div>
      </div>

      {/* --- MODAL LOGIN OPERATORI --- */}
      <Dialog open={showAuthModal} onOpenChange={setShowAuthModal}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle>Accesso Regia / Operatori</DialogTitle>
          </DialogHeader>

          <Tabs value={authTab} onValueChange={setAuthTab}>
            <TabsList className="grid w-full grid-cols-1 bg-zinc-800">
              <TabsTrigger value="login">Login</TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="space-y-4">
              <form onSubmit={handleAdminLogin} className="space-y-4">
                <div>
                  <label className="text-sm text-zinc-400">Email Aziendale</label>
                  <Input
                    type="email"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    placeholder="operatore@neonpub.com"
                    className="bg-zinc-800 border-zinc-700"
                  />
                </div>

                <div>
                  <label className="text-sm text-zinc-400">Password</label>
                  <Input
                    type="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="••••••••"
                    className="bg-zinc-800 border-zinc-700"
                  />
                </div>

                <Button 
                  type="submit" 
                  disabled={loading}
                  className="w-full bg-fuchsia-600 hover:bg-fuchsia-500"
                >
                  {loading ? "Verifica..." : "Entra in Console"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* --- MODAL CREAZIONE (Opzionale qui, meglio in dashboard) --- */}
      {/* 
         Ho lasciato questo modal nel codice ma nascosto l'accesso diretto 
         perché la creazione dovrebbe avvenire dentro la dashboard dopo il login.
      */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle>Crea Nuovo Evento</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreatePub} className="space-y-4">
            <div>
              <label className="text-sm text-zinc-400">Nome Evento</label>
              <Input
                value={newPubName}
                onChange={(e) => setNewPubName(e.target.value)}
                placeholder="Es: Serata Sabato"
                className="bg-zinc-800 border-zinc-700"
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full bg-fuchsia-600">
              Crea Evento
            </Button>
          </form>
        </DialogContent>
      </Dialog>

    </div>
  );
}