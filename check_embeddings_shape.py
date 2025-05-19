import numpy as np

try:
    embeddings = np.load("assets/docs/Nesh2022_embeddings.npy")
    print(f"Shape of embeddings: {embeddings.shape}")
except FileNotFoundError:
    print("Error: embeddings.npy not found.")
except Exception as e:
    print(f"An error occurred: {e}")
