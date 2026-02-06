import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Mic2, Sparkles, Music, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/lib/supabase";
import { createPub } from "@/lib/api";

export default function LandingPage() {
  const navigate = useNavigate();
  
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authTab, setAuthTab] = useState("admin");
  const [loading, setLoading] = useState(false);

  // Admin Login
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");

  // Create Pub (after admin login)
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPubName, setNewPubName] = useState("");

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
      setShowAuthModal(false);
      navigate("/admin");
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
      setShowCreateModal(false);
      navigate(`/display/${data.code}`);
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

  const openCreateModal = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error("Devi fare login prima");
      setShowAuthModal(true);
      return;
    }
    setShowCreateModal(true);
  };

  return (
    <div className="min-h-screen hero-gradient">
      {/* Hero */}
      <div className="container mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <div className="flex justify-center mb-6">
            <div className="w-24 h-24 rounded-full bg-fuchsia-500/20 flex items-center justify-center neon-primary">
              <Mic2 className="w-12 h-12 text-fuchsia-400" />
            </div>
          </div>
          
          <h1 className="text-6xl font-bold mb-6 tracking-tight">
            <span className="text-white">Karaoke</span>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-400 to-cyan-400"> + Quiz</span>
          </h1>
          
          <p className="text-xl text-zinc-400 mb-8 max-w-2xl mx-auto">
            Trasforma il tuo locale in un'esperienza interattiva. Karaoke live e quiz musicali.
          </p>

          <div className="flex gap-4 justify-center">
            <Button 
              size="lg"
              onClick={openCreateModal}
              className="rounded-full bg-gradient-to-r from-fuchsia-500 to-pink-500 hover:from-fuchsia-600 hover:to-pink-600 text-lg px-8"
            >
              <Sparkles className="w-5 h-5 mr-2" />
              Crea Evento
            </Button>
            
            <Button 
              size="lg"
              variant="outline"
              onClick={() => setShowAuthModal(true)}
              className="rounded-full border-zinc-700 hover:bg-zinc-800 text-lg px-8"
            >
              Login Admin
            </Button>
          </div>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-8 mt-20">
          <div className="glass p-8 rounded-2xl">
            <div className="w-14 h-14 rounded-xl bg-fuchsia-500/20 flex items-center justify-center mb-4">
              <Music className="w-7 h-7 text-fuchsia-400" />
            </div>
            <h3 className="text-xl font-bold mb-2">Karaoke Live</h3>
            <p className="text-zinc-400">
              Richieste in tempo reale, playlist dinamica, voti del pubblico.
            </p>
          </div>

          <div className="glass p-8 rounded-2xl">
            <div className="w-14 h-14 rounded-xl bg-cyan-500/20 flex items-center justify-center mb-4">
              <Sparkles className="w-7 h-7 text-cyan-400" />
            </div>
            <h3 className="text-xl font-bold mb-2">Interazione Live</h3>
            <p className="text-zinc-400">
              Reazioni, messaggi e voti dal pubblico in tempo reale.
            </p>
          </div>

          <div className="glass p-8 rounded-2xl">
            <div className="w-14 h-14 rounded-xl bg-pink-500/20 flex items-center justify-center mb-4">
              <Trophy className="w-7 h-7 text-pink-400" />
            </div>
            <h3 className="text-xl font-bold mb-2">Quiz Musicali</h3>
            <p className="text-zinc-400">
              Sfida il pubblico con quiz tra un'esibizione e l'altra.
            </p>
          </div>
        </div>
      </div>

      {/* Auth Modal */}
      <Dialog open={showAuthModal} onOpenChange={setShowAuthModal}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle>Accesso Regia</DialogTitle>
          </DialogHeader>

          <Tabs value={authTab} onValueChange={setAuthTab}>
            <TabsList className="grid w-full grid-cols-1 bg-zinc-800">
              <TabsTrigger value="admin">Admin</TabsTrigger>
            </TabsList>

            <TabsContent value="admin" className="space-y-4">
              <form onSubmit={handleAdminLogin} className="space-y-4">
                <div>
                  <label className="text-sm text-zinc-400">Email</label>
                  <Input
                    type="email"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    placeholder="admin@neonpub.com"
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
                  className="w-full bg-fuchsia-500 hover:bg-fuchsia-600"
                >
                  {loading ? "Accesso..." : "Accedi"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Create Pub Modal */}
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
                placeholder="Es: Karaoke Night"
                className="bg-zinc-800 border-zinc-700"
                autoFocus
              />
            </div>

            <Button 
              type="submit" 
              disabled={loading}
              className="w-full bg-gradient-to-r from-fuchsia-500 to-pink-500 hover:from-fuchsia-600 hover:to-pink-600"
            >
              {loading ? "Creazione..." : "Crea Evento"}
            </Button>

            <p className="text-xs text-zinc-500 text-center">
              Verrà consumato 1 gettone
            </p>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
