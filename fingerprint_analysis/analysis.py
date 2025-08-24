import os
import librosa
import librosa.display
import matplotlib.pyplot as plt
import numpy as np
from sklearn.manifold import TSNE
from sklearn.decomposition import PCA
from sklearn.cluster import KMeans
from sklearn.cluster import DBSCAN
from sklearn.neighbors import NearestNeighbors

# Assuming extract_features and analyze_features are defined as before
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
        return np.array([]), np.array([]), np.array([]), np.array([])

    print(f"Found {len(homily_mp3_files)} _homily.mp3 files. Extracting and aggregating features...")
    for i, audio_file in enumerate(homily_mp3_files):
        try:
            features = extract_features(audio_file)
            # Take the mean across the time axis to get a single vector per audio file
            all_mfccs.append(np.mean(features["mfccs"], axis=1))
            all_chroma.append(np.mean(features["chroma"], axis=1))
            all_mel_spectrograms.append(np.mean(features["mel_spectrogram"], axis=1))

            # Read label from _priest_label.txt file
            base_name = os.path.splitext(audio_file)[0]
            label_file_path = f"{base_name}_priest_label.txt"
            if os.path.exists(label_file_path):
                with open(label_file_path, 'r') as f:
                    label = f.read().strip()
                    labels.append(label)
            else:
                # Fallback to path-based label if _priest_label.txt doesn't exist
                path_parts = audio_file.split(os.sep)
                if len(path_parts) >= 5:
                    labels.append(path_parts[-2])
                else:
                    labels.append('unknown')

        except Exception as e:
            print(f"Error processing {audio_file}: {e}")

    # Ensure all feature lists are converted to numpy arrays
    return np.array(all_mfccs), np.array(all_chroma), np.array(all_mel_spectrograms), np.array(labels)

def load_fingerprints(data_dir):
    fingerprints = []
    labels = []
    for root, _, files in os.walk(data_dir):
        for file in files:
            if file.endswith("_fingerprint.json"):
                filepath = os.path.join(root, file)
                with open(filepath, 'r') as f:
                    try:
                        fingerprint = json.load(f)
                        # Ensure fingerprint is a list/array of numbers
                        if isinstance(fingerprint, list) and all(isinstance(x, (int, float)) for x in fingerprint):
                            fingerprints.append(fingerprint)
                            # Extract speaker label from the path (e.g., GoH or SB)
                            path_parts = filepath.split(os.sep)
                            # Assuming the structure is s3_downloads/YEAR/MONTH/DAY/SPEAKER/file.json
                            if len(path_parts) >= 5:
                                labels.append(path_parts[-2])
                            else:
                                labels.append('unknown') # Fallback label
                        else:
                            print(f"Skipping invalid fingerprint data in {filepath}")
                    except json.JSONDecodeError as e:
                        print(f"Error decoding JSON from {filepath}: {e}")
                    except Exception as e:
                        print(f"An unexpected error occurred with {filepath}: {e}")
    return np.array(fingerprints), np.array(labels)

def plot_tsne(data, labels, output_file, title_prefix=""):
    valid_indices = ~np.isnan(data).any(axis=1)
    data = data[valid_indices]
    labels = labels[valid_indices]

    if len(data) == 0:
        print(f"No valid data for {title_prefix} t-SNE plot after filtering NaN values.")
        return

    # Adjust perplexity if data size is too small
    perplexity_val = min(30, len(data) - 1)
    if perplexity_val <= 0:
        print(f"Not enough data points for {title_prefix} t-SNE plot (need at least 2). Skipping.")
        return

    tsne = TSNE(n_components=2, perplexity=perplexity_val, n_iter_without_progress=300, random_state=42)
    tsne_results = tsne.fit_transform(data)

    plt.figure(figsize=(12, 8))
    for label in np.unique(labels):
        indices = np.where(labels == label)
        plt.scatter(tsne_results[indices, 0], tsne_results[indices, 1], label=label)
    plt.legend()
    plt.title(f'{title_prefix} t-SNE Visualization of Voice Fingerprints')
    plt.savefig(output_file)
    plt.close()


def plot_pca(data, labels, output_file, title_prefix=""):
    valid_indices = ~np.isnan(data).any(axis=1)
    data = data[valid_indices]
    labels = labels[valid_indices]

    if len(data) == 0:
        print(f"No valid data for {title_prefix} PCA plot after filtering NaN values.")
        return

    pca = PCA(n_components=2)
    pca_results = pca.fit_transform(data)

    plt.figure(figsize=(12, 8))
    for label in np.unique(labels):
        indices = np.where(labels == label)
        plt.scatter(pca_results[indices, 0], pca_results[indices, 1], label=label)
    plt.legend()
    plt.title(f'{title_prefix} PCA Visualization of Voice Fingerprints')
    plt.savefig(output_file)
    plt.close()

def plot_k_distance(data, k, output_file, title_prefix=""):
    if len(data) < k + 1:
        print(f"Not enough data points for {title_prefix} k-distance plot (need at least {k+1}). Skipping.")
        return

    neigh = NearestNeighbors(n_neighbors=k)
    distances, _ = neigh.fit(data).kneighbors(data)
    distances = np.sort(distances[:, k-1], axis=0)
    plt.figure(figsize=(12, 8))
    plt.plot(distances)
    plt.title(f'{title_prefix} k-distance Graph for k={k}')
    plt.xlabel('Points sorted by distance')
    plt.ylabel(f'{k}-distance')
    plt.savefig(output_file)
    plt.close()


if __name__ == '__main__':
    data_dir = '/home/john/Documents/MassAnalysis/s3_downloads'
    output_dir = './plots'
    os.makedirs(output_dir, exist_ok=True)

    # Load existing fingerprints (if any)
    # fingerprints, labels = load_fingerprints(data_dir)

    # Get new features from homily.mp3 files
    mfccs, chroma, mel_spectrograms, labels = get_aggregated_features(data_dir)

    feature_sets = {
        "MFCCs": mfccs,
        "Chroma": chroma,
        "Mel_Spectrograms": mel_spectrograms
    }

    for name, features_data in feature_sets.items():
        if len(features_data) == 0:
            print(f"No {name} data to process. Skipping visualization and clustering for {name}.")
            continue

        # Normalize the data
        means = np.mean(features_data, axis=0)
        stds = np.std(features_data, axis=0)
        stds[stds == 0] = 1
        normalized_features = (features_data - means) / stds

        print(f"\n--- Processing {name} ---")
        # Plot t-SNE and PCA
        plot_tsne(normalized_features, labels, os.path.join(output_dir, f'tsne_{name.lower()}.png'), title_prefix=name)
        plot_pca(normalized_features, labels, os.path.join(output_dir, f'pca_{name.lower()}.png'), title_prefix=name)

        # Plot k-distance graph for DBSCAN tuning
        k_value = 2 * normalized_features.shape[1] if normalized_features.shape[1] > 0 else 5
        plot_k_distance(normalized_features, k_value, os.path.join(output_dir, f'k_distance_{name.lower()}.png'), title_prefix=name)

        # K-Means Clustering
        if len(normalized_features) > 0 and len(np.unique(labels)) > 1:
            n_clusters = len(np.unique(labels)) # Number of clusters based on unique speakers
            if n_clusters > 0:
                kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
                clusters = kmeans.fit_predict(normalized_features)
                print(f"K-Means Clustering performed for {name} with {n_clusters} clusters.")
            else:
                print(f"Cannot perform K-Means clustering for {name}: no unique speakers found.")

        # DBSCAN Clustering (using a default eps for now, user can tune with k-distance graph)
        if len(normalized_features) > 0:
            # You might need to tune eps and min_samples based on your data and k-distance plot.
            # For demonstration, using a placeholder eps. User should adjust based on k_distance plot.
            dbscan = DBSCAN(eps=6.5, min_samples=5)
            clusters = dbscan.fit_predict(normalized_features)
            n_clusters_dbscan = len(set(clusters)) - (1 if -1 in clusters else 0)
            print(f"DBSCAN Clustering performed for {name}. Number of clusters: {n_clusters_dbscan}")
            print(f"Number of noise points (unclustered) for {name}: {list(clusters).count(-1)}")

    print("\nAnalysis complete. Plots saved in the 'plots' directory.")
