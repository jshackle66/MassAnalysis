import os
import json
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import glob
import re

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class Annotation(BaseModel):
    priest: str

SCRIPT_DIR = os.path.dirname(os.path.realpath(__file__))
DATA_DIR = os.path.abspath(os.path.join(SCRIPT_DIR, "..", "..", "s3_downloads"))
LABEL_SUFFIX = "_priest_label.txt"
AUDIO_SUFFIX = ".mp3"

def get_date_from_path(path):
    """Extracts date from a path like '2025/6/30/GoH/...'"""
    match = re.search(r'(\d{4}/\d{1,2}/\d{1,2})', path)
    return match.group(1) if match else "No Date"

@app.get("/api/masses")
async def get_masses():
    """
    Scans the data directory for priest label files (.txt) and returns a list of masses.
    """
    masses = []
    search_path = os.path.join(DATA_DIR, '**/*' + LABEL_SUFFIX)
    label_files = glob.glob(search_path, recursive=True)

    for file_path in label_files:
        try:
            with open(file_path, 'r') as f:
                priest_name = f.read().strip()
                if not priest_name:
                    priest_name = "Unknown"

            relative_path = os.path.relpath(file_path, DATA_DIR)
            mass_id = relative_path.replace(LABEL_SUFFIX, "")
            
            masses.append({
                "id": mass_id.replace(os.path.sep, '_'), # Create a URL-safe ID
                "path": mass_id, # Keep the original path for lookups
                "priest": priest_name,
                "date": get_date_from_path(mass_id),
            })
        except Exception as e:
            print(f"Skipping file {file_path} due to error: {e}")
            continue

    masses.sort(key=lambda x: (x['priest'] == 'Unknown', x['date']), reverse=True)
    return masses

@app.get("/api/priests")
async def get_priests():
    """
    Scans all data files to compile a unique list of known priest names.
    """
    priests = set()
    search_path = os.path.join(DATA_DIR, '**/*' + LABEL_SUFFIX)
    label_files = glob.glob(search_path, recursive=True)
    for file_path in label_files:
        try:
            with open(file_path, 'r') as f:
                priest_name = f.read().strip()
                if priest_name and priest_name != "Unknown":
                    priests.add(priest_name)
        except Exception:
            continue
    return sorted(list(priests))


@app.get("/api/audio/{mass_path:path}")
async def get_audio(mass_path: str):
    """
    Serves the audio file for the specified mass path.
    """
    # The path comes from the 'path' field in the mass object
    audio_path_base = os.path.join(DATA_DIR, mass_path)
    
    # The user example was `14-01-27_homily.mp3`
    # The ID is `2025/6/30/GoH/14-01-27_homily`
    # So we need to find the audio file based on the base name
    audio_file = audio_path_base + ".mp3" # Assuming mp3 based on user feedback

    if not os.path.exists(audio_file):
        # Fallback for other audio types if needed
        for ext in [".wav", ".m4a", ".aac"]:
            if os.path.exists(audio_path_base + ext):
                audio_file = audio_path_base + ext
                break
        else: # If no loop break
             raise HTTPException(status_code=404, detail=f"Audio file not found at {audio_file}")

    return FileResponse(audio_file)

@app.post("/api/masses/{mass_path:path}/annotate")
async def annotate_mass(mass_path: str, annotation: Annotation):
    """
    Updates the priest label for a specific mass.
    """
    label_path = os.path.join(DATA_DIR, mass_path + LABEL_SUFFIX)
    if not os.path.exists(label_path):
        raise HTTPException(status_code=404, detail=f"Label file not found at {label_path}")

    with open(label_path, 'w') as f:
        f.write(annotation.priest)

    return {"status": "success", "mass_path": mass_path, "new_priest": annotation.priest}

@app.get("/")
async def root():
    return {"message": "Welcome to the Mass Annotation Tool API"}