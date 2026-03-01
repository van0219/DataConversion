from cryptography.fernet import Fernet
from app.core.config import settings

class CredentialEncryption:
    """Encrypt/decrypt FSM OAuth credentials using Fernet (AES-256)"""
    
    def __init__(self):
        self.fernet = Fernet(settings.ENCRYPTION_KEY.encode())
    
    def encrypt(self, plaintext: str) -> bytes:
        """Encrypt plaintext string to bytes"""
        return self.fernet.encrypt(plaintext.encode())
    
    def decrypt(self, ciphertext: bytes) -> str:
        """Decrypt bytes to plaintext string"""
        return self.fernet.decrypt(ciphertext).decode()

encryption = CredentialEncryption()
