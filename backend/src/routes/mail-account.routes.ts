import { Router, Request, Response } from 'express';
import { dbAll, dbGet, dbRun } from '../config/database';
import { authMiddleware } from '../middleware/auth';
import { requirePermission } from '../middleware/permission';
import crypto from 'crypto';

const router = Router();

// encryption helpers for storing email passwords
const ALGORITHM = 'aes-256-cbc';
function getEncryptionKey(): Buffer {
  const secret = process.env.JWT_SECRET || 'secret';
  return crypto.createHash('sha256').update(secret).digest();
}

export function encryptPassword(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

export function decryptPassword(encrypted: string): string {
  const [ivHex, encText] = encrypted.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, getEncryptionKey(), iv);
  let decrypted = decipher.update(encText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// GET /api/mail/account — get current user's email config
router.get('/account', authMiddleware, requirePermission('crm.messages', 'view'), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const account = await dbGet(
      'SELECT id, user_id, email_address, display_name, imap_host, imap_port, smtp_host, smtp_port, is_active, last_synced_at, created_at FROM email_accounts WHERE user_id = ?',
      [userId]
    );
    res.json({ success: true, account: account || null });
  } catch (error: any) {
    console.error('Get email account error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/mail/account — save/update email credentials
router.post('/account', authMiddleware, requirePermission('crm.messages', 'update'), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const { email_address, display_name, imap_host, imap_port, smtp_host, smtp_port, password } = req.body;

    if (!email_address || !password) {
      return res.status(400).json({ success: false, error: 'Email address and password are required' });
    }

    const encrypted = encryptPassword(password);
    const existing = await dbGet('SELECT id FROM email_accounts WHERE user_id = ?', [userId]);

    if (existing) {
      await dbRun(
        `UPDATE email_accounts SET email_address=?, display_name=?, imap_host=?, imap_port=?, smtp_host=?, smtp_port=?, password_encrypted=?, updated_at=NOW() WHERE user_id=?`,
        [email_address, display_name || null, imap_host || 'imap.gmail.com', imap_port || 993, smtp_host || 'smtp.gmail.com', smtp_port || 465, encrypted, userId]
      );
    } else {
      await dbRun(
        `INSERT INTO email_accounts (user_id, email_address, display_name, imap_host, imap_port, smtp_host, smtp_port, password_encrypted) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [userId, email_address, display_name || null, imap_host || 'imap.gmail.com', imap_port || 993, smtp_host || 'smtp.gmail.com', smtp_port || 465, encrypted]
      );
    }

    res.json({ success: true, message: 'Email account saved' });
  } catch (error: any) {
    console.error('Save email account error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/mail/account/test — test IMAP connection
router.post('/account/test', authMiddleware, requirePermission('crm.messages', 'update'), async (req: Request, res: Response) => {
  try {
    const { email_address, password, imap_host, imap_port } = req.body;

    if (!email_address || !password) {
      return res.status(400).json({ success: false, error: 'Email and password required' });
    }

    const { ImapFlow } = await import('imapflow');
    const client = new ImapFlow({
      host: imap_host || 'imap.gmail.com',
      port: imap_port || 993,
      secure: true,
      auth: { user: email_address, pass: password },
      logger: false,
    });

    await client.connect();
    await client.logout();

    res.json({ success: true, message: 'Connection successful' });
  } catch (error: any) {
    console.error('Email connection test error:', error);
    res.status(400).json({ success: false, error: `Connection failed: ${error.message}` });
  }
});

// DELETE /api/mail/account — remove email config
router.delete('/account', authMiddleware, requirePermission('crm.messages', 'delete'), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    await dbRun('DELETE FROM email_accounts WHERE user_id = ?', [userId]);
    res.json({ success: true, message: 'Email account removed' });
  } catch (error: any) {
    console.error('Delete email account error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
