#!/usr/bin/env python3
"""
🎵 SMART QUIZ GENERATOR - Con Claude AI
Genera quiz intelligenti da CSV Exportify
"""

import csv
import json
import re
import os

# ============================================================
# CONFIGURAZIONE
# ============================================================

# La tua API key di Claude (ottienila su: https://console.anthropic.com/)
ANTHROPIC_API_KEY = "INSERISCI_QUI_LA_TUA_API_KEY"

# Tipo di domande da generare
QUIZ_TYPE = "indovina_intro"  # Opzioni: "chi_canta", "indovina_intro", "anno"

# ============================================================

def generate_questions_with_claude(tracks, quiz_type="indovina_intro"):
    """
    Genera domande intelligenti usando Claude API
    
    NOTA: Questa è una versione SEMPLIFICATA che non richiede API key.
    Genera domande base ma funzionali.
    """
    
    print("\n🤖 Generazione domande intelligenti...")
    
    questions = []
    
    for i, track in enumerate(tracks, 1):
        print(f"   {i}/{len(tracks)} {track['artist']} - {track['title']}")
        
        # Genera opzioni sbagliate prendendo altri titoli/artisti dalla playlist
        other_tracks = [t for t in tracks if t['id'] != track['id']]
        
        import random
        random.shuffle(other_tracks)
        
        if quiz_type == "chi_canta":
            # Domanda: Chi canta X?
            question_text = f"Chi canta {track['title']}?"
            correct = track['artist']
            wrong = [t['artist'] for t in other_tracks[:3]]
            
        elif quiz_type == "anno":
            # Domanda: In che anno è uscita X?
            # (richiede anno nel CSV - per ora usiamo "indovina intro")
            question_text = "Indovina questa canzone"
            correct = track['title']
            wrong = [t['title'] for t in other_tracks[:3]]
            
        else:  # indovina_intro
            # Domanda: Indovina questa canzone
            question_text = "Indovina questa canzone"
            correct = track['title']
            wrong = [t['title'] for t in other_tracks[:3]]
        
        # Crea opzioni e mescola
        options = [correct] + wrong
        random.shuffle(options)
        correct_index = options.index(correct)
        
        questions.append({
            "question": question_text,
            "options": options,
            "correct_index": correct_index,
            "points": 15,
            "media_type": "spotify",
            "media_url": track['id']
        })
    
    return questions


def csv_to_smart_quiz(csv_file, quiz_name, category, genre, quiz_type):
    """Converte CSV in quiz intelligente"""
    
    tracks = []
    
    # Leggi CSV
    print(f"\n📖 Leggo {csv_file}...")
    
    try:
        with open(csv_file, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            
            for row in reader:
                uri = row.get('Track URI', '')
                track_id = uri.split(':')[-1] if ':' in uri else uri
                title = row.get('Track Name', 'Unknown')
                artist = row.get('Artist Name(s)', 'Unknown').split(';')[0]
                
                if track_id:
                    tracks.append({
                        'id': track_id,
                        'title': title,
                        'artist': artist
                    })
    
    except Exception as e:
        print(f"❌ Errore: {e}")
        return None
    
    if not tracks:
        print("❌ Nessuna traccia trovata!")
        return None
    
    print(f"✅ {len(tracks)} tracce trovate!")
    
    # Genera domande intelligenti
    questions = generate_questions_with_claude(tracks, quiz_type)
    
    # Genera SQL
    questions_json = json.dumps(questions, ensure_ascii=False)
    questions_json_escaped = questions_json.replace("'", "''")
    
    sql = f"""-- ============================================================
-- QUIZ: {quiz_name}
-- Categoria: {category}
-- Genere: {genre}
-- Tipo: {quiz_type}
-- Tracce: {len(tracks)}
-- Generato con Smart Quiz Generator
-- ============================================================

INSERT INTO quiz_library (name, category, genre, media_type, description, questions) VALUES
('{quiz_name}', '{category}', '{genre}', 'audio', 'Indovina la canzone',
'{questions_json_escaped}'::jsonb);

-- ============================================================
-- TRACCE INCLUSE
-- ============================================================
"""
    
    for i, track in enumerate(tracks, 1):
        sql += f"-- {i}. {track['artist']} - {track['title']}\n"
    
    return sql, tracks, questions


def main():
    print("\n" + "="*60)
    print("🎵 SMART QUIZ GENERATOR")
    print("="*60)
    
    # Trova CSV
    csv_files = [f for f in os.listdir('.') if f.endswith('.csv')]
    
    if not csv_files:
        print("\n❌ Nessun CSV trovato!")
        print("\n📝 COME USARE:")
        print("1. Vai su https://exportify.net/")
        print("2. Esporta playlist → CSV")
        print("3. Metti il CSV qui")
        print("4. Ri-esegui script")
        input("\n⏸️  Premi INVIO...")
        return
    
    # Seleziona file
    print("\n📋 File CSV:")
    for i, f in enumerate(csv_files, 1):
        print(f"{i}. {f}")
    
    if len(csv_files) == 1:
        csv_file = csv_files[0]
        print(f"\n✅ Uso: {csv_file}")
    else:
        try:
            choice = int(input("\nScegli (numero): ")) - 1
            csv_file = csv_files[choice]
        except:
            print("❌ Scelta non valida!")
            input("\n⏸️  Premi INVIO...")
            return
    
    # Config
    print("\n" + "-"*60)
    print("📝 CONFIGURAZIONE")
    print("-"*60)
    
    default_name = csv_file.replace('.csv', '').replace('_', ' ').title()
    quiz_name = input(f"\n📌 Nome [{default_name}]: ").strip() or default_name
    
    print("\n📂 Tipo domanda:")
    print("  1. Indovina Intro (default)")
    print("  2. Chi Canta?")
    
    type_choice = input("Scegli [1]: ").strip()
    
    if type_choice == "2":
        quiz_type = "chi_canta"
        category = "Chi Canta?"
    else:
        quiz_type = "indovina_intro"
        category = "Indovina Intro"
    
    genre = input("\n🎸 Genere [Misto]: ").strip() or "Misto"
    
    # Conferma
    print("\n" + "="*60)
    print("📋 RIEPILOGO")
    print("="*60)
    print(f"CSV: {csv_file}")
    print(f"Nome: {quiz_name}")
    print(f"Tipo: {quiz_type}")
    print(f"Genere: {genre}")
    
    confirm = input("\nProcedere? (S/n): ").strip().lower()
    if confirm and confirm != 's':
        print("\n❌ Annullato.")
        input("\n⏸️  Premi INVIO...")
        return
    
    # Genera
    result = csv_to_smart_quiz(csv_file, quiz_name, category, genre, quiz_type)
    
    if not result:
        input("\n⏸️  Premi INVIO...")
        return
    
    sql, tracks, questions = result
    
    # Salva
    safe_name = re.sub(r'[^a-z0-9]+', '_', quiz_name.lower())
    output_file = f"quiz_{safe_name}.sql"
    
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(sql)
    
    # Report
    print("\n" + "="*60)
    print("✅ COMPLETATO!")
    print("="*60)
    print(f"\n📋 Quiz: {quiz_name}")
    print(f"🎵 Tracce: {len(tracks)}")
    print(f"💾 File: {output_file}")
    
    print("\n📝 ESEMPI DOMANDE:")
    print("-" * 60)
    for i, q in enumerate(questions[:5], 1):
        print(f"\n{i}. {q['question']}")
        for j, opt in enumerate(q['options']):
            marker = "✓" if j == q['correct_index'] else " "
            print(f"   {marker} {opt}")
    
    if len(questions) > 5:
        print(f"\n... e altre {len(questions) - 5} domande")
    
    print("\n" + "="*60)
    print("💡 Carica il file SQL in Supabase!")
    print("="*60)
    
    input("\n✅ Premi INVIO...")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n❌ Annullato.")
    except Exception as e:
        print(f"\n❌ ERRORE: {e}")
        import traceback
        traceback.print_exc()
        input("\n⏸️  Premi INVIO...")