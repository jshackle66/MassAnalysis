import os
import glob
import subprocess
from pipeline import main as pipeline_main
from model import MassMetadata, MassAnalysisResult
import json

def main():
    s3_downloads_dir = "/home/john/Documents/MassAnalysis/s3_downloads"
    mp3_files = glob.glob(os.path.join(s3_downloads_dir, "**", "*.mp3"), recursive=True)

    results: List[MassAnalysisResult] = []

    for mp3_file in mp3_files:

        # Don't process cut mp3 files
        if "_cut" in mp3_file or "_homily" in mp3_file:
            continue
        print(f"Processing {mp3_file}...")

        result = pipeline_main(mp3_file, "ollama", "gemma3:12b-30k")
        results.append(result)
        print("\n" + "="*50 + "\n")
    
    # Save results to json file
    with open("results.json", "w") as f:
        json.dump([result.to_dict() for result in results], f, indent=4)

if __name__ == "__main__":
    main()
