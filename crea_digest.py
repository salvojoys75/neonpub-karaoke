import os

# Cartelle e file da ignorare
IGNORE_DIRS = {'.git', 'node_modules', '__pycache__', '.emergent', 'venv', '.idea', '.vscode'}
IGNORE_EXT = {'.png', '.jpg', '.jpeg', '.gif', '.ico', '.pyc', '.exe'}

output_file = "progetto_completo.txt"

with open(output_file, "w", encoding="utf-8") as outfile:
    for root, dirs, files in os.walk("."):
        # Rimuove le cartelle ignorate dalla ricerca
        dirs[:] = [d for d in dirs if d not in IGNORE_DIRS]
        
        for file in files:
            if any(file.endswith(ext) for ext in IGNORE_EXT):
                continue
            if file == "crea_digest.py" or file == output_file:
                continue

            path = os.path.join(root, file)
            outfile.write(f"\n{'='*20}\nFILE: {path}\n{'='*20}\n")
            
            try:
                with open(path, "r", encoding="utf-8") as infile:
                    outfile.write(infile.read())
            except Exception as e:
                outfile.write(f"[Errore nella lettura del file: {e}]")

print(f"Fatto! Carica il file '{output_file}' nella chat.")