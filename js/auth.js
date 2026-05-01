const authSection = document.getElementById('authSection');
const welcomeSection = document.getElementById('welcomeSection');
const navUser = document.getElementById('navUser');
const welcomeName = document.getElementById('welcomeName');
const authError = document.getElementById('authError');

async function signUp(email, password, displayName) {
  authError.classList.add('hidden');
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName } }
  });
  if (error) throw error;
  return data;
}

async function signIn(email, password) {
  authError.classList.add('hidden');
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
  const navSignoutBtn = document.getElementById('navSignoutBtn');
  if (user) {
    authSection.classList.add('hidden');
    if (welcomeSection) welcomeSection.classList.remove('hidden');
    if (navUser) navUser.textContent = user.email;
    if (navSignoutBtn) navSignoutBtn.classList.remove('hidden');
    fetchProfileName(user.id);
  } else {
    authSection.classList.remove('hidden');
    if (welcomeSection) welcomeSection.classList.add('hidden');
    if (navUser) navUser.textContent = '';
    if (navSignoutBtn) navSignoutBtn.classList.add('hidden');
  }
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
    return;
  }

  if (!error && data && welcomeName) {
    welcomeName.textContent = data.display_name;
  }
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
