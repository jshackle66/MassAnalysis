# Mass Analysis

This project is a collection of tools designed to analyze audio from Masses. It will automatically record live-streamed services, convert them into audio files, and then analyze the audio to understand its content. The analysis can identify different parts of the Mass, such as the homily, and even create a "voice fingerprint" to help identify the speaker. You may view the resulting data here: https://jshackle66.github.io/MassAnalysis/

## Data Pipeline

The process is broken down into two main parts: acquiring the data and then processing it.

### Data Acquisition

The audio for analysis is captured from live video streams of the Mass. The system records the video for a set amount of time, converts it into an audio-only format (MP3), and then saves the audio file for processing.

### Data Processing (`pipeline/pipeline.py`)

Once an audio file of a Mass is ready, a detailed analysis is performed. Here’s what happens:

1.  **Audio Trimming:** The system first scans the audio file for long periods of silence at the end and trims them off. This helps to clean up the recording.

2.  **Transcription:** The audio is converted into text using a speech-to-text model, OpenAI Whisper from Hugging Face. This creates a written transcript of the Mass, complete with timestamps for each part of the service.

3.  **Structural Analysis:** The transcript is then analyzed using keyword detection to identify the different parts of the Mass, such as the homily, the creed, and the prayers of the faithful. The system records the start and end times for each of these sections.

4.  **Homily Extraction:** Using the start and end times from the analysis, the system isolates the homily and saves it as a separate, smaller audio file.

5.  **Voice Fingerprinting:** A unique "voice fingerprint" is generated from the homily audio. This fingerprint is created using a technique that analyzes the specific characteristics of the speaker's voice, which can be used to help identify the priest who gave the homily.

6.  **Output Generation:** The analysis produces several files, including:
    *   The full transcript of the Mass.
    *   A summary of the different parts of the Mass and their timings.
    *   A separate audio file of just the homily.
    *   A file containing the voice fingerprint of the speaker.

## Usage

### Running the Data Processing Pipeline

To analyze an audio file, you can run the following command in your terminal:

```bash
python pipeline/pipeline.py <path_to_audio_file.mp3>
```

There are also options to customize the analysis, such as choosing a specific analysis service or re-analyzing a file that has already been processed.


## TODO
1. Automate priest detection via fingerprint analysis
2. LLM as a Judge for homily ratings?
3. Finetune an LLM on homily text?