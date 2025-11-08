const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const MASTER_KEY = Buffer.from(process.env.ENCRYPTION_KEY || 'your-32-character-encryption-key'.padEnd(32, '0'), 'utf-8');

class EncryptionService {
  /**
   * Encrypt file buffer with given key
   */
  encryptFile(buffer, key) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
    const authTag = cipher.getAuthTag();
    
    // Return: IV (16 bytes) + AuthTag (16 bytes) + Encrypted Data
    return Buffer.concat([iv, authTag, encrypted]);
  }
  
  /**
   * Decrypt file buffer with given key
   */
  decryptFile(encryptedData, key) {
    const iv = encryptedData.slice(0, 16);
    const authTag = encryptedData.slice(16, 32);
    const encrypted = encryptedData.slice(32);
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    return Buffer.concat([decipher.update(encrypted), decipher.final()]);
  }
  
  /**
   * Encrypt document key with master key
   */
  encryptKey(documentKey) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, MASTER_KEY, iv);
    
    const encrypted = Buffer.concat([
      cipher.update(documentKey),
      cipher.final()
    ]);
    const authTag = cipher.getAuthTag();
    
    // Return as base64: IV + AuthTag + Encrypted Key
    return Buffer.concat([iv, authTag, encrypted]).toString('base64');
  }
  
  /**
   * Decrypt document key with master key
   */
  decryptKey(encryptedKey) {
    const buffer = Buffer.from(encryptedKey, 'base64');
    const iv = buffer.slice(0, 16);
    const authTag = buffer.slice(16, 32);
    const encrypted = buffer.slice(32);
    
    const decipher = crypto.createDecipheriv(ALGORITHM, MASTER_KEY, iv);
    decipher.setAuthTag(authTag);
    
    return Buffer.concat([decipher.update(encrypted), decipher.final()]);
  }
  
  /**
   * Generate cryptographic hash
   */
  generateHash(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
  }
  
  /**
   * Generate secure random token
   */
  generateToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }
}

module.exports = new EncryptionService();
