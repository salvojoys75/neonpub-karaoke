import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Mic2, Send, Upload, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { joinPub, getPub, uploadAvatar } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

// Avatar predefiniti generati con DiceBear
const DEFAULT_AVATARS = [
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Aneka",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Bob",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Lucy",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Max",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Mia",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Charlie",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Sophie",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Jack",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Emma",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Oliver",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Lily"
];

export default function JoinRedirect() {
  const { pubCode } = useParams();
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuth();
  
  const [pubName, setPubName] = useState("");
  const [nickname, setNickname] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  
  // Stati per avatar
  const [selectedAvatar, setSelectedAvatar] = useState(DEFAULT_AVATARS[0]);
  const [customAvatarFile, setCustomAvatarFile] = useState(null);
  const [customAvatarPreview, setCustomAvatarPreview] = useState(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

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

// Gestione upload foto personalizzata
const handleAvatarUpload = (e) => {
  const file = e.target.files[0];
  if (!file) return;

  // Validazione
  if (!file.type.startsWith('image/')) {
    toast.error("Solo immagini!");
    return;
  }

  if (file.size > 5 * 1024 * 1024) { // 5MB max
    toast.error("Immagine troppo grande! Max 5MB");
    return;
  }

  setCustomAvatarFile(file);

  // Preview locale
  const reader = new FileReader();
  reader.onloadend = () => {
    setCustomAvatarPreview(reader.result);
    setSelectedAvatar(null); // Deseleziona avatar predefiniti
  };
  reader.readAsDataURL(file);
};

const handleJoin = async (e) => {
  e.preventDefault();
  if (!nickname.trim()) {
    toast.error("Inserisci il tuo nickname");
    return;
  }
  
  setSubmitting(true);
  try {
    let avatarUrl = selectedAvatar;

    // Upload foto personalizzata se presente
    if (customAvatarFile) {
      setUploadingAvatar(true);
      try {
        avatarUrl = await uploadAvatar(customAvatarFile);
        toast.success("Avatar caricato!");
      } catch (error) {
        console.error("Errore upload avatar:", error);
        toast.warning("Errore upload avatar, uso predefinito");
        avatarUrl = DEFAULT_AVATARS[0]; // Fallback
      }
      setUploadingAvatar(false);
    }

    // Join con avatar
    const { data } = await joinPub({ 
      pub_code: pubCode.toUpperCase(), 
      nickname,
      avatar_url: avatarUrl 
    });
    
    // Controllo sicurezza: se manca token o user, non crasha
    if (!data?.token || !data?.user) {
      throw new Error("Risposta dal server incompleta");
    }

    localStorage.setItem("discojoys_pub_code", pubCode.toUpperCase());
    // Salviamo il token con la chiave che api.js si aspetta
    localStorage.setItem("discojoys_token", data.token);
    login(data.token, data.user);
    toast.success(`Benvenuto ${nickname}!`);
    navigate("/app");
  } catch (error) {
    console.error("Errore join:", error);
    toast.error(error.message || error.response?.data?.detail || "Errore di connessione");
  } finally {
    setSubmitting(false);
    setUploadingAvatar(false);
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
        <form onSubmit={handleJoin} className="space-y-6">
          {/* SEZIONE AVATAR */}
          <div className="space-y-4">
            <label className="text-sm text-zinc-400 font-medium">Scegli il tuo Avatar</label>
            
            {/* Avatar Predefiniti - Griglia 4x3 */}
            <div className="grid grid-cols-4 gap-2">
              {DEFAULT_AVATARS.map((avatar, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => {
                    setSelectedAvatar(avatar);
                    setCustomAvatarFile(null);
                    setCustomAvatarPreview(null);
                  }}
                  className={`w-full aspect-square rounded-xl overflow-hidden border-2 transition-all hover:scale-105 ${
                    selectedAvatar === avatar && !customAvatarPreview
                      ? 'border-fuchsia-500 shadow-[0_0_15px_rgba(192,38,211,0.5)]'
                      : 'border-zinc-700 hover:border-zinc-600'
                  }`}
                >
                  <img src={avatar} alt={`Avatar ${index + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>

            {/* Upload Foto Personale */}
            <div className="relative">
              <input
                type="file"
                id="avatar-upload"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
              />
              <label
                htmlFor="avatar-upload"
                className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 border-dashed cursor-pointer transition-all ${
                  customAvatarPreview
                    ? 'border-fuchsia-500 bg-fuchsia-500/10'
                    : 'border-zinc-700 hover:border-zinc-600 hover:bg-zinc-800/50'
                }`}
              >
                {customAvatarPreview ? (
                  <div className="flex items-center gap-3">
                    <img 
                      src={customAvatarPreview} 
                      alt="Preview" 
                      className="w-10 h-10 rounded-full object-cover border-2 border-fuchsia-500"
                    />
                    <span className="text-xs text-fuchsia-400 font-medium">Foto caricata ✓</span>
                  </div>
                ) : (
                  <>
                    <Upload className="w-4 h-4 text-zinc-400" />
                    <span className="text-xs text-zinc-400">Oppure carica la tua foto</span>
                  </>
                )}
              </label>
            </div>

            {/* Preview Avatar Selezionato */}
            <div className="flex items-center justify-center py-2">
              <div className="relative">
                <div className="w-20 h-20 rounded-full overflow-hidden border-4 border-fuchsia-500/50 shadow-xl">
                  <img 
                    src={customAvatarPreview || selectedAvatar} 
                    alt="Selected avatar" 
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-fuchsia-600 rounded-full flex items-center justify-center">
                  <User className="w-4 h-4 text-white" />
                </div>
              </div>
            </div>
          </div>

          {/* NICKNAME */}
          <div className="space-y-2">
            <label className="text-sm text-zinc-400">Il tuo Nickname</label>
            <Input
              data-testid="join-nickname-input"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Come ti chiami?"
              className="bg-zinc-800/50 border-zinc-700 text-lg py-6"
              maxLength={20}
            />
          </div>
          
          <Button 
            data-testid="join-submit-btn"
            type="submit" 
            disabled={submitting || uploadingAvatar}
            className="w-full rounded-full bg-fuchsia-500 hover:bg-fuchsia-600 py-6 text-lg"
          >
            {uploadingAvatar ? (
              "Caricamento avatar..."
            ) : submitting ? (
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