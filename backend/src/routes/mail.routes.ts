import { Router, Request, Response } from 'express';
import { dbGet } from '../config/database';
import { authMiddleware } from '../middleware/auth';
import { decryptPassword } from './mail-account.routes';
import nodemailer from 'nodemailer';

const router = Router();

// helper to get user's IMAP client
async function getImapClient(userId: number) {
  const account = await dbGet(
    'SELECT * FROM email_accounts WHERE user_id = ? AND is_active = 1',
    [userId]
  ) as any;

  if (!account) throw new Error('No email account configured. Please set up your email account first.');

  const password = decryptPassword(account.password_encrypted);
  const { ImapFlow } = await import('imapflow');

  const client = new ImapFlow({
    host: account.imap_host || 'imap.gmail.com',
    port: account.imap_port || 993,
    secure: true,
    auth: { user: account.email_address, pass: password },
    logger: false,
  });

  return { client, account, password };
}

// helper to get SMTP transporter
async function getSmtpTransporter(userId: number) {
  const account = await dbGet(
    'SELECT * FROM email_accounts WHERE user_id = ? AND is_active = 1',
    [userId]
  ) as any;

  if (!account) throw new Error('No email account configured');

  const password = decryptPassword(account.password_encrypted);

  const transporter = nodemailer.createTransport({
    host: account.smtp_host || 'smtp.gmail.com',
    port: account.smtp_port || 465,
    secure: true,
    auth: { user: account.email_address, pass: password },
  });

  return { transporter, account };
}

// GET /api/mail/folders — list IMAP folders
router.get('/folders', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const { client } = await getImapClient(userId);

    await client.connect();
    const folders = await client.list();
    await client.logout();

    // map to simplified structure
    const mapped = folders.map((f: any) => ({
      path: f.path,
      name: f.name,
      delimiter: f.delimiter,
      specialUse: f.specialUse || null,
      listed: f.listed,
    }));

    res.json({ success: true, folders: mapped });
  } catch (error: any) {
    console.error('List folders error:', error);
    res.status(error.message.includes('No email account') ? 400 : 500).json({ success: false, error: error.message });
  }
});

// GET /api/mail/messages — list messages in a folder
router.get('/messages', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const folder = (req.query.folder as string) || 'INBOX';
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 25;

    const { client } = await getImapClient(userId);
    await client.connect();

    const mailbox = await client.mailboxOpen(folder);
    const total = mailbox.exists || 0;

    if (total === 0) {
      await client.logout();
      return res.json({ success: true, messages: [], total: 0, page, pages: 0 });
    }

    // calculate sequence range (newest first)
    const end = total - (page - 1) * limit;
    const start = Math.max(1, end - limit + 1);

    if (end < 1) {
      await client.logout();
      return res.json({ success: true, messages: [], total, page, pages: Math.ceil(total / limit) });
    }

    const messages: any[] = [];

    for await (const msg of client.fetch(`${start}:${end}`, {
      envelope: true,
      flags: true,
      bodyStructure: true,
      uid: true,
    })) {
      messages.push({
        uid: msg.uid,
        seq: msg.seq,
        subject: msg.envelope?.subject || '(No Subject)',
        from: msg.envelope?.from?.map((a: any) => ({
          name: a.name || '',
          address: `${a.mailbox}@${a.host}`,
        })) || [],
        to: msg.envelope?.to?.map((a: any) => ({
          name: a.name || '',
          address: `${a.mailbox}@${a.host}`,
        })) || [],
        date: msg.envelope?.date || null,
        messageId: msg.envelope?.messageId || null,
        flags: Array.from(msg.flags || []),
        seen: msg.flags?.has('\\Seen') || false,
        flagged: msg.flags?.has('\\Flagged') || false,
        hasAttachment: hasAttachments(msg.bodyStructure),
      });
    }

    await client.logout();

    // reverse so newest first
    messages.reverse();

    res.json({
      success: true,
      messages,
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (error: any) {
    console.error('List messages error:', error);
    res.status(error.message.includes('No email account') ? 400 : 500).json({ success: false, error: error.message });
  }
});

// GET /api/mail/messages/:uid — get full message with body
router.get('/messages/:uid', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const uid = parseInt(req.params.uid);
    const folder = (req.query.folder as string) || 'INBOX';

    const { client } = await getImapClient(userId);
    await client.connect();
    await client.mailboxOpen(folder);

    // fetch full message source
    const download = await client.download(uid.toString(), undefined, { uid: true });
    const chunks: Buffer[] = [];
    for await (const chunk of download.content) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const rawEmail = Buffer.concat(chunks);

    // mark as seen
    await client.messageFlagsAdd({ uid }, ['\\Seen'], { uid: true });

    await client.logout();

    // parse the email
    const { simpleParser } = await import('mailparser');
    const parsed = await simpleParser(rawEmail);

    const attachments = (parsed.attachments || []).map((att, idx) => ({
      id: idx,
      filename: att.filename || `attachment_${idx}`,
      contentType: att.contentType,
      size: att.size,
      contentId: att.contentId || null,
    }));

    res.json({
      success: true,
      message: {
        uid,
        subject: parsed.subject || '(No Subject)',
        from: parsed.from?.value || [],
        to: parsed.to ? (Array.isArray(parsed.to) ? parsed.to.flatMap((t: any) => t.value) : parsed.to.value) : [],
        cc: parsed.cc ? (Array.isArray(parsed.cc) ? parsed.cc.flatMap((c: any) => c.value) : parsed.cc.value) : [],
        bcc: parsed.bcc ? (Array.isArray(parsed.bcc) ? parsed.bcc.flatMap((b: any) => b.value) : parsed.bcc.value) : [],
        date: parsed.date || null,
        messageId: parsed.messageId || null,
        inReplyTo: parsed.inReplyTo || null,
        html: parsed.html || null,
        text: parsed.text || null,
        attachments,
      },
    });
  } catch (error: any) {
    console.error('Get message error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/mail/messages/:uid/attachment/:attachmentId — download attachment
router.get('/messages/:uid/attachment/:attachmentId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const uid = parseInt(req.params.uid);
    const attachmentId = parseInt(req.params.attachmentId);
    const folder = (req.query.folder as string) || 'INBOX';

    const { client } = await getImapClient(userId);
    await client.connect();
    await client.mailboxOpen(folder);

    const download = await client.download(uid.toString(), undefined, { uid: true });
    const chunks: Buffer[] = [];
    for await (const chunk of download.content) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const rawEmail = Buffer.concat(chunks);
    await client.logout();

    const { simpleParser } = await import('mailparser');
    const parsed = await simpleParser(rawEmail);

    const att = parsed.attachments?.[attachmentId];
    if (!att) {
      return res.status(404).json({ success: false, error: 'Attachment not found' });
    }

    res.setHeader('Content-Type', att.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${att.filename || 'download'}"`);
    res.send(att.content);
  } catch (error: any) {
    console.error('Download attachment error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/mail/send — compose and send email
router.post('/send', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const { to, cc, bcc, subject, html, text, inReplyTo, references } = req.body;

    if (!to || !subject) {
      return res.status(400).json({ success: false, error: 'To and Subject are required' });
    }

    const { transporter, account } = await getSmtpTransporter(userId);

    const mailOptions: any = {
      from: account.display_name ? `"${account.display_name}" <${account.email_address}>` : account.email_address,
      to,
      cc: cc || undefined,
      bcc: bcc || undefined,
      subject,
      html: html || undefined,
      text: text || undefined,
    };

    // threading support
    if (inReplyTo) mailOptions.inReplyTo = inReplyTo;
    if (references) mailOptions.references = references;

    await transporter.sendMail(mailOptions);
    res.json({ success: true, message: 'Email sent successfully' });
  } catch (error: any) {
    console.error('Send email error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PATCH /api/mail/messages/:uid/read — mark as read/unread
router.patch('/messages/:uid/read', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const uid = parseInt(req.params.uid);
    const folder = (req.query.folder as string) || 'INBOX';
    const { read } = req.body;

    const { client } = await getImapClient(userId);
    await client.connect();
    await client.mailboxOpen(folder);

    if (read) {
      await client.messageFlagsAdd({ uid }, ['\\Seen'], { uid: true });
    } else {
      await client.messageFlagsRemove({ uid }, ['\\Seen'], { uid: true });
    }

    await client.logout();
    res.json({ success: true });
  } catch (error: any) {
    console.error('Mark read error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PATCH /api/mail/messages/:uid/star — toggle star
router.patch('/messages/:uid/star', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const uid = parseInt(req.params.uid);
    const folder = (req.query.folder as string) || 'INBOX';
    const { starred } = req.body;

    const { client } = await getImapClient(userId);
    await client.connect();
    await client.mailboxOpen(folder);

    if (starred) {
      await client.messageFlagsAdd({ uid }, ['\\Flagged'], { uid: true });
    } else {
      await client.messageFlagsRemove({ uid }, ['\\Flagged'], { uid: true });
    }

    await client.logout();
    res.json({ success: true });
  } catch (error: any) {
    console.error('Star toggle error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/mail/messages/:uid — move to trash
router.delete('/messages/:uid', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const uid = parseInt(req.params.uid);
    const folder = (req.query.folder as string) || 'INBOX';

    const { client } = await getImapClient(userId);
    await client.connect();
    await client.mailboxOpen(folder);

    // move to trash
    try {
      await client.messageMove({ uid }, '[Gmail]/Trash', { uid: true });
    } catch {
      // fallback: mark as deleted
      await client.messageFlagsAdd({ uid }, ['\\Deleted'], { uid: true });
    }

    await client.logout();
    res.json({ success: true, message: 'Email moved to trash' });
  } catch (error: any) {
    console.error('Delete message error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/mail/unread-count — get unread count for badge
router.get('/unread-count', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const { client } = await getImapClient(userId);
    await client.connect();
    const mailbox = await client.mailboxOpen('INBOX');
    const unseen = mailbox.unseen || 0;
    await client.logout();
    res.json({ success: true, count: unseen });
  } catch (error: any) {
    // don't spam errors if no account configured
    if (error.message.includes('No email account')) {
      return res.json({ success: true, count: 0 });
    }
    console.error('Unread count error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// helper to check if body structure has attachments
function hasAttachments(bodyStructure: any): boolean {
  if (!bodyStructure) return false;
  if (bodyStructure.disposition === 'attachment') return true;
  if (bodyStructure.childNodes) {
    return bodyStructure.childNodes.some((c: any) => hasAttachments(c));
  }
  return false;
}

export default router;
