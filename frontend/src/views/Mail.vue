<template>
  <div class="mail-container flex h-[calc(100vh-64px)] bg-gray-50 overflow-hidden">
    <!-- account setup modal -->
    <div v-if="showSetup" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div class="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
        <h3 class="text-lg font-semibold mb-4">Email Account Setup</h3>
        <p class="text-sm text-gray-500 mb-4">Connect your Gmail account. Use an <a href="https://myaccount.google.com/apppasswords" target="_blank" class="text-blue-600 underline">App Password</a> for authentication.</p>
        <div class="space-y-3">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
            <input v-model="setupForm.email_address" type="email" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="you@gmail.com" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Display Name</label>
            <input v-model="setupForm.display_name" type="text" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Your Name" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">App Password</label>
            <input v-model="setupForm.password" type="password" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="xxxx xxxx xxxx xxxx" />
          </div>
          <div class="flex items-center gap-2">
            <button @click="toggleAdvanced" class="text-sm text-blue-600 hover:underline">{{ showAdvanced ? 'Hide' : 'Show' }} Advanced Settings</button>
          </div>
          <template v-if="showAdvanced">
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-medium text-gray-600 mb-1">IMAP Host</label>
                <input v-model="setupForm.imap_host" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              <div>
                <label class="block text-xs font-medium text-gray-600 mb-1">IMAP Port</label>
                <input v-model.number="setupForm.imap_port" type="number" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              <div>
                <label class="block text-xs font-medium text-gray-600 mb-1">SMTP Host</label>
                <input v-model="setupForm.smtp_host" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              <div>
                <label class="block text-xs font-medium text-gray-600 mb-1">SMTP Port</label>
                <input v-model.number="setupForm.smtp_port" type="number" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
            </div>
          </template>
        </div>
        <div v-if="setupError" class="mt-3 text-sm text-red-600 bg-red-50 p-2 rounded">{{ setupError }}</div>
        <div v-if="setupSuccess" class="mt-3 text-sm text-green-600 bg-green-50 p-2 rounded">{{ setupSuccess }}</div>
        <div class="flex justify-end gap-3 mt-5">
          <button v-if="hasAccount" @click="showSetup = false" class="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
          <button @click="testConnection" :disabled="setupLoading" class="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm">
            {{ setupLoading ? 'Testing...' : 'Test Connection' }}
          </button>
          <button @click="saveAccount" :disabled="setupLoading || !setupForm.email_address || !setupForm.password" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm disabled:opacity-50">
            Save
          </button>
        </div>
      </div>
    </div>

    <!-- compose modal -->
    <div v-if="showCompose" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div class="bg-white rounded-xl shadow-2xl w-full max-w-2xl flex flex-col" style="max-height: 85vh">
        <div class="flex items-center justify-between px-5 py-3 border-b">
          <h3 class="text-lg font-semibold">{{ composeMode === 'reply' ? 'Reply' : composeMode === 'forward' ? 'Forward' : 'New Email' }}</h3>
          <button @click="showCompose = false" class="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>
        <div class="p-5 space-y-3 overflow-y-auto flex-1">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">To</label>
            <input v-model="composeForm.to" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="recipient@example.com" />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">CC</label>
              <input v-model="composeForm.cc" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="cc@example.com" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">BCC</label>
              <input v-model="composeForm.bcc" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="bcc@example.com" />
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Subject</label>
            <input v-model="composeForm.subject" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Message</label>
            <div ref="editorRef" class="border border-gray-300 rounded-lg min-h-[200px] p-3 focus-within:ring-2 focus-within:ring-blue-500" contenteditable="true" @input="onEditorInput"></div>
          </div>
        </div>
        <div v-if="composeError" class="px-5 pb-2 text-sm text-red-600">{{ composeError }}</div>
        <div class="flex justify-end gap-3 px-5 py-3 border-t bg-gray-50 rounded-b-xl">
          <button @click="showCompose = false" class="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Discard</button>
          <button @click="sendEmail" :disabled="sending || !composeForm.to || !composeForm.subject" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 flex items-center gap-2">
            <svg v-if="sending" class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/></svg>
            {{ sending ? 'Sending...' : 'Send' }}
          </button>
        </div>
      </div>
    </div>

    <!-- left sidebar: folders -->
    <div class="w-56 bg-white border-r border-gray-200 flex flex-col shrink-0">
      <div class="p-3 border-b">
        <button @click="openCompose('new')" class="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition-colors">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
          Compose
        </button>
      </div>
      <nav class="flex-1 overflow-y-auto py-2">
        <button
          v-for="f in displayFolders"
          :key="f.path"
          @click="selectFolder(f.path)"
          class="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-left transition-colors"
          :class="currentFolder === f.path ? 'bg-blue-50 text-blue-700 font-medium border-r-2 border-blue-600' : 'text-gray-700 hover:bg-gray-50'"
        >
          <span class="w-5 text-center" v-html="f.icon"></span>
          <span class="flex-1">{{ f.label }}</span>
          <span v-if="f.path === 'INBOX' && unreadCount > 0" class="bg-blue-600 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[20px] text-center">{{ unreadCount }}</span>
        </button>
      </nav>
      <div class="p-3 border-t">
        <button @click="showSetup = true" class="w-full text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1 justify-center">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.573-1.066z"/><circle cx="12" cy="12" r="3"/></svg>
          Email Settings
        </button>
      </div>
    </div>

    <!-- center: message list -->
    <div class="w-96 bg-white border-r border-gray-200 flex flex-col shrink-0">
      <div class="px-4 py-3 border-b flex items-center justify-between">
        <h2 class="font-semibold text-gray-800">{{ folderLabel }}</h2>
        <button @click="loadMessages" class="text-gray-400 hover:text-gray-600 p-1" title="Refresh">
          <svg class="w-4 h-4" :class="{ 'animate-spin': loadingMessages }" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
        </button>
      </div>

      <div v-if="loadingMessages" class="flex-1 flex items-center justify-center">
        <div class="flex flex-col items-center gap-2">
          <svg class="animate-spin h-6 w-6 text-blue-500" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/></svg>
          <span class="text-sm text-gray-500">Loading emails...</span>
        </div>
      </div>

      <div v-else-if="messages.length === 0" class="flex-1 flex items-center justify-center">
        <div class="text-center text-gray-400">
          <svg class="w-12 h-12 mx-auto mb-2 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
          <p class="text-sm">No emails</p>
        </div>
      </div>

      <div v-else class="flex-1 overflow-y-auto">
        <div
          v-for="msg in messages"
          :key="msg.uid"
          @click="selectMessage(msg)"
          class="px-4 py-3 border-b border-gray-100 cursor-pointer transition-colors"
          :class="[
            selectedMessage?.uid === msg.uid ? 'bg-blue-50' : 'hover:bg-gray-50',
            !msg.seen ? 'bg-blue-50/40' : ''
          ]"
        >
          <div class="flex items-start gap-2">
            <button @click.stop="toggleStar(msg)" class="mt-0.5 shrink-0">
              <svg class="w-4 h-4" :class="msg.flagged ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/></svg>
            </button>
            <div class="flex-1 min-w-0">
              <div class="flex items-center justify-between">
                <span class="text-sm truncate" :class="!msg.seen ? 'font-semibold text-gray-900' : 'text-gray-700'">
                  {{ getDisplayName(msg.from) }}
                </span>
                <span class="text-xs text-gray-400 shrink-0 ml-2">{{ formatDate(msg.date) }}</span>
              </div>
              <p class="text-sm truncate" :class="!msg.seen ? 'font-medium text-gray-800' : 'text-gray-600'">{{ msg.subject }}</p>
              <div class="flex items-center gap-1 mt-0.5">
                <svg v-if="msg.hasAttachment" class="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/></svg>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- pagination -->
      <div v-if="totalPages > 1" class="px-4 py-2 border-t flex items-center justify-between text-sm bg-gray-50">
        <button @click="goPage(currentPage - 1)" :disabled="currentPage <= 1" class="text-blue-600 hover:underline disabled:text-gray-300">&laquo; Prev</button>
        <span class="text-gray-500">{{ currentPage }} / {{ totalPages }}</span>
        <button @click="goPage(currentPage + 1)" :disabled="currentPage >= totalPages" class="text-blue-600 hover:underline disabled:text-gray-300">Next &raquo;</button>
      </div>
    </div>

    <!-- right: email reader -->
    <div class="flex-1 bg-white flex flex-col overflow-hidden">
      <div v-if="!selectedMessage && !loadingDetail" class="flex-1 flex items-center justify-center">
        <div class="text-center text-gray-400">
          <svg class="w-16 h-16 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
          <p>Select an email to read</p>
        </div>
      </div>

      <div v-if="loadingDetail" class="flex-1 flex items-center justify-center">
        <svg class="animate-spin h-6 w-6 text-blue-500" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/></svg>
      </div>

      <template v-if="emailDetail && !loadingDetail">
        <!-- email header -->
        <div class="px-6 py-4 border-b">
          <div class="flex items-start justify-between">
            <h2 class="text-xl font-semibold text-gray-900">{{ emailDetail.subject }}</h2>
            <div class="flex items-center gap-2 shrink-0 ml-4">
              <button @click="openCompose('reply')" class="p-2 hover:bg-gray-100 rounded-lg" title="Reply">
                <svg class="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"/></svg>
              </button>
              <button @click="openCompose('forward')" class="p-2 hover:bg-gray-100 rounded-lg" title="Forward">
                <svg class="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6"/></svg>
              </button>
              <button @click="deleteMessage" class="p-2 hover:bg-red-50 rounded-lg" title="Delete">
                <svg class="w-4 h-4 text-gray-600 hover:text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
              </button>
            </div>
          </div>
          <div class="mt-3 flex items-center gap-3">
            <div class="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold text-sm shrink-0">
              {{ getInitials(emailDetail.from) }}
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-gray-900">{{ getFromDisplay(emailDetail.from) }}</p>
              <p class="text-xs text-gray-500">To: {{ getToDisplay(emailDetail.to) }}</p>
              <p v-if="emailDetail.cc?.length" class="text-xs text-gray-400">CC: {{ getToDisplay(emailDetail.cc) }}</p>
            </div>
            <span class="text-xs text-gray-400 shrink-0">{{ formatFullDate(emailDetail.date) }}</span>
          </div>
        </div>

        <!-- attachments -->
        <div v-if="emailDetail.attachments?.length" class="px-6 py-2 border-b bg-gray-50">
          <div class="flex flex-wrap gap-2">
            <button
              v-for="att in emailDetail.attachments"
              :key="att.id"
              @click="downloadAttachment(att)"
              class="flex items-center gap-1.5 px-3 py-1.5 bg-white border rounded-lg text-sm text-gray-700 hover:bg-blue-50 hover:border-blue-300 transition-colors cursor-pointer"
            >
              <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/></svg>
              {{ att.filename }}
              <span class="text-xs text-gray-400">({{ formatSize(att.size) }})</span>
            </button>
          </div>
        </div>

        <!-- email body -->
        <div class="flex-1 overflow-y-auto px-6 py-4">
          <div v-if="emailDetail.html" class="email-body" v-html="sanitizedHtml"></div>
          <pre v-else-if="emailDetail.text" class="whitespace-pre-wrap text-sm text-gray-800 font-sans">{{ emailDetail.text }}</pre>
          <p v-else class="text-gray-400 italic">No content</p>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { api } from '../lib/api';

interface EmailMessage {
  uid: number;
  subject: string;
  from: { name: string; address: string }[];
  to: { name: string; address: string }[];
  date: string | null;
  flags: string[];
  seen: boolean;
  flagged: boolean;
  hasAttachment: boolean;
}

interface EmailDetail {
  uid: number;
  subject: string;
  from: { name: string; address: string }[];
  to: { name: string; address: string }[];
  cc: { name: string; address: string }[];
  bcc: { name: string; address: string }[];
  date: string | null;
  messageId: string | null;
  inReplyTo: string | null;
  html: string | null;
  text: string | null;
  attachments: { id: number; filename: string; contentType: string; size: number }[];
}

interface Folder {
  path: string;
  name: string;
  specialUse: string | null;
}

// state
const showSetup = ref(false);
const hasAccount = ref(false);
const showAdvanced = ref(false);
const setupLoading = ref(false);
const setupError = ref('');
const setupSuccess = ref('');

const setupForm = ref({
  email_address: '',
  display_name: '',
  password: '',
  imap_host: 'imap.gmail.com',
  imap_port: 993,
  smtp_host: 'smtp.gmail.com',
  smtp_port: 465,
});

const folders = ref<Folder[]>([]);
const currentFolder = ref('INBOX');
const messages = ref<EmailMessage[]>([]);
const loadingMessages = ref(false);
const currentPage = ref(1);
const totalPages = ref(0);
const totalMessages = ref(0);
const unreadCount = ref(0);

const selectedMessage = ref<EmailMessage | null>(null);
const emailDetail = ref<EmailDetail | null>(null);
const loadingDetail = ref(false);

const showCompose = ref(false);
const composeMode = ref<'new' | 'reply' | 'forward'>('new');
const sending = ref(false);
const composeError = ref('');
const editorRef = ref<HTMLElement | null>(null);
const composeForm = ref({ to: '', cc: '', bcc: '', subject: '', html: '' });

// folder display config
const folderMap: Record<string, { label: string; icon: string }> = {
  'INBOX': { label: 'Inbox', icon: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"/></svg>' },
  '[Gmail]/Sent Mail': { label: 'Sent', icon: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>' },
  '[Gmail]/Drafts': { label: 'Drafts', icon: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>' },
  '[Gmail]/Starred': { label: 'Starred', icon: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/></svg>' },
  '[Gmail]/Trash': { label: 'Trash', icon: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>' },
  '[Gmail]/Spam': { label: 'Spam', icon: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4.99c-.77-1.33-2.69-1.33-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z"/></svg>' },
  '[Gmail]/All Mail': { label: 'All Mail', icon: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/></svg>' },
};

const displayFolders = computed(() => {
  const priority = ['INBOX', '[Gmail]/Sent Mail', '[Gmail]/Drafts', '[Gmail]/Starred', '[Gmail]/Trash', '[Gmail]/Spam'];
  const ordered = priority.filter(p => folders.value.some(f => f.path === p));
  return ordered.map(path => ({
    path,
    label: folderMap[path]?.label || path,
    icon: folderMap[path]?.icon || '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/></svg>',
  }));
});

const folderLabel = computed(() => folderMap[currentFolder.value]?.label || currentFolder.value);

const sanitizedHtml = computed(() => {
  if (!emailDetail.value?.html) return '';
  // basic sanitization: remove script tags
  return emailDetail.value.html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+="[^"]*"/gi, '')
    .replace(/on\w+='[^']*'/gi, '');
});

// lifecycle
onMounted(async () => {
  await checkAccount();
});

async function checkAccount() {
  try {
    const res = await api.get('/mail/account');
    if (res.data.account) {
      hasAccount.value = true;
      setupForm.value.email_address = res.data.account.email_address;
      setupForm.value.display_name = res.data.account.display_name || '';
      await loadFolders();
      await loadMessages();
      await loadUnreadCount();
    } else {
      showSetup.value = true;
    }
  } catch {
    showSetup.value = true;
  }
}

async function loadFolders() {
  try {
    const res = await api.get('/mail/folders');
    folders.value = res.data.folders || [];
  } catch (err: any) {
    console.error('Load folders error:', err);
  }
}

async function loadMessages() {
  loadingMessages.value = true;
  try {
    const res = await api.get('/mail/messages', { params: { folder: currentFolder.value, page: currentPage.value, limit: 25 } });
    messages.value = res.data.messages || [];
    totalMessages.value = res.data.total || 0;
    totalPages.value = res.data.pages || 0;
  } catch (err: any) {
    console.error('Load messages error:', err);
  } finally {
    loadingMessages.value = false;
  }
}

async function loadUnreadCount() {
  try {
    const res = await api.get('/mail/unread-count');
    unreadCount.value = res.data.count || 0;
  } catch { /* ignore */ }
}

function selectFolder(path: string) {
  currentFolder.value = path;
  currentPage.value = 1;
  selectedMessage.value = null;
  emailDetail.value = null;
  loadMessages();
}

async function selectMessage(msg: EmailMessage) {
  selectedMessage.value = msg;
  loadingDetail.value = true;
  try {
    const res = await api.get(`/mail/messages/${msg.uid}`, { params: { folder: currentFolder.value } });
    emailDetail.value = res.data.message;
    // mark as read in list
    msg.seen = true;
  } catch (err: any) {
    console.error('Load email detail error:', err);
  } finally {
    loadingDetail.value = false;
  }
}

async function toggleStar(msg: EmailMessage) {
  const newState = !msg.flagged;
  msg.flagged = newState;
  try {
    await api.patch(`/mail/messages/${msg.uid}/star`, { starred: newState }, { params: { folder: currentFolder.value } });
  } catch {
    msg.flagged = !newState;
  }
}

async function deleteMessage() {
  if (!selectedMessage.value) return;
  const uid = selectedMessage.value.uid;
  try {
    await api.delete(`/mail/messages/${uid}`, { params: { folder: currentFolder.value } });
    messages.value = messages.value.filter(m => m.uid !== uid);
    selectedMessage.value = null;
    emailDetail.value = null;
  } catch (err: any) {
    console.error('Delete error:', err);
  }
}

function goPage(p: number) {
  if (p < 1 || p > totalPages.value) return;
  currentPage.value = p;
  selectedMessage.value = null;
  emailDetail.value = null;
  loadMessages();
}

// compose
function openCompose(mode: 'new' | 'reply' | 'forward') {
  composeMode.value = mode;
  composeError.value = '';

  if (mode === 'new') {
    composeForm.value = { to: '', cc: '', bcc: '', subject: '', html: '' };
  } else if (mode === 'reply' && emailDetail.value) {
    const from = emailDetail.value.from?.[0];
    composeForm.value = {
      to: from ? `${from.name ? from.name + ' ' : ''}<${from.address}>` : '',
      cc: '',
      bcc: '',
      subject: `Re: ${emailDetail.value.subject?.replace(/^Re:\s*/i, '') || ''}`,
      html: '',
    };
  } else if (mode === 'forward' && emailDetail.value) {
    composeForm.value = {
      to: '',
      cc: '',
      bcc: '',
      subject: `Fwd: ${emailDetail.value.subject?.replace(/^Fwd:\s*/i, '') || ''}`,
      html: '',
    };
  }

  showCompose.value = true;

  // set editor content for forward
  setTimeout(() => {
    if (editorRef.value) {
      if (mode === 'forward' && emailDetail.value) {
        editorRef.value.innerHTML = `<br><br><hr><p><strong>Forwarded message:</strong></p>${emailDetail.value.html || emailDetail.value.text || ''}`;
      } else if (mode === 'reply' && emailDetail.value) {
        const from = emailDetail.value.from?.[0];
        editorRef.value.innerHTML = `<br><br><blockquote style="border-left:3px solid #ccc; padding-left:10px; color:#666;">On ${formatFullDate(emailDetail.value.date)}, ${from?.name || from?.address || ''} wrote:<br>${emailDetail.value.html || emailDetail.value.text || ''}</blockquote>`;
      } else {
        editorRef.value.innerHTML = '';
      }
    }
  }, 100);
}

function onEditorInput(e: Event) {
  composeForm.value.html = (e.target as HTMLElement).innerHTML;
}

async function sendEmail() {
  sending.value = true;
  composeError.value = '';
  try {
    const payload: any = {
      to: composeForm.value.to,
      subject: composeForm.value.subject,
      html: composeForm.value.html || '<p></p>',
    };
    if (composeForm.value.cc) payload.cc = composeForm.value.cc;
    if (composeForm.value.bcc) payload.bcc = composeForm.value.bcc;

    // threading
    if ((composeMode.value === 'reply' || composeMode.value === 'forward') && emailDetail.value?.messageId) {
      payload.inReplyTo = emailDetail.value.messageId;
      payload.references = emailDetail.value.messageId;
    }

    await api.post('/mail/send', payload);
    showCompose.value = false;
  } catch (err: any) {
    composeError.value = err.response?.data?.error || err.message;
  } finally {
    sending.value = false;
  }
}

// account setup
function toggleAdvanced() {
  showAdvanced.value = !showAdvanced.value;
}

async function testConnection() {
  setupLoading.value = true;
  setupError.value = '';
  setupSuccess.value = '';
  try {
    await api.post('/mail/account/test', {
      email_address: setupForm.value.email_address,
      password: setupForm.value.password,
      imap_host: setupForm.value.imap_host,
      imap_port: setupForm.value.imap_port,
    });
    setupSuccess.value = 'Connection successful!';
  } catch (err: any) {
    setupError.value = err.response?.data?.error || err.message;
  } finally {
    setupLoading.value = false;
  }
}

async function saveAccount() {
  setupLoading.value = true;
  setupError.value = '';
  try {
    await api.post('/mail/account', setupForm.value);
    hasAccount.value = true;
    showSetup.value = false;
    await loadFolders();
    await loadMessages();
    await loadUnreadCount();
  } catch (err: any) {
    setupError.value = err.response?.data?.error || err.message;
  } finally {
    setupLoading.value = false;
  }
}

// formatting helpers
function getDisplayName(from: { name: string; address: string }[]): string {
  if (!from?.length) return 'Unknown';
  return from[0].name || from[0].address || 'Unknown';
}

function getFromDisplay(from: { name: string; address: string }[]): string {
  if (!from?.length) return 'Unknown';
  const f = from[0];
  return f.name ? `${f.name} <${f.address}>` : f.address;
}

function getToDisplay(recipients: { name: string; address: string }[]): string {
  if (!recipients?.length) return '';
  return recipients.map(r => r.name || r.address).join(', ');
}

function getInitials(from: { name: string; address: string }[]): string {
  if (!from?.length) return '?';
  const name = from[0].name || from[0].address || '?';
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

function formatFullDate(dateStr: string | null): string {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

async function downloadAttachment(att: { id: number; filename: string; contentType: string }) {
  if (!selectedMessage.value) return;
  try {
    const res = await api.get(`/mail/messages/${selectedMessage.value.uid}/attachment/${att.id}`, {
      params: { folder: currentFolder.value },
      responseType: 'blob',
    });
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const link = document.createElement('a');
    link.href = url;
    link.download = att.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (err: any) {
    console.error('Download attachment error:', err);
  }
}
</script>

<style scoped>
.email-body :deep(img) {
  max-width: 100%;
  height: auto;
}
.email-body :deep(a) {
  color: #2563eb;
  text-decoration: underline;
}
.email-body :deep(blockquote) {
  border-left: 3px solid #d1d5db;
  padding-left: 12px;
  margin-left: 0;
  color: #6b7280;
}
.email-body :deep(table) {
  max-width: 100%;
  overflow-x: auto;
}
</style>
