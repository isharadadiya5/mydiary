const crypto = require('crypto');

// Secret encryption key derived from server secret or default key
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY 
  ? crypto.scryptSync(process.env.ENCRYPTION_KEY, 'mydiary_salt', 32)
  : crypto.scryptSync('mydiary_default_secret_key_2026', 'mydiary_salt', 32);

const ALGORITHM = 'aes-256-gcm';

/**
 * Encrypts a string value using AES-256-GCM
 */
function encrypt(text) {
  if (!text) return '';
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag().toString('hex');
  
  // Format: iv:authTag:encrypted
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypts an AES-256-GCM encrypted string
 */
function decrypt(cipherText) {
  if (!cipherText || !cipherText.includes(':')) return cipherText;
  try {
    const [ivHex, authTagHex, encryptedText] = cipherText.split(':');
    if (!ivHex || !authTagHex || !encryptedText) return cipherText;
    
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (err) {
    console.error('Decryption failed:', err.message);
    return cipherText; // Fallback if not encrypted or corrupted
  }
}

module.exports = { encrypt, decrypt };
