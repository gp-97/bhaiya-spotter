function compressImage(file, maxWidth, quality) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      resolve(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(file);
              return;
            }
            const compressed = new File([blob], file.name, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            resolve(compressed);
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = () => resolve(file);
      img.src = e.target.result;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}

async function uploadPhoto(file, userId) {
  const compressed = await compressImage(file, 1200, 0.8);

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${userId}/${Date.now()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from('submissions')
    .upload(path, compressed, { upsert: false });

  if (uploadError) throw uploadError;

  const { data: { publicUrl } } = supabase.storage
    .from('submissions')
    .getPublicUrl(path);

  const { error: dbError } = await supabase
    .from('submissions')
    .insert({ user_id: userId, image_url: publicUrl });

  if (dbError) throw dbError;

  return publicUrl;
}

async function fetchRecentUploads(userId) {
  const { data, error } = await supabase
    .from('submissions')
    .select('id, image_url, uploaded_at')
    .eq('user_id', userId)
    .order('uploaded_at', { ascending: false })
    .limit(12);

  if (error) throw error;
  return data;
}

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

document.addEventListener('DOMContentLoaded', async () => {
  const authChecking = document.getElementById('authChecking');
  const notLoggedIn = document.getElementById('notLoggedIn');
  const uploadSection = document.getElementById('uploadSection');
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');
  const previewContainer = document.getElementById('previewContainer');
  const previewImage = document.getElementById('previewImage');
  const removePreview = document.getElementById('removePreview');
  const uploadBtn = document.getElementById('uploadBtn');
  const uploadProgress = document.getElementById('uploadProgress');
  const progressBar = document.getElementById('progressBar');
  const uploadStatus = document.getElementById('uploadStatus');
  const uploadError = document.getElementById('uploadError');
  const recentLoading = document.getElementById('recentLoading');
  const recentEmpty = document.getElementById('recentEmpty');
  const recentError = document.getElementById('recentError');
  const recentGrid = document.getElementById('recentGrid');

  let selectedFile = null;

  const user = await getCurrentUser();

  if (authChecking) authChecking.classList.add('hidden');

  if (!user) {
    notLoggedIn.classList.remove('hidden');
    return;
  }

  await ensureProfile(user);

  uploadSection.classList.remove('hidden');
  loadRecentUploads();

  dropZone.addEventListener('click', () => fileInput.click());

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('drag-over');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  });

  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (file) handleFile(file);
  });

  removePreview.addEventListener('click', () => {
    selectedFile = null;
    fileInput.value = '';
    previewContainer.classList.add('hidden');
    uploadBtn.disabled = true;
  });

  uploadBtn.addEventListener('click', async () => {
    if (!selectedFile) return;

    uploadBtn.disabled = true;
    uploadProgress.classList.remove('hidden');
    progressBar.style.width = '30%';
    uploadStatus.classList.remove('hidden', 'success');
    uploadStatus.textContent = 'Uploading...';
    uploadError.classList.add('hidden');

    try {
      progressBar.style.width = '60%';
      await uploadPhoto(selectedFile, user.id);
      progressBar.style.width = '100%';

      uploadStatus.textContent = 'Upload complete!';
      uploadStatus.classList.add('success');

      selectedFile = null;
      fileInput.value = '';
      previewContainer.classList.add('hidden');

      setTimeout(() => {
        uploadProgress.classList.add('hidden');
        progressBar.style.width = '0%';
        uploadStatus.classList.add('hidden');
        uploadBtn.disabled = false;
      }, 2000);

      loadRecentUploads();
    } catch (err) {
      uploadProgress.classList.add('hidden');
      progressBar.style.width = '0%';
      uploadStatus.classList.add('hidden');
      uploadError.textContent = err.message || 'Upload failed. Please try again.';
      uploadError.classList.remove('hidden');
      uploadBtn.disabled = false;
    }
  });

  function handleFile(file) {
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      uploadError.textContent = 'File too large. Maximum size is 10 MB.';
      uploadError.classList.remove('hidden');
      return;
    }

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      uploadError.textContent = 'Invalid file type. Use JPG, PNG, or WebP.';
      uploadError.classList.remove('hidden');
      return;
    }

    selectedFile = file;
    uploadError.classList.add('hidden');
    uploadBtn.disabled = false;

    const reader = new FileReader();
    reader.onload = (e) => {
      previewImage.src = e.target.result;
      previewContainer.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
  }

  async function loadRecentUploads() {
    recentLoading.classList.remove('hidden');
    recentEmpty.classList.add('hidden');
    recentError.classList.add('hidden');
    recentGrid.innerHTML = '';

    try {
      const uploads = await fetchRecentUploads(user.id);
      recentLoading.classList.add('hidden');

      if (uploads.length === 0) {
        recentEmpty.classList.remove('hidden');
        return;
      }

      uploads.forEach(u => {
        const item = document.createElement('div');
        item.className = 'recent-item';
        item.innerHTML = `
          <img src="${u.image_url}" alt="Upload" loading="lazy">
          <span class="recent-time">${timeAgo(u.uploaded_at)}</span>
        `;
        recentGrid.appendChild(item);
      });
    } catch (err) {
      recentLoading.classList.add('hidden');
      recentError.textContent = 'Failed to load recent uploads.';
      recentError.classList.remove('hidden');
    }
  }
});
