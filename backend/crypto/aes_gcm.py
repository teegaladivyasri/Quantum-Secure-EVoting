import os
import base64
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.exceptions import InvalidTag

def encrypt_ballot(key: bytes, plaintext: str) -> dict[str, str]:
    """
    Encrypts a ballot plaintext string using AES-256-GCM.
    
    Returns base64-encoded strings:
    - ciphertext: The encrypted ballot payload
    - nonce: 96-bit (12-byte) initialization vector
    - auth_tag: 128-bit (16-byte) authentication tag
    """
    if len(key) != 32:
        raise ValueError(f"AES-256 requires exactly a 32-byte (256-bit) key. Provided: {len(key)} bytes.")

    # Generate 96-bit (12-byte) CSPRNG nonce
    nonce = os.urandom(12)
    aesgcm = AESGCM(key)
    
    # AESGCM.encrypt appends the 16-byte tag to the ciphertext
    data = plaintext.encode("utf-8")
    encrypted_with_tag = aesgcm.encrypt(nonce, data, None)
    
    ciphertext_bytes = encrypted_with_tag[:-16]
    auth_tag_bytes = encrypted_with_tag[-16:]

    return {
        "ciphertext": base64.b64encode(ciphertext_bytes).decode("utf-8"),
        "nonce": base64.b64encode(nonce).decode("utf-8"),
        "auth_tag": base64.b64encode(auth_tag_bytes).decode("utf-8"),
    }

def decrypt_ballot(key: bytes, ciphertext_b64: str, nonce_b64: str, auth_tag_b64: str) -> str:
    """
    Performs authenticated decryption of a ballot payload using AES-256-GCM.
    Raises InvalidTag if ciphertext, nonce, tag, or key has been tampered with.
    """
    if len(key) != 32:
        raise ValueError(f"AES-256 requires exactly a 32-byte (256-bit) key. Provided: {len(key)} bytes.")

    ciphertext_bytes = base64.b64decode(ciphertext_b64.encode("utf-8"))
    nonce = base64.b64decode(nonce_b64.encode("utf-8"))
    auth_tag_bytes = base64.b64decode(auth_tag_b64.encode("utf-8"))

    encrypted_with_tag = ciphertext_bytes + auth_tag_bytes
    aesgcm = AESGCM(key)

    decrypted_bytes = aesgcm.decrypt(nonce, encrypted_with_tag, None)
    return decrypted_bytes.decode("utf-8")
