import fs from 'fs';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { dbAll, dbRun } from '../config/database';

const keyPath = process.env.FIREBASE_ADMIN_KEY_PATH || '/etc/xlrate/firebase-admin.json';
let initialized = false;
function firebase() {
  if (!initialized && fs.existsSync(keyPath)) {
    if (!getApps().length) initializeApp({ credential: cert(JSON.parse(fs.readFileSync(keyPath, 'utf8'))) });
    initialized = true;
  }
  return initialized;
}

export async function sendWorkHubPush(recipientIds: number[], payload: { conversationId: number | string; title: string; body: string }) {
  if (!firebase() || !recipientIds.length) return;
  const tokens = await dbAll(`SELECT id, token FROM workhub_device_tokens WHERE user_id IN (${recipientIds.map(() => '?').join(',')})`, recipientIds) as any[];
  if (!tokens.length) return;
  const result = await getMessaging().sendEachForMulticast({
    tokens: tokens.map((row) => row.token),
    notification: { title: payload.title, body: payload.body },
    data: { conversation_id: String(payload.conversationId) },
    android: { priority: 'high', notification: { channelId: 'workhub', sound: 'default' } },
  });
  await Promise.all(result.responses.map((response: { success: boolean }, index: number) => response.success ? null : dbRun('DELETE FROM workhub_device_tokens WHERE id = ?', [tokens[index].id])));
}
