import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { dbAll, dbGet, dbRun } from '../config/database';
import { authMiddleware } from '../middleware/auth';
import { emitWorkHubMessage, emitWorkHubRead } from '../services/workhub-realtime';
import { sendWorkHubPush } from '../services/push-notifications';

const router = express.Router();
const uploadDirectory = path.resolve(__dirname, '../../uploads/workhub');
fs.mkdirSync(uploadDirectory, { recursive: true });

const allowedMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, uploadDirectory),
    filename: (_req, file, callback) => {
      const extension = path.extname(file.originalname).toLowerCase().replace(/[^a-z0-9.]/g, '');
      callback(null, `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${extension}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    if (!allowedMimeTypes.has(file.mimetype)) return callback(new Error('Unsupported file type'));
    callback(null, true);
  },
});

const currentUserId = (req: Request) => Number((req as any).userId || (req as any).user?.userId);
const normalizedIds = (ids: unknown): number[] =>
  Array.from(
    new Set(
      (Array.isArray(ids) ? ids : [])
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value > 0)
    )
  );

async function requireMembership(conversationId: number | string, userId: number) {
  return dbGet(
    `SELECT cm.*, c.type, c.name, c.entity_type, c.entity_id, c.entity_label
     FROM workhub_conversation_members cm
     JOIN workhub_conversations c ON c.id = cm.conversation_id
     WHERE cm.conversation_id = ? AND cm.user_id = ? AND cm.archived_at IS NULL`,
    [conversationId, userId]
  ) as Promise<any>;
}

async function conversationMemberIds(conversationId: number | string): Promise<number[]> {
  const rows = await dbAll(
    'SELECT user_id FROM workhub_conversation_members WHERE conversation_id = ? AND archived_at IS NULL',
    [conversationId]
  ) as any[];
  return rows.map((row) => Number(row.user_id));
}

async function addMembers(conversationId: number | string, memberIds: number[], ownerId?: number) {
  for (const memberId of memberIds) {
    await dbRun(
      `INSERT IGNORE INTO workhub_conversation_members (conversation_id, user_id, role)
       VALUES (?, ?, ?)`,
      [conversationId, memberId, memberId === ownerId ? 'owner' : 'member']
    );
  }
}

async function hydrateMessage(messageId: number | string) {
  const message = await dbGet(
    `SELECT m.*,
            COALESCE(u.full_name, CASE WHEN m.sender_id = 99999 THEN 'Master Admin' ELSE 'System' END) AS sender_name,
            ru.full_name AS reply_sender_name,
            rm.body AS reply_body
     FROM workhub_messages m
     LEFT JOIN users u ON u.id = m.sender_id
     LEFT JOIN workhub_messages rm ON rm.id = m.reply_to_id
     LEFT JOIN users ru ON ru.id = rm.sender_id
     WHERE m.id = ?`,
    [messageId]
  ) as any;
  if (!message) return null;
  message.attachments = await dbAll(
    `SELECT id, original_name, url, mime_type, size_bytes
     FROM workhub_message_attachments WHERE message_id = ? ORDER BY id`,
    [messageId]
  );
  message.mentions = (await dbAll(
    'SELECT user_id FROM workhub_message_mentions WHERE message_id = ?',
    [messageId]
  ) as any[]).map((row) => Number(row.user_id));
  return message;
}

async function createMessage(
  conversationId: number | string,
  senderId: number | null,
  payload: {
    type?: string;
    body?: string | null;
    reply_to_id?: number | null;
    client_id?: string | null;
    metadata?: any;
    attachment_ids?: number[];
    mentions?: number[];
  }
) {
  const result = await dbRun(
    `INSERT INTO workhub_messages
       (conversation_id, sender_id, type, body, reply_to_id, client_id, metadata)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      conversationId,
      senderId,
      payload.type || 'text',
      payload.body || null,
      payload.reply_to_id || null,
      payload.client_id || null,
      payload.metadata ? JSON.stringify(payload.metadata) : null,
    ]
  );
  const messageId = Number(result.insertId);

  for (const attachmentId of normalizedIds(payload.attachment_ids)) {
    await dbRun(
      `UPDATE workhub_message_attachments
       SET message_id = ?
       WHERE id = ? AND uploaded_by = ? AND message_id IS NULL`,
      [messageId, attachmentId, senderId]
    );
  }
  for (const mentionId of normalizedIds(payload.mentions)) {
    await dbRun(
      'INSERT IGNORE INTO workhub_message_mentions (message_id, user_id) VALUES (?, ?)',
      [messageId, mentionId]
    );
  }

  await dbRun(
    `UPDATE workhub_conversations
     SET last_message_id = ?, last_message_at = NOW(), updated_at = NOW()
     WHERE id = ?`,
    [messageId, conversationId]
  );
  return hydrateMessage(messageId);
}

router.use(authMiddleware);

router.get('/summary', async (req: Request, res: Response) => {
  try {
    const userId = currentUserId(req);
    const counts = await dbGet(
      `SELECT COUNT(DISTINCT cm.conversation_id) AS conversation_count,
              COALESCE(SUM((
                SELECT COUNT(*) FROM workhub_messages m
                WHERE m.conversation_id = cm.conversation_id
                  AND m.id > COALESCE(cm.last_read_message_id, 0)
                  AND COALESCE(m.sender_id, 0) <> ?
                  AND m.deleted_at IS NULL
              )), 0) AS unread_count
       FROM workhub_conversation_members cm
       WHERE cm.user_id = ? AND cm.archived_at IS NULL`,
      [userId, userId]
    ) as any;
    res.json({ data: { conversation_count: Number(counts?.conversation_count || 0), unread_count: Number(counts?.unread_count || 0) } });
  } catch (error) {
    console.error('Work Hub summary error:', error);
    res.status(500).json({ error: 'Failed to load Work Hub summary' });
  }
});

router.get('/people', async (req: Request, res: Response) => {
  try {
    const userId = currentUserId(req);
    const search = String(req.query.search || '').trim();
    const params: any[] = [userId];
    let filter = 'u.id <> ? AND u.is_active = 1';
    if (search) {
      filter += ' AND (u.full_name LIKE ? OR u.email LIKE ? OR d.name LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    const people = await dbAll(
      `SELECT u.id, u.full_name AS name, u.email, u.department_id,
              d.name AS department_name, r.name AS role_name
       FROM users u
       LEFT JOIN departments d ON d.id = u.department_id
       LEFT JOIN roles r ON r.id = u.role_id
       WHERE ${filter}
       ORDER BY d.name, u.full_name
       LIMIT 100`,
      params
    );
    res.json({ data: people });
  } catch (error) {
    console.error('Work Hub people error:', error);
    res.status(500).json({ error: 'Failed to load employees' });
  }
});

router.get('/conversations', async (req: Request, res: Response) => {
  try {
    const userId = currentUserId(req);
    const search = String(req.query.search || '').trim();
    const params: any[] = [userId, userId, userId];
    let having = '';
    if (search) {
      having = 'HAVING display_name LIKE ? OR last_message LIKE ?';
      params.push(`%${search}%`, `%${search}%`);
    }
    const conversations = await dbAll(
      `SELECT c.id, c.type, c.name, c.description, c.entity_type, c.entity_id, c.entity_label,
              c.last_message_at, cm.role, cm.last_read_message_id,
              lm.id AS last_message_id, lm.type AS last_message_type, lm.body AS last_message,
              lm.created_at AS last_message_created_at, lm.sender_id AS last_sender_id,
              COALESCE(lu.full_name, CASE WHEN lm.sender_id = 99999 THEN 'Master Admin' ELSE 'System' END) AS last_sender_name,
              COALESCE(
                c.name,
                c.entity_label,
                GROUP_CONCAT(DISTINCT CASE WHEN cm2.user_id <> ? THEN COALESCE(u2.full_name, 'Master Admin') END ORDER BY u2.full_name SEPARATOR ', '),
                'Percakapan'
              ) AS display_name,
              COUNT(DISTINCT cm2.user_id) AS member_count,
              (SELECT COUNT(*) FROM workhub_messages unread
               WHERE unread.conversation_id = c.id
                 AND unread.id > COALESCE(cm.last_read_message_id, 0)
                 AND COALESCE(unread.sender_id, 0) <> ?
                 AND unread.deleted_at IS NULL) AS unread_count
       FROM workhub_conversation_members cm
       JOIN workhub_conversations c ON c.id = cm.conversation_id
       LEFT JOIN workhub_conversation_members cm2 ON cm2.conversation_id = c.id AND cm2.archived_at IS NULL
       LEFT JOIN users u2 ON u2.id = cm2.user_id
       LEFT JOIN workhub_messages lm ON lm.id = c.last_message_id
       LEFT JOIN users lu ON lu.id = lm.sender_id
       WHERE cm.user_id = ? AND cm.archived_at IS NULL
       GROUP BY c.id, cm.id, lm.id, lu.id
       ${having}
       ORDER BY COALESCE(c.last_message_at, c.created_at) DESC`,
      params
    );
    res.json({ data: conversations });
  } catch (error) {
    console.error('Work Hub conversations error:', error);
    res.status(500).json({ error: 'Failed to load conversations' });
  }
});

router.post('/conversations/direct/:otherUserId', async (req: Request, res: Response) => {
  try {
    const userId = currentUserId(req);
    const otherUserId = Number(req.params.otherUserId);
    if (!otherUserId || otherUserId === userId) return res.status(400).json({ error: 'Select another employee' });
    const otherUser = await dbGet('SELECT id, full_name FROM users WHERE id = ? AND is_active = 1', [otherUserId]) as any;
    if (!otherUser) return res.status(404).json({ error: 'Employee not found' });

    const existing = await dbGet(
      `SELECT c.id
       FROM workhub_conversations c
       JOIN workhub_conversation_members mine ON mine.conversation_id = c.id AND mine.user_id = ?
       JOIN workhub_conversation_members theirs ON theirs.conversation_id = c.id AND theirs.user_id = ?
       WHERE c.type = 'direct'
         AND (SELECT COUNT(*) FROM workhub_conversation_members all_members WHERE all_members.conversation_id = c.id AND all_members.archived_at IS NULL) = 2
       LIMIT 1`,
      [userId, otherUserId]
    ) as any;
    if (existing) return res.json({ data: { id: Number(existing.id) } });

    const created = await dbRun(
      `INSERT INTO workhub_conversations (type, created_by) VALUES ('direct', ?)`,
      [userId]
    );
    await addMembers(created.insertId, [userId, otherUserId], userId);
    res.status(201).json({ data: { id: Number(created.insertId), display_name: otherUser.full_name } });
  } catch (error) {
    console.error('Work Hub direct conversation error:', error);
    res.status(500).json({ error: 'Failed to start conversation' });
  }
});

router.post('/conversations', async (req: Request, res: Response) => {
  try {
    const userId = currentUserId(req);
    const name = String(req.body?.name || '').trim();
    const memberIds = normalizedIds(req.body?.member_ids);
    if (!name) return res.status(400).json({ error: 'Group name is required' });
    if (!memberIds.length) return res.status(400).json({ error: 'Select at least one member' });
    const created = await dbRun(
      `INSERT INTO workhub_conversations (type, name, description, created_by)
       VALUES ('group', ?, ?, ?)`,
      [name, req.body?.description || null, userId]
    );
    await addMembers(created.insertId, [userId, ...memberIds], userId);
    const welcome = await createMessage(created.insertId, null, { type: 'system', body: `${name} dibuat` });
    emitWorkHubMessage(created.insertId, await conversationMemberIds(created.insertId), welcome);
    res.status(201).json({ data: { id: Number(created.insertId), display_name: name } });
  } catch (error) {
    console.error('Work Hub group conversation error:', error);
    res.status(500).json({ error: 'Failed to create group' });
  }
});

router.post('/entity', async (req: Request, res: Response) => {
  try {
    const userId = currentUserId(req);
    const entityType = String(req.body?.entity_type || '').trim().toLowerCase();
    const entityId = String(req.body?.entity_id || '').trim();
    const entityLabel = String(req.body?.entity_label || '').trim();
    if (!entityType || !entityId || !entityLabel) {
      return res.status(400).json({ error: 'entity_type, entity_id, and entity_label are required' });
    }
    let conversation = await dbGet(
      'SELECT id FROM workhub_conversations WHERE entity_type = ? AND entity_id = ?',
      [entityType, entityId]
    ) as any;
    let created = false;
    if (!conversation) {
      const result = await dbRun(
        `INSERT INTO workhub_conversations
           (type, name, entity_type, entity_id, entity_label, created_by)
         VALUES ('entity', ?, ?, ?, ?, ?)`,
        [entityLabel, entityType, entityId, entityLabel, userId]
      );
      conversation = { id: Number(result.insertId) };
      created = true;
    }
    await addMembers(conversation.id, [userId, ...normalizedIds(req.body?.member_ids)], userId);
    if (created) {
      const systemMessage = await createMessage(conversation.id, null, {
        type: 'system',
        body: `Ruang diskusi ${entityLabel} dibuat`,
        metadata: { entity_type: entityType, entity_id: entityId },
      });
      emitWorkHubMessage(conversation.id, await conversationMemberIds(conversation.id), systemMessage);
    }
    res.status(created ? 201 : 200).json({ data: { id: Number(conversation.id), display_name: entityLabel } });
  } catch (error: any) {
    if (error?.code === 'ER_DUP_ENTRY') {
      const existing = await dbGet(
        'SELECT id FROM workhub_conversations WHERE entity_type = ? AND entity_id = ?',
        [String(req.body?.entity_type || '').trim().toLowerCase(), String(req.body?.entity_id || '').trim()]
      ) as any;
      if (existing) {
        await addMembers(existing.id, [currentUserId(req)], currentUserId(req));
        return res.json({ data: { id: Number(existing.id) } });
      }
    }
    console.error('Work Hub entity conversation error:', error);
    res.status(500).json({ error: 'Failed to open entity conversation' });
  }
});

router.get('/conversations/:id', async (req: Request, res: Response) => {
  try {
    const userId = currentUserId(req);
    const membership = await requireMembership(req.params.id, userId);
    if (!membership) return res.status(403).json({ error: 'Conversation access denied' });
    const conversation = await dbGet('SELECT * FROM workhub_conversations WHERE id = ?', [req.params.id]) as any;
    const members = await dbAll(
      `SELECT cm.user_id AS id, cm.role,
              COALESCE(u.full_name, CASE WHEN cm.user_id = 99999 THEN 'Master Admin' ELSE 'System' END) AS name,
              u.email, d.name AS department_name
       FROM workhub_conversation_members cm
       LEFT JOIN users u ON u.id = cm.user_id
       LEFT JOIN departments d ON d.id = u.department_id
       WHERE cm.conversation_id = ? AND cm.archived_at IS NULL
       ORDER BY cm.role = 'owner' DESC, name`,
      [req.params.id]
    );
    res.json({ data: { ...conversation, members } });
  } catch (error) {
    console.error('Work Hub conversation detail error:', error);
    res.status(500).json({ error: 'Failed to load conversation' });
  }
});

router.post('/conversations/:id/members', async (req: Request, res: Response) => {
  try {
    const userId = currentUserId(req);
    const membership = await requireMembership(req.params.id, userId);
    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      return res.status(403).json({ error: 'Only group admins can add members' });
    }
    await addMembers(req.params.id, normalizedIds(req.body?.member_ids));
    res.json({ message: 'Members added' });
  } catch (error) {
    console.error('Work Hub add member error:', error);
    res.status(500).json({ error: 'Failed to add members' });
  }
});

router.get('/conversations/:id/messages', async (req: Request, res: Response) => {
  try {
    const userId = currentUserId(req);
    const membership = await requireMembership(req.params.id, userId);
    if (!membership) return res.status(403).json({ error: 'Conversation access denied' });
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
    const before = Number(req.query.before) || null;
    const params: any[] = [req.params.id];
    let cursor = '';
    if (before) {
      cursor = 'AND m.id < ?';
      params.push(before);
    }
    const messages = await dbAll(
      `SELECT m.*,
              COALESCE(u.full_name, CASE WHEN m.sender_id = 99999 THEN 'Master Admin' ELSE 'System' END) AS sender_name,
              ru.full_name AS reply_sender_name,
              rm.body AS reply_body
       FROM workhub_messages m
       LEFT JOIN users u ON u.id = m.sender_id
       LEFT JOIN workhub_messages rm ON rm.id = m.reply_to_id
       LEFT JOIN users ru ON ru.id = rm.sender_id
       WHERE m.conversation_id = ? ${cursor} AND m.deleted_at IS NULL
       ORDER BY m.id DESC LIMIT ${limit}`,
      params
    ) as any[];
    const ordered = messages.reverse();
    if (ordered.length) {
      const placeholders = ordered.map(() => '?').join(',');
      const attachments = await dbAll(
        `SELECT id, message_id, original_name, url, mime_type, size_bytes
         FROM workhub_message_attachments WHERE message_id IN (${placeholders}) ORDER BY id`,
        ordered.map((message) => message.id)
      ) as any[];
      for (const message of ordered) {
        message.attachments = attachments.filter((attachment) => Number(attachment.message_id) === Number(message.id));
      }
    }
    res.json({ data: ordered, pagination: { has_more: messages.length === limit } });
  } catch (error) {
    console.error('Work Hub messages error:', error);
    res.status(500).json({ error: 'Failed to load messages' });
  }
});

router.post('/conversations/:id/messages', async (req: Request, res: Response) => {
  try {
    const userId = currentUserId(req);
    const membership = await requireMembership(req.params.id, userId);
    if (!membership) return res.status(403).json({ error: 'Conversation access denied' });
    const body = String(req.body?.body || '').trim();
    const attachmentIds = normalizedIds(req.body?.attachment_ids);
    if (!body && !attachmentIds.length) return res.status(400).json({ error: 'Message or attachment is required' });
    if (body.length > 10000) return res.status(400).json({ error: 'Message is too long' });

    let message: any;
    try {
      message = await createMessage(req.params.id, userId, {
        type: attachmentIds.length && !body ? 'file' : 'text',
        body,
        reply_to_id: Number(req.body?.reply_to_id) || null,
        client_id: req.body?.client_id || null,
        attachment_ids: attachmentIds,
        mentions: normalizedIds(req.body?.mentions),
      });
    } catch (error: any) {
      if (error?.code === 'ER_DUP_ENTRY' && req.body?.client_id) {
        const duplicate = await dbGet(
          `SELECT id FROM workhub_messages
           WHERE conversation_id = ? AND sender_id = ? AND client_id = ?`,
          [req.params.id, userId, req.body.client_id]
        ) as any;
        message = duplicate ? await hydrateMessage(duplicate.id) : null;
      } else {
        throw error;
      }
    }
    if (!message) return res.status(500).json({ error: 'Failed to persist message' });
    await dbRun(
      `UPDATE workhub_conversation_members
       SET last_read_message_id = ?, last_read_at = NOW()
       WHERE conversation_id = ? AND user_id = ?`,
      [message.id, req.params.id, userId]
    );
    const memberIds = await conversationMemberIds(req.params.id);
    emitWorkHubMessage(req.params.id, memberIds, message);

    const conversation = await dbGet('SELECT name, entity_label FROM workhub_conversations WHERE id = ?', [req.params.id]) as any;
    const sender = await dbGet('SELECT full_name FROM users WHERE id = ?', [userId]) as any;
    for (const memberId of memberIds.filter((id) => id !== userId && id !== 99999)) {
      try {
        await dbRun(
          `INSERT INTO notifications
             (recipient_id, sender_id, title, message, type, related_entity_type, related_entity_id, action_url, is_read)
           VALUES (?, ?, ?, ?, 'message', 'workhub_conversation', ?, ?, 0)`,
          [
            memberId,
            userId === 99999 ? null : userId,
            conversation?.name || conversation?.entity_label || sender?.full_name || 'Pesan baru',
            body || 'Mengirim lampiran',
            req.params.id,
            `/work-hub/chat/${req.params.id}`,
          ]
        );
      } catch {
        // Notification delivery must never roll back a persisted message.
      }
    }
    sendWorkHubPush(memberIds.filter((memberId) => memberId !== userId && memberId !== 99999), {
      conversationId: req.params.id,
      title: sender?.full_name || conversation?.name || 'Pesan baru',
      body: body || 'Mengirim lampiran',
    }).catch((pushError) => console.error('Work Hub push delivery error:', pushError));
    res.status(201).json({ data: message });
  } catch (error) {
    console.error('Work Hub send message error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

router.put('/conversations/:id/read', async (req: Request, res: Response) => {
  try {
    const userId = currentUserId(req);
    const membership = await requireMembership(req.params.id, userId);
    if (!membership) return res.status(403).json({ error: 'Conversation access denied' });
    const latest = await dbGet(
      'SELECT MAX(id) AS id FROM workhub_messages WHERE conversation_id = ? AND deleted_at IS NULL',
      [req.params.id]
    ) as any;
    const messageId = Number(req.body?.message_id || latest?.id || 0);
    await dbRun(
      `UPDATE workhub_conversation_members
       SET last_read_message_id = GREATEST(COALESCE(last_read_message_id, 0), ?), last_read_at = NOW()
       WHERE conversation_id = ? AND user_id = ?`,
      [messageId, req.params.id, userId]
    );
    emitWorkHubRead(req.params.id, userId, messageId);
    res.json({ data: { message_id: messageId } });
  } catch (error) {
    console.error('Work Hub read error:', error);
    res.status(500).json({ error: 'Failed to update read state' });
  }
});

router.post('/messages/:id/reactions', async (req: Request, res: Response) => {
  try {
    const userId = currentUserId(req);
    const message = await dbGet('SELECT conversation_id FROM workhub_messages WHERE id = ?', [req.params.id]) as any;
    if (!message || !(await requireMembership(message.conversation_id, userId))) {
      return res.status(403).json({ error: 'Message access denied' });
    }
    const emoji = String(req.body?.emoji || '').trim().slice(0, 30);
    if (!emoji) return res.status(400).json({ error: 'Emoji is required' });
    await dbRun(
      'INSERT IGNORE INTO workhub_message_reactions (message_id, user_id, emoji) VALUES (?, ?, ?)',
      [req.params.id, userId, emoji]
    );
    res.status(201).json({ message: 'Reaction added' });
  } catch (error) {
    console.error('Work Hub reaction error:', error);
    res.status(500).json({ error: 'Failed to react to message' });
  }
});

router.post('/attachments', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'File is required' });
    const userId = currentUserId(req);
    const url = `${req.protocol}://${req.get('host')}/uploads/workhub/${req.file.filename}`;
    const result = await dbRun(
      `INSERT INTO workhub_message_attachments
         (uploaded_by, original_name, stored_name, url, mime_type, size_bytes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, req.file.originalname, req.file.filename, url, req.file.mimetype, req.file.size]
    );
    res.status(201).json({
      data: {
        id: Number(result.insertId),
        original_name: req.file.originalname,
        url,
        mime_type: req.file.mimetype,
        size_bytes: req.file.size,
      },
    });
  } catch (error) {
    console.error('Work Hub upload error:', error);
    res.status(500).json({ error: 'Failed to upload attachment' });
  }
});

router.get('/activity', async (req: Request, res: Response) => {
  try {
    const userId = currentUserId(req);
    const limit = Math.min(Math.max(Number(req.query.limit) || 40, 1), 100);
    const [notifications, auditRows, systemMessages] = await Promise.all([
      dbAll(
        `SELECT CONCAT('notification-', id) AS activity_id, 'notification' AS source,
                type, title, message AS description, related_entity_type AS entity_type,
                related_entity_id AS entity_id, action_url, is_read, created_at,
                NULL AS actor_name
         FROM notifications WHERE recipient_id = ? ORDER BY created_at DESC LIMIT ${limit}`,
        [userId]
      ) as Promise<any[]>,
      dbAll(
        `SELECT CONCAT('audit-', al.id) AS activity_id, 'audit' AS source,
                al.action AS type, CONCAT(al.action, ' ', al.entity_type) AS title,
                NULL AS description, al.entity_type, al.entity_id, NULL AS action_url,
                1 AS is_read, al.created_at,
                COALESCE(u.full_name, u.username, 'System') AS actor_name
         FROM audit_log al LEFT JOIN users u ON u.id = al.user_id
         ORDER BY al.created_at DESC LIMIT ${Math.min(limit, 30)}`,
        []
      ) as Promise<any[]>,
      dbAll(
        `SELECT CONCAT('message-', m.id) AS activity_id, 'workhub' AS source,
                m.type, COALESCE(c.name, c.entity_label, 'Work Hub') AS title,
                m.body AS description, c.entity_type, c.entity_id,
                CONCAT('/work-hub/chat/', c.id) AS action_url,
                1 AS is_read, m.created_at,
                COALESCE(u.full_name, 'System') AS actor_name
         FROM workhub_messages m
         JOIN workhub_conversation_members cm ON cm.conversation_id = m.conversation_id AND cm.user_id = ?
         JOIN workhub_conversations c ON c.id = m.conversation_id
         LEFT JOIN users u ON u.id = m.sender_id
         WHERE m.type = 'system' AND m.deleted_at IS NULL
         ORDER BY m.created_at DESC LIMIT ${Math.min(limit, 30)}`,
        [userId]
      ) as Promise<any[]>,
    ]);
    const data = [...notifications, ...auditRows, ...systemMessages]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, limit);
    res.json({ data });
  } catch (error) {
    console.error('Work Hub activity error:', error);
    res.status(500).json({ error: 'Failed to load activity' });
  }
});

router.post('/device-tokens', async (req: Request, res: Response) => {
  try {
    const userId = currentUserId(req);
    const token = String(req.body?.token || '').trim();
    if (!token) return res.status(400).json({ error: 'Device token is required' });
    await dbRun(
      `INSERT INTO workhub_device_tokens (user_id, token, platform, device_name, last_seen_at)
       VALUES (?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE user_id = VALUES(user_id), platform = VALUES(platform),
                               device_name = VALUES(device_name), last_seen_at = NOW()`,
      [userId, token, req.body?.platform || null, req.body?.device_name || null]
    );
    res.status(201).json({ message: 'Device registered' });
  } catch (error) {
    console.error('Work Hub device token error:', error);
    res.status(500).json({ error: 'Failed to register device' });
  }
});

export default router;
