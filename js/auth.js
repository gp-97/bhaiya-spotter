const authSection = document.getElementById('authSection');
const welcomeSection = document.getElementById('welcomeSection');
const welcomeName = document.getElementById('welcomeName');
const authError = document.getElementById('authError');

async function signUp(email, password, displayName) {
  if (authError) authError.classList.add('hidden');
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName } }
  });
  if (error) throw error;
  return data;
}

async function signIn(email, password) {
  if (authError) authError.classList.add('hidden');
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

async function signOut() {
  await supabase.auth.signOut();
}

async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

function updateUI(user) {
  const userMenuBtn = document.getElementById('userMenuBtn');
  const userDropdown = document.getElementById('userDropdown');
  if (user) {
    if (authSection) authSection.classList.add('hidden');
    if (welcomeSection) welcomeSection.classList.remove('hidden');
    if (userMenuBtn) userMenuBtn.classList.remove('hidden');
    fetchProfileName(user.id);
  } else {
    if (authSection) authSection.classList.remove('hidden');
    if (welcomeSection) welcomeSection.classList.add('hidden');
    if (userMenuBtn) userMenuBtn.classList.add('hidden');
    if (userDropdown) userDropdown.classList.add('hidden');
  }
}

function avatarInitials(name) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function avatarColor(name) {
  const colors = ['#2563eb', '#7c3aed', '#db2777', '#ea580c', '#16a34a', '#0891b2', '#ca8a04', '#4f46e5', '#059669', '#6366f1'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

async function fetchProfileName(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', userId)
    .single();

  if (error && error.code === 'PGRST116') {
    const user = await getCurrentUser();
    const defaultName = user.email ? user.email.split('@')[0] : 'Spotter';
    await supabase.from('profiles').insert({ id: userId, display_name: defaultName });
    if (welcomeName) welcomeName.textContent = defaultName;
    updateUserMenu(defaultName);
    return;
  }

  if (!error && data) {
    if (welcomeName) welcomeName.textContent = data.display_name;
    updateUserMenu(data.display_name);
  }
}

function updateUserMenu(name) {
  const avatarEl = document.getElementById('userMenuAvatar');
  const nameEl = document.getElementById('userMenuName');
  if (avatarEl) {
    avatarEl.textContent = avatarInitials(name);
    avatarEl.style.background = avatarColor(name);
  }
  if (nameEl) nameEl.textContent = name;
}

function showError(message) {
  if (authError) {
    authError.textContent = message;
    authError.classList.remove('hidden');
  }
}

async function ensureProfile(user) {
  if (!user) return;
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .single();

  if (error && error.code === 'PGRST116') {
    const defaultName = user.email ? user.email.split('@')[0] : 'Spotter';
    await supabase.from('profiles').insert({ id: user.id, display_name: defaultName });
  }
}

if (typeof window !== 'undefined') {
  window.supabaseAuth = { signUp, signIn, signOut, getCurrentUser, showError };
}

document.addEventListener('DOMContentLoaded', () => {
  if (typeof supabase === 'undefined' || !supabase) {
    showError('Unable to connect to Supabase. Please refresh the page.');
    return;
  }

  const loginForm = document.getElementById('loginForm');
  const signupForm = document.getElementById('signupForm');
  const navSignoutBtn = document.getElementById('navSignoutBtn');
  const authTabs = document.querySelectorAll('.auth-tab');

  if (authTabs.length) {
    authTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        authTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const target = tab.dataset.tab;
        if (target === 'login') {
          loginForm.classList.remove('hidden');
          signupForm.classList.add('hidden');
        } else {
          signupForm.classList.remove('hidden');
          loginForm.classList.add('hidden');
        }
        authError.classList.add('hidden');
      });
    });
  }

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('loginEmail').value;
      const password = document.getElementById('loginPassword').value;
      try {
        await signIn(email, password);
      } catch (err) {
        showError(err.message);
      }
    });
  }

  if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('signupName').value;
      const email = document.getElementById('signupEmail').value;
      const password = document.getElementById('signupPassword').value;
      try {
        await signUp(email, password, name);
        showError('Check your email for a confirmation link!');
      } catch (err) {
        showError(err.message);
      }
    });
  }

  if (navSignoutBtn) {
    navSignoutBtn.addEventListener('click', () => signOut());
  }

  const userMenuBtn = document.getElementById('userMenuBtn');
  const userDropdown = document.getElementById('userDropdown');
  if (userMenuBtn && userDropdown) {
    userMenuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      userDropdown.classList.toggle('hidden');
    });
    document.addEventListener('click', () => {
      userDropdown.classList.add('hidden');
    });
  }

  try {
    supabase.auth.onAuthStateChange((event, session) => {
      updateUI(session?.user ?? null);
    });
  } catch (e) {
    console.warn('Auth state listener not set up:', e.message);
  }

  getCurrentUser().then(user => updateUI(user)).catch(() => {
    updateUI(null);
  });
});
