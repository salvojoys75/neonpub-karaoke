import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Mic2, ShieldCheck, Tv, QrCode, Music, Users, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { joinPub, adminLogin, createPub } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export default function LandingPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authTab, setAuthTab] = useState("join");
  const [loading, setLoading] = useState(false);
  
  // Join form
  const [pubCode, setPubCode] = useState("");
  const [nickname, setNickname] = useState("");
  
  // Admin form
  const [adminPubCode, setAdminPubCode] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  
  // Create pub form
  const [newPubName, setNewPubName] = useState("");
  const [newPubPassword, setNewPubPassword] = useState("");

  // Saved pubs (for admin)
  const [savedPubs, setSavedPubs] = useState([]);

  // Check if there's a pub code in URL (from QR scan)
  useEffect(() => {
    const codeFromUrl = searchParams.get("code");
    if (codeFromUrl) {
      setPubCode(codeFromUrl.toUpperCase());
      setAuthTab("join");
      setShowAuthModal(true);
    }
  }, [searchParams]);

  // Load saved pubs from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("neonpub_my_pubs");
    if (saved) {
      try {
        setSavedPubs(JSON.parse(saved));
      } catch (e) {
        console.error("Error loading saved pubs:", e);
      }
    }
  }, []);

  const savePubToStorage = (pub) => {
    const saved = localStorage.getItem("neonpub_my_pubs");
    let pubs = [];
    if (saved) {
      try {
        pubs = JSON.parse(saved);
      } catch (e) {}
    }
    // Add if not already exists
    if (!pubs.find(p => p.code === pub.code)) {
      pubs.push({ name: pub.name, code: pub.code, createdAt: new Date().toISOString() });
      localStorage.setItem("neonpub_my_pubs", JSON.stringify(pubs));
      setSavedPubs(pubs);
    }
  };

  const removeSavedPub = (code) => {
    const newPubs = savedPubs.filter(p => p.code !== code);
    localStorage.setItem("neonpub_my_pubs", JSON.stringify(newPubs));
    setSavedPubs(newPubs);
    toast.success("Pub rimosso dalla lista");
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    if (!pubCode.trim() || !nickname.trim()) {
      toast.error("Inserisci codice pub e nickname");
      return;
    }
    
    setLoading(true);
    try {
      const { data } = await joinPub({ pub_code: pubCode.toUpperCase(), nickname });
      localStorage.setItem("neonpub_pub_code", pubCode.toUpperCase());
      login(data.token, data.user);
      toast.success(`Benvenuto ${nickname}!`);
      navigate("/app");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Errore di connessione");
    } finally {
      setLoading(false);
    }
  };

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    if (!adminPubCode.trim() || !adminPassword.trim()) {
      toast.error("Inserisci codice pub e password");
      return;
    }
    
    setLoading(true);
    try {
      const { data } = await adminLogin({ pub_code: adminPubCode.toUpperCase(), password: adminPassword });
      localStorage.setItem("neonpub_pub_code", adminPubCode.toUpperCase());
      login(data.token, data.user);
      toast.success("Accesso admin effettuato!");
      navigate("/admin");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Password errata");
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePub = async (e) => {
    e.preventDefault();
    if (!newPubName.trim() || !newPubPassword.trim()) {
      toast.error("Inserisci nome e password per il pub");
      return;
    }
    
    setLoading(true);
    try {
      const { data } = await createPub({ name: newPubName, admin_password: newPubPassword });
      // Save to localStorage
      savePubToStorage(data);
      toast.success(`Pub "${data.name}" creato! Codice: ${data.code}`);
      setAdminPubCode(data.code);
      setAdminPassword(newPubPassword);
      setAuthTab("admin");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Errore nella creazione");
    } finally {
      setLoading(false);
    }
  };

  const selectSavedPub = (pub) => {
    setAdminPubCode(pub.code);
    setAuthTab("admin");
  };

  return (
    <div className="min-h-screen hero-gradient flex flex-col">
      {/* Header */}
      <header className="p-6 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-fuchsia-500 flex items-center justify-center neon-primary">
            <Mic2 className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-xl tracking-tight">NeonPub</span>
        </div>
        <Button 
          data-testid="header-login-btn"
          onClick={() => setShowAuthModal(true)}
          className="rounded-full bg-fuchsia-500 hover:bg-fuchsia-600 text-white px-6"
        >
          Entra
        </Button>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 pb-20">
        <div className="max-w-4xl text-center space-y-8 animate-fade-in-up">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black leading-tight">
            Karaoke + Quiz<br />
            <span className="gradient-text">Una serata indimenticabile</span>
          </h1>
          
          <p className="text-lg text-zinc-400 max-w-2xl mx-auto">
            Trasforma il tuo pub in un palcoscenico. I clienti cantano, votano, giocano a quiz 
            e mandano reazioni in tempo reale. Tu controlli tutto dalla regia.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <Button 
              data-testid="join-pub-btn"
              onClick={() => { setAuthTab("join"); setShowAuthModal(true); }}
              size="lg"
              className="rounded-full bg-fuchsia-500 hover:bg-fuchsia-600 text-white px-8 py-6 text-lg btn-primary"
            >
              <QrCode className="w-5 h-5 mr-2" />
              Entra nel Pub
            </Button>
            <Button 
              data-testid="admin-access-btn"
              onClick={() => { setAuthTab("admin"); setShowAuthModal(true); }}
              size="lg"
              variant="outline"
              className="rounded-full border-white/20 hover:bg-white/10 text-white px-8 py-6 text-lg"
            >
              <ShieldCheck className="w-5 h-5 mr-2" />
              Accesso Regia
            </Button>
          </div>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-20 max-w-4xl w-full">
          <div className="glass rounded-2xl p-6 space-y-3">
            <div className="w-12 h-12 rounded-xl bg-fuchsia-500/20 flex items-center justify-center">
              <Music className="w-6 h-6 text-fuchsia-400" />
            </div>
            <h3 className="font-bold text-lg">Karaoke Live</h3>
            <p className="text-sm text-zinc-400">Video YouTube automatici, playlist gestita dalla regia</p>
          </div>
          
          <div className="glass rounded-2xl p-6 space-y-3">
            <div className="w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center">
              <Users className="w-6 h-6 text-cyan-400" />
            </div>
            <h3 className="font-bold text-lg">Interazione Live</h3>
            <p className="text-sm text-zinc-400">Reazioni, voti e messaggi dal pubblico in tempo reale</p>
          </div>
          
          <div className="glass rounded-2xl p-6 space-y-3">
            <div className="w-12 h-12 rounded-xl bg-yellow-500/20 flex items-center justify-center">
              <Tv className="w-6 h-6 text-yellow-400" />
            </div>
            <h3 className="font-bold text-lg">Quiz Musicali</h3>
            <p className="text-sm text-zinc-400">Sfide a quiz tra un'esibizione e l'altra</p>
          </div>
        </div>
      </main>

      {/* Auth Modal */}
      <Dialog open={showAuthModal} onOpenChange={setShowAuthModal}>
        <DialogContent className="bg-zinc-900 border-zinc-800 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center text-xl">
              {authTab === "join" && "Entra nel Pub"}
              {authTab === "admin" && "Accesso Regia"}
              {authTab === "create" && "Crea Nuovo Pub"}
            </DialogTitle>
          </DialogHeader>

          <Tabs value={authTab} onValueChange={setAuthTab} className="mt-4">
            <TabsList className="grid grid-cols-3 bg-zinc-800">
              <TabsTrigger value="join" data-testid="tab-join">Cliente</TabsTrigger>
              <TabsTrigger value="admin" data-testid="tab-admin">Admin</TabsTrigger>
              <TabsTrigger value="create" data-testid="tab-create">Nuovo</TabsTrigger>
            </TabsList>

            <TabsContent value="join" className="mt-6">
              <form onSubmit={handleJoin} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm text-zinc-400">Codice Pub</label>
                  <Input
                    data-testid="join-pub-code-input"
                    value={pubCode}
                    onChange={(e) => setPubCode(e.target.value.toUpperCase())}
                    placeholder="Scansiona QR o inserisci codice"
                    className="bg-zinc-800 border-zinc-700 uppercase"
                    maxLength={8}
                  />
                  <p className="text-xs text-zinc-500">💡 Scansiona il QR sul display del pub per entrare automaticamente!</p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-zinc-400">Il tuo Nickname</label>
                  <Input
                    data-testid="join-nickname-input"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    placeholder="Come ti chiami?"
                    className="bg-zinc-800 border-zinc-700"
                    maxLength={20}
                  />
                </div>
                <Button 
                  data-testid="join-submit-btn"
                  type="submit" 
                  disabled={loading}
                  className="w-full rounded-full bg-fuchsia-500 hover:bg-fuchsia-600"
                >
                  {loading ? "Connessione..." : "Entra"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="admin" className="mt-6">
              {/* Saved Pubs */}
              {savedPubs.length > 0 && (
                <div className="mb-6">
                  <label className="text-sm text-zinc-400 mb-2 block">I Tuoi Pub</label>
                  <div className="space-y-2">
                    {savedPubs.map(pub => (
                      <div 
                        key={pub.code}
                        className="glass rounded-xl p-3 flex items-center justify-between group"
                      >
                        <button
                          type="button"
                          onClick={() => selectSavedPub(pub)}
                          className="flex-1 text-left"
                        >
                          <p className="font-medium">{pub.name}</p>
                          <p className="text-xs text-cyan-400 mono">{pub.code}</p>
                        </button>
                        <button
                          type="button"
                          onClick={() => removeSavedPub(pub.code)}
                          className="p-2 text-zinc-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-zinc-800 mt-4 pt-4">
                    <p className="text-xs text-zinc-500 text-center">oppure inserisci manualmente</p>
                  </div>
                </div>
              )}

              <form onSubmit={handleAdminLogin} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm text-zinc-400">Codice Pub</label>
                  <Input
                    data-testid="admin-pub-code-input"
                    value={adminPubCode}
                    onChange={(e) => setAdminPubCode(e.target.value.toUpperCase())}
                    placeholder="ES: ABC12345"
                    className="bg-zinc-800 border-zinc-700 uppercase"
                    maxLength={8}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-zinc-400">Password Admin</label>
                  <Input
                    data-testid="admin-password-input"
                    type="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="••••••••"
                    className="bg-zinc-800 border-zinc-700"
                  />
                </div>
                <Button 
                  data-testid="admin-submit-btn"
                  type="submit" 
                  disabled={loading}
                  className="w-full rounded-full bg-cyan-500 hover:bg-cyan-600"
                >
                  {loading ? "Accesso..." : "Accedi"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="create" className="mt-6">
              <form onSubmit={handleCreatePub} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm text-zinc-400">Nome del Pub</label>
                  <Input
                    data-testid="create-pub-name-input"
                    value={newPubName}
                    onChange={(e) => setNewPubName(e.target.value)}
                    placeholder="Es: Rock Cafe"
                    className="bg-zinc-800 border-zinc-700"
                    maxLength={50}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-zinc-400">Password Admin</label>
                  <Input
                    data-testid="create-pub-password-input"
                    type="password"
                    value={newPubPassword}
                    onChange={(e) => setNewPubPassword(e.target.value)}
                    placeholder="Scegli una password sicura"
                    className="bg-zinc-800 border-zinc-700"
                  />
                </div>
                <Button 
                  data-testid="create-pub-submit-btn"
                  type="submit" 
                  disabled={loading}
                  className="w-full rounded-full bg-yellow-500 hover:bg-yellow-600 text-black"
                >
                  {loading ? "Creazione..." : "Crea Pub"}
                </Button>
                <p className="text-xs text-zinc-500 text-center">
                  Il pub creato verrà salvato in questo browser
                </p>
              </form>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}
