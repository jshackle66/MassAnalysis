import os
import librosa
import librosa.display
import matplotlib.pyplot as plt
import numpy as np

def extract_features(audio_path):
    y, sr = librosa.load(audio_path, sr=None)

    # MFCCs
    mfccs = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)

    # Chroma Features
    chroma = librosa.feature.chroma_stft(y=y, sr=sr)

    # Mel Spectrogram
    mel_spectrogram = librosa.feature.melspectrogram(y=y, sr=sr)

    return {
        "mfccs": mfccs,
        "chroma": chroma,
        "mel_spectrogram": mel_spectrogram
    }

def analyze_features(features_dict):
    analysis_results = {}
    for feature_name, feature_data in features_dict.items():
        analysis_results[feature_name] = {
            "shape": feature_data.shape,
            "mean": np.mean(feature_data),
            "std": np.std(feature_data),
            "min": np.min(feature_data),
            "max": np.max(feature_data)
        }
    return analysis_results

def get_aggregated_features(s3_downloads_dir):
    homily_mp3_files = []
    for root, _, files in os.walk(s3_downloads_dir):
        for file in files:
            if file.endswith('_homily.mp3'):
                homily_mp3_files.append(os.path.join(root, file))

    all_mfccs = []
    all_chroma = []
    all_mel_spectrograms = []
    labels = []

    if not homily_mp3_files:
        print("No _homily.mp3 files found in the s3_downloads directory.")
        return {}, {}, {}, []

    print(f"Found {len(homily_mp3_files)} _homily.mp3 files. Extracting and aggregating features...")
    for i, audio_file in enumerate(homily_mp3_files):
        # print(f"Processing {audio_file} ({i+1}/{len(homily_mp3_files)})")
        try:
            features = extract_features(audio_file)
            all_mfccs.append(np.mean(features["mfccs"], axis=1))
            all_chroma.append(np.mean(features["chroma"], axis=1))
            all_mel_spectrograms.append(np.mean(features["mel_spectrogram"], axis=1))

            path_parts = audio_file.split(os.sep)
            if len(path_parts) >= 5:
                label = path_parts[-2]
                labels.append(label)
                # Create _priest_label.txt file
                base_name = os.path.splitext(audio_file)[0]
                label_file_path = f"{base_name}_priest_label.txt"
                with open(label_file_path, 'w') as f:
                    f.write(label)
            else:
                labels.append('unknown')

        except Exception as e:
            print(f"Error processing {audio_file}: {e}")

    return np.array(all_mfccs), np.array(all_chroma), np.array(all_mel_spectrograms), np.array(labels)


if __name__ == '__main__':
    s3_downloads_dir = '/home/john/Documents/MassAnalysis/s3_downloads'
    mfccs, chroma, mel_spectrograms, labels = get_aggregated_features(s3_downloads_dir)

    print("\n--- Aggregated Feature Shapes ---")
    print(f"MFCCs shape: {mfccs.shape}")
    print(f"Chroma shape: {chroma.shape}")
    print(f"Mel Spectrograms shape: {mel_spectrograms.shape}")
    print(f"Labels shape: {labels.shape}")