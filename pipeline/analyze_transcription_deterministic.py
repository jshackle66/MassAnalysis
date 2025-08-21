import json
import sys

def analyze_transcription(transcription_data):
    """
    Analyzes a transcription of a Catholic Mass to identify different parts of the Mass
    using a deterministic algorithm based on keywords.

    Args:
        transcription_data (dict): A dictionary containing the transcription, with a key
                                   "chunks" that holds a list of segments. Each segment
                                   is a dictionary with "timestamp" ([start, end]) and "text".

    Returns:
        dict: A dictionary where keys are the parts of the Mass and values are the start times.
    """
    with open("./pipeline/mass_keywords.json", "r") as f:
        mass_keywords = json.load(f)

    mass_parts_ordered = [
        "beginning_of_mass",
        "gloria",
        "first_reading",
        "gospel",
        "homily",
        "creed",
        "prayers_of_the_faithful",
        "eucharistic_prayer",
        "distribution_of_communion",
        "end_of_mass"
    ]

    detected_parts = {}
    last_timestamp = -1

    for part_name in mass_parts_ordered:
        keywords = mass_keywords.get(part_name, [])
        
        found_part = False
        for segment in transcription_data["chunks"]:
            # The timestamp is a list [start, end]
            timestamp_start = segment.get("timestamp", [0, None])[0]
            
            if timestamp_start is None:
                continue

            # Ensure we are looking for the part after the last detected part
            if timestamp_start <= last_timestamp:
                continue

            text = segment.get("text", "").lower()
            for keyword in keywords:
                if keyword.lower() in text:
                    detected_parts[part_name] = timestamp_start
                    last_timestamp = timestamp_start
                    found_part = True
                    break
            if found_part:
                break

    return detected_parts

if __name__ == '__main__':
    if len(sys.argv) > 1:
        transcription_file = sys.argv[1]
        with open(transcription_file, 'r') as f:
            # The transcription from whisperx is a json file with a 'chunks' key
            data = json.load(f)
        
        analysis = analyze_transcription_deterministic(data)
        print(json.dumps(analysis, indent=2))
    else:
        print("Usage: python analyze_transcription_deterministic.py <path_to_transcription.json>")
