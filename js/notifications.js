let notificationChannel = null;
let toastTimer = null;

function showToast(message, icon, link) {
  const existing = document.getElementById('toast');
  if (existing) existing.remove();
  if (toastTimer) clearTimeout(toastTimer);

  const toast = document.createElement('div');
  toast.id = 'toast';
  toast.className = 'toast';
  toast.innerHTML = `
    <span class="toast-icon">${icon}</span>
    <span class="toast-text">${message}</span>
    ${link ? `<a href="${link}" class="toast-link">View</a>` : ''}
    <button class="toast-close" onclick="this.parentElement.remove()">&times;</button>
  `;
  document.body.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('show'));

  toastTimer = setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 5000);
}

function initRealtimeNotifications(userId) {
  if (!window.supabase) return;

  try {
    if (notificationChannel) {
      supabase.removeChannel(notificationChannel);
    }

    notificationChannel = supabase
      .channel('notifications')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'submissions' },
        (payload) => {
          if (payload.new.user_id !== userId) {
            showToast(
              `${payload.new.profiles?.display_name || 'Someone'} uploaded a new photo`,
              '&#128247;',
              'gallery.html'
            );
          }
        }
      )
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'comments' },
        (payload) => {
          if (payload.new.user_id !== userId) {
            showToast(
              `${payload.new.profiles?.display_name || 'Someone'} commented on a photo`,
              '&#128172;',
              'gallery.html'
            );
          }
        }
      )
      .subscribe();
  } catch (e) {
    console.warn('Realtime notifications unavailable:', e.message);
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  if (typeof getCurrentUser !== 'function') return;
  const user = await getCurrentUser();
  if (user) initRealtimeNotifications(user.id);
});
