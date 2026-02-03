# 🎤 NeonPub Karaoke - Guida Installazione Locale

## Requisiti
- **Node.js** v18+ (https://nodejs.org)
- **Python** 3.9+ (https://python.org)
- **MongoDB** (https://mongodb.com/try/download/community)

## Struttura File da Scaricare
```
neonpub-karaoke/
├── backend/
│   ├── server.py          # Server FastAPI
│   ├── requirements.txt   # Dipendenze Python
│   └── .env              # Configurazione
├── frontend/
│   ├── src/              # Codice React
│   ├── public/
│   ├── package.json      # Dipendenze Node
│   ├── craco.config.js
│   └── .env              # URL Backend
└── ISTRUZIONI_LOCALE.md  # Questa guida
```

## Passo 1: Installa MongoDB

### Windows
1. Scarica MongoDB Community da https://mongodb.com/try/download/community
2. Installa con le opzioni di default
3. MongoDB partirà automaticamente come servizio

### Mac
```bash
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb-community
```

### Linux (Ubuntu/Debian)
```bash
sudo apt install mongodb
sudo systemctl start mongodb
```

## Passo 2: Setup Backend

```bash
cd backend

# Crea ambiente virtuale Python
python -m venv venv

# Attiva ambiente virtuale
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

# Installa dipendenze
pip install -r requirements.txt

# Avvia server
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

Il backend sarà disponibile su http://localhost:8001

## Passo 3: Setup Frontend

```bash
cd frontend

# Installa dipendenze
npm install
# oppure
yarn install

# Avvia frontend
npm start
# oppure
yarn start
```

Il frontend sarà disponibile su http://localhost:3000

## Passo 4: Configura .env Files

### backend/.env
```
MONGO_URL="mongodb://localhost:27017"
DB_NAME="neonpub_karaoke"
CORS_ORIGINS="*"
YOUTUBE_API_KEY=LA_TUA_CHIAVE_YOUTUBE
```

### frontend/.env
```
REACT_APP_BACKEND_URL=http://localhost:8001
```

## Come Usare

1. Apri http://localhost:3000
2. Crea un nuovo pub come Admin
3. Apri un'altra scheda/browser per entrare come Cliente
4. Scansiona il QR o usa il codice pub

## Test API con curl

```bash
# Crea pub
curl -X POST http://localhost:8001/api/pub/create \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Pub","admin_password":"test123"}'

# Cerca video karaoke
curl "http://localhost:8001/api/youtube/search?title=Bohemian+Rhapsody&artist=Queen" \
  -H "Authorization: Bearer TOKEN_ADMIN"
```

## Troubleshooting

### MongoDB non si connette
- Verifica che MongoDB sia in esecuzione
- Controlla che la porta 27017 sia libera

### Frontend non carica
- Verifica che il backend sia in esecuzione sulla porta 8001
- Controlla che `REACT_APP_BACKEND_URL` sia corretto

### WebSocket non funziona
- In locale, usa `ws://localhost:8001` non `wss://`
- Il file WebSocketContext.js gestisce automaticamente http/https

## File Principali

| File | Descrizione |
|------|-------------|
| backend/server.py | Tutto il backend (API + WebSocket) |
| frontend/src/pages/ClientApp.js | App per i clienti |
| frontend/src/pages/AdminDashboard.js | Dashboard admin |
| frontend/src/pages/PubDisplay.js | Schermo pub |
| frontend/src/context/WebSocketContext.js | Gestione WebSocket |
| frontend/src/context/AuthContext.js | Autenticazione |

