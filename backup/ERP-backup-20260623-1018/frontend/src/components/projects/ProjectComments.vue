<template>
  <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6 min-h-[400px]">
    <h3 class="text-lg font-bold text-gray-800 mb-6">Discussion & Comments</h3>
    
    <div v-if="loading" class="text-center py-8">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
    </div>

    <div v-else>
      <!-- Comments List -->
      <div class="space-y-6 mb-8" v-if="comments.length">
        <div v-for="comment in comments" :key="comment.id" class="flex gap-4 group">
          <div class="w-10 h-10 rounded-full flex items-center justify-center font-bold shrink-0 text-sm"
            :class="getAvatarColor(comment.user_name)">
            {{ getInitials(comment.user_name) }}
          </div>
          <div class="bg-gray-50 p-4 rounded-lg rounded-tl-none border border-gray-100 flex-1">
            <div class="flex justify-between items-center mb-2">
              <span class="font-bold text-sm">{{ comment.user_name || 'Unknown' }}</span>
              <div class="flex items-center gap-2">
                <span class="text-xs text-gray-500">{{ timeAgo(comment.created_at) }}</span>
                <button @click="deleteComment(comment.id)" class="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" title="Delete">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
              </div>
            </div>
            <p class="text-sm text-gray-700 whitespace-pre-wrap">{{ comment.content }}</p>
          </div>
        </div>
      </div>
      <p v-else class="text-sm text-gray-400 mb-8 text-center py-8">No comments yet. Start the discussion!</p>

      <!-- Comment Input -->
      <div class="flex gap-4 items-start border-t border-gray-100 pt-6">
        <div class="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold shrink-0 text-sm">
          {{ currentUserInitials }}
        </div>
        <div class="flex-1">
          <textarea 
            v-model="newComment"
            class="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none" 
            rows="3" 
            placeholder="Leave a comment..."
            @keydown.ctrl.enter="postComment"
          ></textarea>
          <div class="flex justify-between items-center mt-2">
            <span class="text-xs text-gray-400">Ctrl + Enter to post</span>
            <button 
              @click="postComment" 
              :disabled="!newComment.trim() || posting"
              class="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 font-medium disabled:opacity-50"
            >
              {{ posting ? 'Posting...' : 'Post Comment' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { api } from '@/lib/api';

const route = useRoute();
const projectId = route.params.id as string;

const comments = ref<any[]>([]);
const loading = ref(true);
const newComment = ref('');
const posting = ref(false);
const currentUserInitials = ref('ME');

const avatarColors = [
  'bg-blue-100 text-blue-700',
  'bg-purple-100 text-purple-700',
  'bg-green-100 text-green-700',
  'bg-pink-100 text-pink-700',
  'bg-orange-100 text-orange-700',
  'bg-teal-100 text-teal-700',
];

const getInitials = (name: string) => {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
};

const getAvatarColor = (name: string) => {
  if (!name) return avatarColors[0];
  const hash = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return avatarColors[hash % avatarColors.length];
};

const timeAgo = (dateStr: string) => {
  if (!dateStr) return '';
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
};

const loadComments = async () => {
  loading.value = true;
  try {
    const res = await api.get(`/projects/${projectId}/comments`);
    comments.value = Array.isArray(res.data) ? res.data : [];
  } catch (err) {
    console.error('Failed to load comments:', err);
    comments.value = [];
  } finally {
    loading.value = false;
  }
};

const postComment = async () => {
  if (!newComment.value.trim() || posting.value) return;
  posting.value = true;
  try {
    await api.post(`/projects/${projectId}/comments`, { content: newComment.value });
    newComment.value = '';
    await loadComments();
  } catch (err) {
    console.error('Failed to post comment:', err);
    alert('Failed to post comment');
  } finally {
    posting.value = false;
  }
};

const deleteComment = async (id: number) => {
  if (!confirm('Delete this comment?')) return;
  try {
    await api.delete(`/projects/comments/${id}`);
    comments.value = comments.value.filter(c => c.id !== id);
  } catch (err) {
    console.error('Failed to delete comment:', err);
  }
};

// Get current user initials
try {
  const userStr = localStorage.getItem('user');
  if (userStr) {
    const user = JSON.parse(userStr);
    currentUserInitials.value = getInitials(user.full_name || user.name || 'ME');
  }
} catch {}

onMounted(loadComments);
</script>
