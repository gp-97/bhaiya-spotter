const PAGE_SIZE = 12;
let currentOffset = 0;
let hasMore = true;
let loading = false;

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

function renderPhoto(item) {
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
    openLightbox(item.image_url, item.profiles.display_name, item.uploaded_at);
  });

  return card;
}

function openLightbox(url, name, dateStr) {
  const lightbox = document.getElementById('lightbox');
  const lightboxImage = document.getElementById('lightboxImage');
  const lightboxName = document.getElementById('lightboxName');
  const lightboxTime = document.getElementById('lightboxTime');

  lightboxImage.src = url;
  lightboxName.textContent = name;
  lightboxTime.textContent = timeAgo(dateStr);
  lightbox.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  const lightbox = document.getElementById('lightbox');
  const lightboxImage = document.getElementById('lightboxImage');

  lightbox.classList.add('hidden');
  lightboxImage.src = '';
  document.body.style.overflow = '';
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
      galleryGrid.appendChild(renderPhoto(item));
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

document.addEventListener('DOMContentLoaded', () => {
  const loadMoreBtn = document.getElementById('loadMoreBtn');
  const lightbox = document.getElementById('lightbox');
  const lightboxClose = document.getElementById('lightboxClose');

  if (loadMoreBtn) {
    loadMoreBtn.addEventListener('click', loadMore);
  }

  if (lightboxClose) {
    lightboxClose.addEventListener('click', closeLightbox);
  }

  if (lightbox) {
    lightbox.addEventListener('click', (e) => {
      if (e.target === lightbox) closeLightbox();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && lightbox && !lightbox.classList.contains('hidden')) {
      closeLightbox();
    }
  });

  if (document.getElementById('galleryGrid')) {
    loadMore();
  }
});
