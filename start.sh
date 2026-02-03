#!/bin/bash

# 🎤 NeonPub Karaoke - Script di Avvio Facile
# Usa questo script per avviare tutto con un comando

echo "🎤 NeonPub Karaoke - Avvio Automatico"
echo "======================================"

# Controlla se MongoDB è attivo
if ! pgrep -x "mongod" > /dev/null; then
    echo "⚠️  MongoDB non è attivo!"
    echo "Avvialo con: brew services start mongodb-community (Mac)"
    echo "           o: sudo systemctl start mongodb (Linux)"
    exit 1
fi

echo "✅ MongoDB attivo"

# Funzione per cleanup
cleanup() {
    echo ""
    echo "🛑 Chiusura applicazione..."
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    exit 0
}

trap cleanup SIGINT SIGTERM

# Avvia Backend
echo ""
echo "🐍 Avvio Backend..."
cd backend
source venv/bin/activate
uvicorn server:app --host 0.0.0.0 --port 8001 --reload &
BACKEND_PID=$!

# Aspetta che il backend si avvii
sleep 3

# Controlla se il backend è attivo
if ! curl -s http://localhost:8001/api/ > /dev/null; then
    echo "❌ Backend non si è avviato correttamente"
    kill $BACKEND_PID
    exit 1
fi

echo "✅ Backend attivo su http://localhost:8001"

# Avvia Frontend
echo ""
echo "⚛️  Avvio Frontend..."
cd ../frontend
npm start &
FRONTEND_PID=$!

echo ""
echo "✅ Applicazione avviata!"
echo ""
echo "📱 Apri: http://localhost:3000"
echo ""
echo "Per fermare: premi CTRL+C"
echo ""

# Mantieni lo script attivo
wait
