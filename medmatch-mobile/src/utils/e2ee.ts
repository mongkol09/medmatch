import 'react-native-get-random-values';
import nacl from 'tweetnacl';
import * as base64 from 'base64-js';

/**
 * End-to-End Encryption Utility using tweetnacl (Curve25519-XSalsa20-Poly1305)
 * 1. Generate Keypair for a user
 * 2. Exchange Public Keys
 * 3. Encrypt messages using shared secret
 */

export class E2EEService {
    // Generate a new public/private key pair
    static generateKeyPair() {
        const keyPair = nacl.box.keyPair();
        return {
            publicKey: base64.fromByteArray(keyPair.publicKey),
            secretKey: base64.fromByteArray(keyPair.secretKey),
        };
    }

    // Encrypt a message using our secret key and recipient's public key
    static encryptMessage(message: string, mySecretKeyBase64: string, recipientPublicKeyBase64: string) {
        const secretKey = base64.toByteArray(mySecretKeyBase64);
        const publicKey = base64.toByteArray(recipientPublicKeyBase64);

        // Generate an ephemeral nonce
        const nonce = nacl.randomBytes(nacl.box.nonceLength);
        const messageUint8 = new TextEncoder().encode(message);

        // Encrypt
        const encryptedMessage = nacl.box(messageUint8, nonce, publicKey, secretKey);

        return {
            nonce: base64.fromByteArray(nonce),
            ciphertext: base64.fromByteArray(encryptedMessage),
        };
    }

    // Decrypt a message using our secret key and sender's public key
    static decryptMessage(ciphertextBase64: string, nonceBase64: string, mySecretKeyBase64: string, senderPublicKeyBase64: string) {
        try {
            const secretKey = base64.toByteArray(mySecretKeyBase64);
            const publicKey = base64.toByteArray(senderPublicKeyBase64);
            const nonce = base64.toByteArray(nonceBase64);
            const ciphertext = base64.toByteArray(ciphertextBase64);

            const decrypted = nacl.box.open(ciphertext, nonce, publicKey, secretKey);

            if (!decrypted) {
                throw new Error('Could not decrypt message');
            }

            return new TextDecoder().decode(decrypted);
        } catch (e) {
            console.error('E2EE Decryption failed:', e);
            return '[Encrypted Message]';
        }
    }
}
