const PAGE_SIZE = 12;
let currentOffset = 0;
let hasMore = true;
let loading = false;
let loadedPhotos = [];
let lightboxIndex = -1;
let currentUserId = null;

const AVATAR_COLORS = ['#2563eb', '#7c3aed', '#db2777', '#ea580c', '#16a34a', '#0891b2', '#ca8a04', '#4f46e5', '#059669', '#6366f1'];

function timeAgo(dateStr) {
  const now = new Date();
  const date = new Date(dateStr);
  const seconds = Math.floor((now - date) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString();
}

function fullDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function avatarHtml(name) {
  const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const color = AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
  return `<span class="avatar avatar-sm" style="background:${color}">${escapeHtml(initials)}</span>`;
}

async function fetchGallery(offset, limit) {
  const { data, error } = await supabase
    .from('submissions')
    .select(`id, image_url, uploaded_at, profiles(display_name)`)
    .order('uploaded_at', { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw error;
  return data;
}

function renderPhoto(item, index) {
  const card = document.createElement('div');
  card.className = 'gallery-card';
  card.innerHTML = `
    <div class="gallery-card-image">
      <img src="${escapeHtml(item.image_url)}" alt="Bhaiya sighting" loading="lazy">
    </div>
    <div class="gallery-card-info">
      <span class="gallery-card-name">${escapeHtml(item.profiles.display_name)}</span>
      <span class="gallery-card-time">${timeAgo(item.uploaded_at)}</span>
    </div>`;
  card.querySelector('.gallery-card-image').style.cursor = 'pointer';
  card.querySelector('.gallery-card-image').addEventListener('click', () => openLightbox(index));
  return card;
}

function openLightbox(index) {
  const item = loadedPhotos[index];
  if (!item) return;
  lightboxIndex = index;

  document.getElementById('lightboxImage').src = item.image_url;
  document.getElementById('lightboxName').textContent = item.profiles.display_name;
  document.getElementById('lightboxTime').textContent = fullDate(item.uploaded_at);
  document.getElementById('lightboxCounter').textContent = `${index + 1} of ${loadedPhotos.length}`;

  document.getElementById('lightbox').classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  loadComments(item.id);
  loadVotes(item.id);
}

function closeLightbox() {
  document.getElementById('lightboxImage').src = '';
  lightboxIndex = -1;
  document.getElementById('lightbox').classList.add('hidden');
  document.body.style.overflow = '';
  const cl = document.getElementById('commentsList');
  if (cl) cl.innerHTML = '';
  const ci = document.getElementById('commentInput');
  if (ci) ci.value = '';
}

function navigateLightbox(direction) {
  let newIndex = lightboxIndex + direction;
  if (newIndex < 0) newIndex = loadedPhotos.length - 1;
  if (newIndex >= loadedPhotos.length) newIndex = 0;
  openLightbox(newIndex);
}

async function loadComments(submissionId) {
  const commentsList = document.getElementById('commentsList');
  const commentsLoading = document.getElementById('commentsLoading');
  commentsList.innerHTML = '';
  commentsLoading.classList.remove('hidden');

  const { data, error } = await supabase
    .from('comments')
    .select(`id, content, created_at, parent_id, profiles(display_name)`)
    .eq('submission_id', submissionId)
    .order('created_at', { ascending: true });

  commentsLoading.classList.add('hidden');
  if (error || !data) return;

  if (data.length === 0) {
    commentsList.innerHTML = '<p class="comments-empty">No comments yet. Be the first!</p>';
    return;
  }

  const parents = data.filter(c => !c.parent_id);

  parents.forEach(parent => {
    const replies = data.filter(c => c.parent_id === parent.id);
    commentsList.appendChild(renderCommentItem(parent, false));
    replies.forEach(reply => commentsList.appendChild(renderCommentItem(reply, true)));
  });

  commentsList.scrollTop = commentsList.scrollHeight;
}

function renderCommentItem(c, isReply) {
  const div = document.createElement('div');
  div.className = 'comment-item' + (isReply ? ' comment-reply' : '');
  div.dataset.commentId = c.id;
  div.innerHTML = `
    <div class="comment-avatar">${avatarHtml(c.profiles.display_name)}</div>
    <div class="comment-body">
      <div class="comment-header">
        <span class="comment-name">${escapeHtml(c.profiles.display_name)}</span>
        <span class="comment-time">${timeAgo(c.created_at)}</span>
      </div>
      <p class="comment-content">${escapeHtml(c.content)}</p>
      ${!isReply ? '<button class="reply-btn">Reply</button>' : ''}
      <div class="reply-box hidden">
        <textarea class="reply-input" rows="2" placeholder="Write a reply..."></textarea>
        <div class="reply-actions">
          <button class="reply-cancel btn btn-outline btn-sm">Cancel</button>
          <button class="reply-submit btn btn-primary btn-sm">Reply</button>
        </div>
      </div>
    </div>`;

  if (!isReply) {
    const replyBtn = div.querySelector('.reply-btn');
    const replyBox = div.querySelector('.reply-box');
    const replyInput = div.querySelector('.reply-input');
    const replyCancel = div.querySelector('.reply-cancel');
    const replySubmit = div.querySelector('.reply-submit');

    replyBtn.addEventListener('click', () => {
      replyBox.classList.toggle('hidden');
      if (!replyBox.classList.contains('hidden')) replyInput.focus();
    });

    replyCancel.addEventListener('click', () => {
      replyBox.classList.add('hidden');
      replyInput.value = '';
    });

    replySubmit.addEventListener('click', async () => {
      const content = replyInput.value.trim();
      if (!content) return;
      const item = loadedPhotos[lightboxIndex];
      if (!item) return;
      replySubmit.disabled = true;
      try {
        await submitComment(item.id, content, c.id);
        replyInput.value = '';
        replyBox.classList.add('hidden');
        await loadComments(item.id);
      } catch (err) {
        console.error('Failed to post reply:', err);
      } finally {
        replySubmit.disabled = false;
      }
    });
  }

  return div;
}

async function submitComment(submissionId, content, parentId) {
  const user = await getCurrentUser();
  if (!user) return;
  const { error } = await supabase.from('comments').insert({
    submission_id: submissionId,
    user_id: user.id,
    content: content,
    parent_id: parentId || null
  });
  if (error) throw error;
}

async function loadVotes(submissionId) {
  const voteUpBtn = document.getElementById('voteUpBtn');
  const voteDownBtn = document.getElementById('voteDownBtn');
  const voteCount = document.getElementById('voteCount');

  const { data, error } = await supabase
    .from('votes')
    .select('value, user_id')
    .eq('submission_id', submissionId);

  let score = 0;
  let userVote = 0;

  if (data) {
    data.forEach(v => {
      score += v.value;
      if (v.user_id === currentUserId) userVote = v.value;
    });
  }

  voteCount.textContent = score;
  voteUpBtn.classList.toggle('voted', userVote === 1);
  voteDownBtn.classList.toggle('voted', userVote === -1);
}

async function handleVote(submissionId, value) {
  if (!currentUserId) return;

  const { data: existing } = await supabase
    .from('votes')
    .select('id, value')
    .eq('submission_id', submissionId)
    .eq('user_id', currentUserId)
    .single();

  if (existing) {
    if (existing.value === value) {
      await supabase.from('votes').delete().eq('id', existing.id);
    } else {
      await supabase.from('votes').update({ value }).eq('id', existing.id);
    }
  } else {
    await supabase.from('votes').insert({ submission_id: submissionId, user_id: currentUserId, value });
  }

  loadVotes(submissionId);
}

async function loadMore() {
  if (loading || !hasMore) return;
  loading = true;

  const loadMoreBtn = document.getElementById('loadMoreBtn');
  const loadMoreStatus = document.getElementById('loadMoreStatus');
  const galleryGrid = document.getElementById('galleryGrid');
  const galleryLoading = document.getElementById('galleryLoading');
  const galleryError = document.getElementById('galleryError');
  const galleryEmpty = document.getElementById('galleryEmpty');
  const loadMoreContainer = document.getElementById('loadMoreContainer');

  loadMoreBtn.disabled = true;
  loadMoreStatus.classList.add('hidden');

  try {
    const photos = await fetchGallery(currentOffset, PAGE_SIZE);
    if (currentOffset === 0) {
      galleryLoading.classList.add('hidden');
      if (!photos || photos.length === 0) { galleryEmpty.classList.remove('hidden'); return; }
    }
    photos.forEach(item => {
      loadedPhotos.push(item);
      galleryGrid.appendChild(renderPhoto(item, loadedPhotos.length - 1));
    });
    currentOffset += photos.length;
    hasMore = photos.length === PAGE_SIZE;
    if (hasMore) loadMoreContainer.classList.remove('hidden');
    else loadMoreContainer.classList.add('hidden');
  } catch (err) {
    if (currentOffset === 0) {
      galleryLoading.classList.add('hidden');
      galleryError.textContent = 'Failed to load gallery. Please refresh.';
      galleryError.classList.remove('hidden');
    } else {
      loadMoreStatus.textContent = 'Failed to load more. Try again.';
      loadMoreStatus.classList.remove('hidden');
    }
  } finally {
    loading = false;
    loadMoreBtn.disabled = false;
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const notLoggedIn = document.getElementById('notLoggedIn');
  const gallerySection = document.getElementById('gallerySection');
  const lightbox = document.getElementById('lightbox');

  const user = await getCurrentUser();
  if (!user) { notLoggedIn.classList.remove('hidden'); return; }

  currentUserId = user.id;
  await ensureProfile(user);
  notLoggedIn.classList.add('hidden');
  gallerySection.classList.remove('hidden');

  document.getElementById('loadMoreBtn')?.addEventListener('click', loadMore);
  document.getElementById('lightboxClose')?.addEventListener('click', closeLightbox);
  document.getElementById('lightboxPrev')?.addEventListener('click', () => navigateLightbox(-1));
  document.getElementById('lightboxNext')?.addEventListener('click', () => navigateLightbox(1));

  lightbox?.addEventListener('click', e => { if (e.target === lightbox) closeLightbox(); });

  document.addEventListener('keydown', e => {
    if (!lightbox || lightbox.classList.contains('hidden')) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') navigateLightbox(-1);
    if (e.key === 'ArrowRight') navigateLightbox(1);
  });

  document.getElementById('commentForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    const input = document.getElementById('commentInput');
    const content = input.value.trim();
    if (!content) return;
    const item = loadedPhotos[lightboxIndex];
    if (!item) return;
    const btn = e.target.querySelector('button');
    btn.disabled = true;
    try {
      await submitComment(item.id, content);
      input.value = '';
      await loadComments(item.id);
    } catch (err) {
      console.error('Failed to post comment:', err);
    } finally {
      btn.disabled = false;
      input.focus();
    }
  });

  document.getElementById('voteUpBtn')?.addEventListener('click', () => {
    const item = loadedPhotos[lightboxIndex];
    if (item) handleVote(item.id, 1);
  });

  document.getElementById('voteDownBtn')?.addEventListener('click', () => {
    const item = loadedPhotos[lightboxIndex];
    if (item) handleVote(item.id, -1);
  });

  if (document.getElementById('galleryGrid')) loadMore();
});
