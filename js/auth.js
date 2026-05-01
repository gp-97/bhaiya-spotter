const authSection = document.getElementById('authSection');
const welcomeSection = document.getElementById('welcomeSection');
const navUser = document.getElementById('navUser');
const welcomeName = document.getElementById('welcomeName');
const authError = document.getElementById('authError');

async function signUp(email, password, displayName) {
  authError.classList.add('hidden');
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  if (data.user) {
    await supabase.from('profiles').insert({ id: data.user.id, display_name: displayName });
  }
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
  if (user) {
    authSection.classList.add('hidden');
    if (welcomeSection) welcomeSection.classList.remove('hidden');
    if (navUser) navUser.textContent = user.email;
    fetchProfileName(user.id);
  } else {
    authSection.classList.remove('hidden');
    if (welcomeSection) welcomeSection.classList.add('hidden');
    if (navUser) navUser.textContent = '';
  }
}

async function fetchProfileName(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', userId)
    .single();
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

supabase.auth.onAuthStateChange((event, session) => {
  updateUI(session?.user ?? null);
});

if (typeof window !== 'undefined') {
  window.supabaseAuth = { signUp, signIn, signOut, getCurrentUser, showError };
}

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');
  const signupForm = document.getElementById('signupForm');
  const signoutBtn = document.getElementById('signoutBtn');
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

  if (signoutBtn) {
    signoutBtn.addEventListener('click', () => signOut());
  }

  getCurrentUser().then(user => updateUI(user));
});
