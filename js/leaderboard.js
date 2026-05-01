async function fetchLeaderboard() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: submissions, error } = await supabase
    .from('submissions')
    .select(`
      user_id,
      uploaded_at,
      profiles!inner(display_name)
    `)
    .gte('uploaded_at', thirtyDaysAgo.toISOString())
    .order('uploaded_at', { ascending: false });

  if (error) throw error;

  if (!submissions || submissions.length === 0) {
    return [];
  }

  const userStats = {};

  submissions.forEach(s => {
    const uid = s.user_id;
    if (!userStats[uid]) {
      userStats[uid] = {
        user_id: uid,
        display_name: s.profiles.display_name,
        photo_count: 0,
        days: new Set(),
      };
    }
    userStats[uid].photo_count++;
    const dateStr = new Date(s.uploaded_at).toDateString();
    userStats[uid].days.add(dateStr);
  });

  const rankings = Object.values(userStats).map(u => ({
    user_id: u.user_id,
    display_name: u.display_name,
    photo_count: u.photo_count,
    active_days: u.days.size,
    score: Math.round((u.photo_count * 0.7 + u.days.size * 0.3 * 10) * 10) / 10,
  }));

  rankings.sort((a, b) => b.score - a.score);

  return rankings;
}

function renderMedal(rank) {
  if (rank === 1) return '&#129351;';
  if (rank === 2) return '&#129352;';
  if (rank === 3) return '&#129353;';
  return rank;
}

async function renderLeaderboard() {
  const table = document.getElementById('leaderboardTable');
  const tbody = document.getElementById('leaderboardBody');
  const loading = document.getElementById('leaderboardLoading');
  const errorEl = document.getElementById('leaderboardError');
  const empty = document.getElementById('leaderboardEmpty');

  loading.classList.remove('hidden');
  table.classList.add('hidden');
  errorEl.classList.add('hidden');
  empty.classList.add('hidden');

  try {
    const rankings = await fetchLeaderboard();
    const user = await getCurrentUser();

    loading.classList.add('hidden');

    if (rankings.length === 0) {
      empty.classList.remove('hidden');
      return;
    }

    tbody.innerHTML = '';

    rankings.forEach((r, i) => {
      const rank = i + 1;
      const isCurrentUser = user && r.user_id === user.id;
      const tr = document.createElement('tr');

      if (rank <= 3) {
        tr.classList.add(`rank-${rank}`);
      }

      if (isCurrentUser) {
        tr.classList.add('current-user-row');
      }

      tr.innerHTML = `
        <td class="rank-cell">
          ${rank <= 3 ? `<span class="rank-medal">${renderMedal(rank)}</span>` : rank}
        </td>
        <td>${escapeHtml(r.display_name)}${isCurrentUser ? ' (you)' : ''}</td>
        <td>${r.photo_count}</td>
        <td>${r.active_days}</td>
        <td class="score-cell">${r.score}</td>
      `;

      tbody.appendChild(tr);
    });

    table.classList.remove('hidden');
  } catch (err) {
    loading.classList.add('hidden');
    errorEl.textContent = 'Failed to load leaderboard. Please refresh the page.';
    errorEl.classList.remove('hidden');
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('leaderboardTable')) {
    renderLeaderboard();
  }
});
