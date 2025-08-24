import re
import os
import sys
import json
import pickle
import numpy as np
from pydub import AudioSegment
import torch
import time
from transformers import AutoModelForSpeechSeq2Seq, AutoProcessor, pipeline
from analyze_transcription_deterministic import analyze_transcription
import librosa
from model import MassMetadata, MassAnalysisResult
from datetime import datetime



time_synonyms = ["time", "start_time", "start-time", "startTime"]

def create_voice_fingerprint(audio_path):
    """
    Creates a voice fingerprint from an audio file using MFCCs.

    Args:
        audio_path (str): The file path to the audio recording (e.g., 'my_voice.mp3').

    Returns:
        numpy.ndarray: A 1D array representing the voice fingerprint.
                         Returns None if the file cannot be loaded.
    """
    try:
        # 1. Load the audio file
        #    - sr=16000: Resample to 16kHz, a standard for speech
        #    - mono=True: Convert to mono
        y, sr = librosa.load(audio_path, sr=16000, mono=True)

        # 2. Extract MFCCs
        #    - n_mfcc=13: Number of MFCC coefficients to return
        #    - The result is a matrix where columns are frames and rows are MFCCs
        mfccs = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)

        # 3. Create the fingerprint by taking the mean of each coefficient
        fingerprint = np.concatenate([
            np.mean(mfccs, axis=1)
        ])

        return fingerprint

    except Exception as e:
        print(f"Error processing {audio_path}: {e}")
        return None

def extract_homily_audio(input_file, mass_parts, output_file):
    """
    Extracts the homily audio from the input file based on the analysis.
    """

    if 'homily' not in mass_parts:
        print("Could not find homily in the analysis.")
        return

    start_time = mass_parts['homily']
    end_time = None

    if 'prayers_of_the_faithful' in mass_parts:
        end_time = mass_parts['prayers_of_the_faithful']
    
    if 'creed' in mass_parts:
        end_time = mass_parts['creed']
    
    
    if start_time is None or end_time is None:
        print("Could not find homily start and end times in the analysis.")
        return

    audio = AudioSegment.from_file(input_file)
    start_ms = float(start_time) * 1000
    end_ms = float(end_time) * 1000
    homily_audio = audio[start_ms:end_ms]
    homily_audio.export(output_file, format="mp3")


def find_cut_time(file_path, rms_plot_file, channels_plot_file, rms_threshold=200, silence_duration_min=10):
    """
    Analyzes the audio file to find a suitable cut time.
    The cut time is the beginning of the first silence longer than `silence_duration_min`
    """
    audio = AudioSegment.from_file(file_path)
    samples = np.array(audio.get_array_of_samples())
    if audio.channels == 2:
        samples = samples.reshape((-1, 2))
        samples = samples.mean(axis=1)
    
    import matplotlib.pyplot as plt

    # Plot raw audio samples
    plt.figure(figsize=(15,5))
    plt.plot(samples)
    plt.xlabel('Sample')
    plt.ylabel('Amplitude')
    plt.title('Audio Waveform')
    plt.grid(True)
    plt.savefig(channels_plot_file)
    plt.close()

    window_size = int(audio.frame_rate * 0.1)  # 100ms

    # Plot RMS values compared to threshold
    rms_values = []
    times = []
    for i in range(0, len(samples) - window_size, window_size):
        window = samples[i:i + window_size]
        rms = np.sqrt(np.mean(window**2))
        time_seconds = i / audio.frame_rate
        rms_values.append(rms)
        times.append(time_seconds)

    plt.figure(figsize=(15,5))
    plt.plot(times, rms_values, label='RMS')
    plt.axhline(y=rms_threshold, color='r', linestyle='--', label='Threshold')
    plt.xlabel('Time (seconds)')
    plt.ylabel('RMS')
    plt.title('RMS Values vs Threshold')
    plt.legend()
    plt.grid(True)
    plt.savefig(rms_plot_file)
    plt.close()    
    silence_duration_ms = silence_duration_min * 60 * 1000
    silence_windows = int(silence_duration_ms / 100)
    consecutive_silent_windows = 0
    start_of_silence = 0

    for i in range(0, len(samples) - window_size, window_size):
        window = samples[i:i + window_size]
        rms = np.sqrt(np.mean(window**2))
        time_seconds = i / audio.frame_rate

        if rms < rms_threshold:
            if consecutive_silent_windows == 0:
                start_of_silence = time_seconds
            consecutive_silent_windows += 1
            if consecutive_silent_windows >= silence_windows:
                return start_of_silence
        else:
            consecutive_silent_windows = 0

    return None


def cut_audio(input_file, end_seconds, output_file):
    audio = AudioSegment.from_file(input_file)
    if end_seconds is None:
        audio.export(output_file, format="mp3")
    else:
        end_ms = end_seconds * 1000
        cut_audio = audio[:end_ms]
        cut_audio.export(output_file, format="mp3")


def transcribe_audio(file_path):
    device = "cuda:0" if torch.cuda.is_available() else "cpu"
    torch_dtype = torch.float16 if torch.cuda.is_available() else torch.float32

    model_id = "openai/whisper-medium.en"

    model = AutoModelForSpeechSeq2Seq.from_pretrained(
        model_id, torch_dtype=torch_dtype, low_cpu_mem_usage=True, use_safetensors=True
    )
    model.to(device)

    processor = AutoProcessor.from_pretrained(model_id)

    pipe = pipeline(
        "automatic-speech-recognition",
        model=model,
        tokenizer=processor.tokenizer,
        feature_extractor=processor.feature_extractor,
        torch_dtype=torch_dtype,
        device=device,
        return_timestamps=True
    )

    result = pipe(file_path)
    return result





def main(input_file, service, model, override=False):
    print(f"Starting pipeline for {input_file} using {service}...")

    cut_audio_file = f"{os.path.splitext(input_file)[0]}_cut.mp3"
    skip_cut_audio = False
    if os.path.exists(cut_audio_file) and not override:
        print(f"Cut audio file {cut_audio_file} already exists. Skipping cut audio step.")
        skip_cut_audio = True
    
    if not skip_cut_audio:
        # 1. Find cut time
        print("Finding cut time...")
        rms_plot_file = f"{os.path.splitext(input_file)[0]}_rms_plot.png"
        channels_plot_file = f"{os.path.splitext(input_file)[0]}_channels_plot.png"
        cut_time = find_cut_time(input_file, rms_plot_file=rms_plot_file, channels_plot_file=channels_plot_file)
        if cut_time == None:
            print("Could not find a suitable cut time, processing entire file.")
        else:
            print(f"Cut time found at {cut_time} seconds.")

        # 2. Cut audio
        print(f"Cutting audio to {cut_audio_file}...")
        cut_audio(input_file, cut_time, cut_audio_file)

    
    transcription_output_file = f"{os.path.splitext(input_file)[0]}_transcription.pkl"
    skip_transcription = False
    if os.path.exists(transcription_output_file) and not override:
        print(f"Transcription file {transcription_output_file} already exists. Skipping transcription step.")
        skip_transcription = True
    
    if not skip_transcription:
        # 3. Transcribe audio
        print("Transcribing audio...")
        transcription_result = transcribe_audio(cut_audio_file)

        # 4. Save transcription result to pickle
        print(f"Saving transcription to {transcription_output_file}...")
        with open(transcription_output_file, "wb") as f:
            pickle.dump(transcription_result, f)
    else:
        try:
            with open(transcription_output_file, "rb") as f:
                transcription_result = pickle.load(f)
        except FileNotFoundError:
            print(f"Transcription file {transcription_output_file} not found")
            return
    
    skip_analysis = False
    output_json_file = f"{os.path.splitext(input_file)[0]}_analysis.json"
    transcript_file = f"{os.path.splitext(input_file)[0]}_transcript.txt"
    if os.path.exists(output_json_file) and not override:
        print(f"Output file {output_json_file} already exists. Skipping analysis step.")
        skip_analysis = True

    transcript_text = ""
    hallucinated_silence_words = [
        "Thank you very much",
        "We're going to move on to the next one, please.",
        "Thank you.",
        "Thank you for joining us today.",
        "Okay, we're going to move on to the next item,",
        "the next item,",
        "All right, we're going to move on to the next one,",
        "the next one,",
        "next item, which is",
        "We're going to take a short break.",
        "So, thank you very much for being with us today, and we'll see you in the next session.",
        "I'm not sure what I'm going to do with this, but I'm going to try to do it in a different way.",
        "Thank you for your attention.",
        "I'll see you in the next video.",
        "And I'll see you guys in the next video, thanks.",
        "more minutes to take a few more minutes to take a few",
        "minutes to take a few more minutes to take a few more",
        "So, thank you very much for being with us today, and have a great rest of your day."
    ]
    for segment in transcription_result["chunks"]:
        if "text" not in segment:
            continue
        hallucinated_silence = False
        for hallucinated_word in hallucinated_silence_words:
            if hallucinated_word in segment["text"]:
                hallucinated_silence = True
                break
        if hallucinated_silence:
            continue
        transcript_text += str(segment.get("timestamp")) + " " + segment.get("text", "") + "\n"
    # 5. Save result to JSON
    print(f"Saving transcript to {transcript_file}...")
    with open(transcript_file, "w") as f:
        f.write(transcript_text)

    if not skip_analysis:
        # 6. Analyze transcription
        print(f"Analyzing transcription with {service}...")
        mass_parts = analyze_transcription(transcription_result)
        
        print(f"Saving analysis to {output_json_file}...")
        with open(output_json_file, "w") as f:
            json.dump(mass_parts, f, indent=4)
    else:
        try:
            with open(output_json_file, "r") as f:
                mass_parts = json.load(f)
        except FileNotFoundError:
            print(f"Analysis file {output_json_file} not found")
            return


    homily_audio_file = f"{os.path.splitext(input_file)[0]}_homily.mp3"


    skip_extract_homily = False
    if os.path.exists(homily_audio_file) and not override:
        print(f"Homily audio file {homily_audio_file} already exists. Skipping extract homily audio step.")
        skip_extract_homily = True
    
    if not skip_extract_homily:            
        # 7. Extract homily audio
        print(f"Extracting homily audio to {homily_audio_file}...")
        extract_homily_audio(input_file, mass_parts, homily_audio_file)


    skip_fingerprint = False
    fingerprint_file = f"{os.path.splitext(input_file)[0]}_fingerprint.json"
    if os.path.exists(fingerprint_file) and not override:
        print(f"Fingerprint file {fingerprint_file} already exists. Skipping fingerprint step.")
        skip_fingerprint = True
    
    if not skip_fingerprint:
        # 8. Create voice fingerprint
        print("Creating voice fingerprint...")
        fingerprint = create_voice_fingerprint(homily_audio_file)
        if fingerprint is not None:
            print(f"Saving fingerprint to {fingerprint_file}...")
            with open(fingerprint_file, "w") as f:
                json.dump(fingerprint.tolist(), f, indent=4)

    skip_priest_detection = False
    priest_file = f"{os.path.splitext(input_file)[0]}_homily_priest_label.txt"
    if os.path.exists(priest_file) and not override:
        print(f"Priest detection file {priest_file} already exists. Skipping priest detection step.")
        skip_priest_detection = True
    
    if not skip_priest_detection:
        # 9. Detect priest
        print("Detecting priest...")
        # TODO Create method for detecting priest
        priest_label = "Unknown"
        with open(priest_file, "w") as f:
            f.write(priest_label)
    else:
        with open(priest_file, "r") as f:
            priest_label = f.read().strip()

    print(f"Priest label: {priest_label}")

    file_name = os.path.basename(input_file)

    hour = file_name.split("-")[0]

    hour_est = int(hour) - 4

    year = int(input_file.split("/")[6])

    month = int(input_file.split("/")[7])

    day = int(input_file.split("/")[8])

    is_sunday = datetime(year, month, day).weekday() == 6

    is_saturday = datetime(year, month, day).weekday() == 5

    mass_location="Gate of Heaven" if "GoH" in input_file else "St. Brigid"

    print(mass_location, hour_est)

    if not is_sunday and mass_location == "Gate of Heaven" and hour_est < 12:
        mass_time = "9 AM"

    if is_saturday and mass_location == "Gate of Heaven" and hour_est > 12:
        mass_time = "4 PM"

    if not is_sunday and mass_location == "St. Brigid":
        mass_time = "7 AM"

    if is_sunday and mass_location == "Gate of Heaven" and hour_est < 12:
        mass_time = "9 AM"

    if is_sunday and mass_location == "Gate of Heaven" and hour_est >= 12:
        mass_time = "12 PM"

    if is_sunday and mass_location == "St. Brigid" and hour_est < 11:
        mass_time = "8 AM"

    if is_sunday and mass_location == "St. Brigid" and hour_est >= 11:
        mass_time = "10:30 AM"

    
    metadata = MassMetadata(
        mass_time=mass_time,
        mass_location=mass_location,
        priest=priest_label,
        is_sunday=is_sunday or is_saturday,
        date=f"{month}/{day}/{year}"
    )

    result = MassAnalysisResult(
        transcript=transcript_text,
        mass_parts=mass_parts,
        audio_file=input_file,
        metadata=metadata
    )

    print("Pipeline finished successfully!")

    return result


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Process an audio file to detect parts of a Mass.")
    parser.add_argument("input_file", help="The input MP3 file.")
    parser.add_argument("--service", choices=['bedrock', 'ollama'], default='bedrock', help="The service to use for analysis.")
    parser.add_argument("--model", help="The model to use for analysis.")
    parser.add_argument("--override", action="store_true", help="Override existing files.", default=False)

    args = parser.parse_args()
    main(args.input_file, args.service, args.model, args.override)
