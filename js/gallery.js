const PAGE_SIZE = 12;
let currentOffset = 0;
let hasMore = true;
let loading = false;
let loadedPhotos = [];
let lightboxIndex = -1;

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
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

async function fetchGallery(offset, limit) {
  const { data, error } = await supabase
    .from('submissions')
    .select(`
      id,
      image_url,
      uploaded_at,
      profiles(display_name)
    `)
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
    </div>
  `;

  const imageDiv = card.querySelector('.gallery-card-image');
  imageDiv.style.cursor = 'pointer';
  imageDiv.addEventListener('click', () => {
    openLightbox(index);
  });

  return card;
}

function openLightbox(index) {
  const item = loadedPhotos[index];
  if (!item) return;

  lightboxIndex = index;

  const lightbox = document.getElementById('lightbox');
  const lightboxImage = document.getElementById('lightboxImage');
  const lightboxName = document.getElementById('lightboxName');
  const lightboxTime = document.getElementById('lightboxTime');
  const lightboxCounter = document.getElementById('lightboxCounter');

  lightboxImage.src = item.image_url;
  lightboxName.textContent = item.profiles.display_name;
  lightboxTime.textContent = fullDate(item.uploaded_at);
  lightboxCounter.textContent = `${index + 1} of ${loadedPhotos.length}`;

  const prevBtn = document.getElementById('lightboxPrev');
  const nextBtn = document.getElementById('lightboxNext');
  prevBtn.style.visibility = index > 0 ? 'visible' : 'hidden';
  nextBtn.style.visibility = index < loadedPhotos.length - 1 ? 'visible' : 'hidden';

  lightbox.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  const lightbox = document.getElementById('lightbox');
  const lightboxImage = document.getElementById('lightboxImage');

  lightbox.classList.add('hidden');
  lightboxImage.src = '';
  lightboxIndex = -1;
  document.body.style.overflow = '';
}

function navigateLightbox(direction) {
  const newIndex = lightboxIndex + direction;
  if (newIndex >= 0 && newIndex < loadedPhotos.length) {
    openLightbox(newIndex);
  }
}

async function loadMore() {
  if (loading || !hasMore) return;

  const loadMoreBtn = document.getElementById('loadMoreBtn');
  const loadMoreStatus = document.getElementById('loadMoreStatus');
  const galleryGrid = document.getElementById('galleryGrid');
  const galleryLoading = document.getElementById('galleryLoading');
  const galleryError = document.getElementById('galleryError');
  const galleryEmpty = document.getElementById('galleryEmpty');
  const loadMoreContainer = document.getElementById('loadMoreContainer');

  loading = true;
  loadMoreBtn.disabled = true;
  loadMoreStatus.classList.add('hidden');

  try {
    const photos = await fetchGallery(currentOffset, PAGE_SIZE);

    if (currentOffset === 0) {
      galleryLoading.classList.add('hidden');

      if (!photos || photos.length === 0) {
        galleryEmpty.classList.remove('hidden');
        return;
      }
    }

    photos.forEach(item => {
      loadedPhotos.push(item);
      galleryGrid.appendChild(renderPhoto(item, loadedPhotos.length - 1));
    });

    currentOffset += photos.length;
    hasMore = photos.length === PAGE_SIZE;

    if (hasMore) {
      loadMoreContainer.classList.remove('hidden');
    } else {
      loadMoreContainer.classList.add('hidden');
    }
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
  const loadMoreBtn = document.getElementById('loadMoreBtn');
  const lightbox = document.getElementById('lightbox');
  const lightboxClose = document.getElementById('lightboxClose');
  const lightboxPrev = document.getElementById('lightboxPrev');
  const lightboxNext = document.getElementById('lightboxNext');

  const user = await getCurrentUser();

  if (!user) {
    notLoggedIn.classList.remove('hidden');
    return;
  }

  await ensureProfile(user);
  notLoggedIn.classList.add('hidden');
  gallerySection.classList.remove('hidden');

  if (loadMoreBtn) {
    loadMoreBtn.addEventListener('click', loadMore);
  }

  if (lightboxClose) {
    lightboxClose.addEventListener('click', closeLightbox);
  }

  if (lightboxPrev) {
    lightboxPrev.addEventListener('click', () => navigateLightbox(-1));
  }

  if (lightboxNext) {
    lightboxNext.addEventListener('click', () => navigateLightbox(1));
  }

  if (lightbox) {
    lightbox.addEventListener('click', (e) => {
      if (e.target === lightbox) closeLightbox();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (!lightbox || lightbox.classList.contains('hidden')) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') navigateLightbox(-1);
    if (e.key === 'ArrowRight') navigateLightbox(1);
  });

  if (document.getElementById('galleryGrid')) {
    loadMore();
  }
});
