const state = {
  token: localStorage.getItem('nh_token') || null,
  user: JSON.parse(localStorage.getItem('nh_user') || 'null'),
  feeds: [],
  sources: [],
  activeFeedId: null,
  articles: [],
  loadingArticles: false,
  showModal: false,
  suggestions: [],
  modalSelectedSources: new Set(),
  modalForm: {
    name: '',
    keywords: '',
    newSourceName: '',
    newSourceEmail: '',
  },
  authMode: 'login',
  authError: '',
  articleError: '',
};

const appEl = document.getElementById('app');

function setState(patch) {
  Object.assign(state, patch);
  render();
}

async function api(path, options = {}) {
  const headers = options.headers || {};
  if (state.token) {
    headers.Authorization = `Bearer ${state.token}`;
  }
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  const response = await fetch(path, {
    ...options,
    headers,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || 'Request failed');
  }
  return response.json();
}

async function initializeDashboard() {
  if (!state.token) return;
  try {
    const [{ feeds }, { sources }] = await Promise.all([
      api('/api/feeds'),
      api('/api/sources'),
    ]);
    const activeFeedId = feeds.length ? feeds[0].id : null;
    setState({ feeds, sources, activeFeedId });
    if (activeFeedId) {
      await loadArticles(activeFeedId);
    }
  } catch (error) {
    console.error(error);
  }
}

async function loadArticles(feedId) {
  if (!feedId) return;
  setState({ loadingArticles: true, articleError: '' });
  try {
    const { articles } = await api(`/api/feeds/${feedId}/articles`);
    setState({ articles, activeFeedId: feedId, loadingArticles: false });
  } catch (error) {
    setState({ articleError: error.message, loadingArticles: false });
  }
}

async function handleAuthSubmit(event) {
  event.preventDefault();
  const formData = new FormData(event.target);
  const payload = Object.fromEntries(formData.entries());
  const endpoint = state.authMode === 'login' ? '/api/login' : '/api/register';
  try {
    const data = await api(endpoint, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    localStorage.setItem('nh_token', data.token);
    localStorage.setItem('nh_user', JSON.stringify(data.user));
    Object.assign(state, {
      token: data.token,
      user: data.user,
      authError: '',
    });
    await initializeDashboard();
  } catch (error) {
    setState({ authError: error.message });
  }
}

function logout() {
  localStorage.removeItem('nh_token');
  localStorage.removeItem('nh_user');
  Object.assign(state, {
    token: null,
    user: null,
    feeds: [],
    sources: [],
    activeFeedId: null,
    articles: [],
    showModal: false,
  });
  render();
}

function toggleModal(show) {
  if (!show) {
    setState({
      showModal: false,
      modalForm: { name: '', keywords: '', newSourceName: '', newSourceEmail: '' },
      modalSelectedSources: new Set(),
      suggestions: [],
    });
    return;
  }
  const selected = new Set(state.sources.map((source) => source.id));
  setState({
    showModal: true,
    modalSelectedSources: selected,
    modalForm: { name: '', keywords: '', newSourceName: '', newSourceEmail: '' },
  });
}

async function handleCreateFeed(event) {
  event.preventDefault();
  const selectedSourceIds = Array.from(state.modalSelectedSources);
  if (!selectedSourceIds.length) {
    alert('Select at least one source.');
    return;
  }
  const formData = new FormData(event.target);
  const payload = {
    name: formData.get('name'),
    keywords: formData.get('keywords'),
    sourceIds: selectedSourceIds,
  };
  try {
    const { feed } = await api('/api/feeds', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    const feeds = [...state.feeds, feed];
    setState({ feeds, showModal: false });
    await loadArticles(feed.id);
  } catch (error) {
    alert(error.message);
  }
}

async function handleAddSource(event) {
  event.preventDefault();
  const formData = new FormData(event.target);
  const body = {
    name: formData.get('newSourceName'),
    emailAddress: formData.get('newSourceEmail'),
  };
  if (!body.name || !body.emailAddress) {
    alert('Enter source name and email.');
    return;
  }
  try {
    const { source } = await api('/api/sources', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    const sources = [...state.sources, source];
    const modalSelectedSources = new Set(state.modalSelectedSources);
    modalSelectedSources.add(source.id);
    setState({
      sources,
      modalSelectedSources,
      modalForm: { ...state.modalForm, newSourceName: '', newSourceEmail: '' },
    });
  } catch (error) {
    alert(error.message);
  }
}

async function handleScanEmail(buttonEl) {
  buttonEl.disabled = true;
  buttonEl.innerText = 'Scanning...';
  try {
    const { suggestions } = await api('/api/scan-email', { method: 'POST' });
    setState({ suggestions });
  } catch (error) {
    alert(error.message);
  } finally {
    buttonEl.disabled = false;
    buttonEl.innerText = 'Scan Email for Newsletters';
  }
}

async function selectSuggestion(suggestion) {
  let existing = state.sources.find((s) => s.emailAddress === suggestion.emailAddress);
  if (!existing) {
    try {
      const { source } = await api('/api/sources', {
        method: 'POST',
        body: JSON.stringify(suggestion),
      });
      existing = source;
      state.sources.push(source);
    } catch (error) {
      alert(error.message);
      return;
    }
  }
  const modalSelectedSources = new Set(state.modalSelectedSources);
  modalSelectedSources.add(existing.id);
  setState({ sources: state.sources, modalSelectedSources });
}

function renderAuthView() {
  return `
    <div class="flex items-center justify-center min-h-screen px-4">
      <div class="bg-card rounded-2xl shadow-xl p-10 w-full max-w-md">
        <div class="text-center mb-8">
          <h1 class="text-3xl font-semibold mb-2">Newsletter Hub AI</h1>
          <p class="text-slate-300">${state.authMode === 'login' ? 'Sign in to continue' : 'Create your account'}</p>
        </div>
        <form class="space-y-4" id="auth-form">
          ${state.authMode === 'register'
            ? `<div>
                <label class="block mb-1 text-sm text-slate-300">Name</label>
                <input type="text" name="name" required class="w-full rounded-lg px-4 py-2 text-slate-900" />
              </div>`
            : ''}
          <div>
            <label class="block mb-1 text-sm text-slate-300">Email</label>
            <input type="email" name="email" required class="w-full rounded-lg px-4 py-2 text-slate-900" />
          </div>
          <div>
            <label class="block mb-1 text-sm text-slate-300">Password</label>
            <input type="password" name="password" minlength="6" required class="w-full rounded-lg px-4 py-2 text-slate-900" />
          </div>
          ${state.authError ? `<p class="text-red-400 text-sm">${state.authError}</p>` : ''}
          <button class="w-full bg-brand hover:bg-brand/80 transition rounded-lg py-2 font-medium">
            ${state.authMode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>
        <p class="text-center text-sm text-slate-400 mt-6">
          ${state.authMode === 'login'
            ? `Need an account? <button class="text-brand-light underline" id="toggle-auth">Register</button>`
            : `Already have an account? <button class="text-brand-light underline" id="toggle-auth">Login</button>`}
        </p>
      </div>
    </div>
  `;
}

function renderFeedList() {
  if (!state.feeds.length) {
    return '<p class="text-slate-400 text-sm">No feeds yet.</p>';
  }
  return state.feeds
    .map(
      (feed) => `
      <button data-feed-id="${feed.id}" class="w-full text-left px-4 py-2 rounded-lg hover:bg-white/10 ${
        state.activeFeedId === feed.id ? 'bg-white/20' : ''
      }">
        <p class="font-semibold">${feed.name}</p>
        <p class="text-xs text-slate-300 line-clamp-1">${feed.keywords}</p>
      </button>`
    )
    .join('');
}

function renderArticles() {
  if (!state.activeFeedId) {
    return `<div class="text-center py-20 text-slate-300">
        <h2 class="text-2xl font-semibold mb-2">Welcome to Newsletter Hub AI</h2>
        <p>Create a feed to start receiving AI summaries.</p>
      </div>`;
  }
  if (state.loadingArticles) {
    return `
      <div class="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        ${Array.from({ length: 6 })
          .map(
            () => `
              <div class="bg-card rounded-xl p-6 animate-pulse">
                <div class="h-4 bg-white/10 rounded w-2/3 mb-4"></div>
                <div class="h-6 bg-white/10 rounded w-full mb-3"></div>
                <div class="h-6 bg-white/10 rounded w-5/6 mb-3"></div>
                <div class="h-4 bg-white/10 rounded w-1/2"></div>
              </div>`
          )
          .join('')}
      </div>
    `;
  }
  if (state.articleError) {
    return `<p class="text-red-400">${state.articleError}</p>`;
  }
  if (!state.articles.length) {
    return '<p class="text-slate-400">No Articles Found.</p>';
  }
  return `
    <div class="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
      ${state.articles
        .map(
          (article) => `
            <article class="bg-card rounded-2xl p-6 flex flex-col gap-4">
              <div class="flex items-center gap-2 text-sm text-brand-light">
                <span class="inline-flex items-center justify-center w-8 h-8 rounded-full bg-brand/30">${
                  article.source[0]
                }</span>
                <span>${article.source}</span>
              </div>
              <div>
                <h3 class="text-xl font-semibold mb-2">${article.title}</h3>
                <p class="text-slate-300">${article.summary}</p>
              </div>
              <a href="${article.link}" target="_blank" rel="noopener" class="mt-auto text-brand-light font-medium inline-flex items-center gap-2">
                Read Original Story
                <span aria-hidden="true">→</span>
              </a>
            </article>`
        )
        .join('')}
    </div>
  `;
}

function renderModal() {
  if (!state.showModal) return '';
  return `
    <div class="fixed inset-0 bg-black/60 flex items-center justify-center px-4 modal-enter">
      <div class="bg-card rounded-3xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto p-8 space-y-8">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-2xl font-semibold">Create Feed</h2>
            <p class="text-slate-400 text-sm">Curate sources and guide the AI with topics.</p>
          </div>
          <button class="text-slate-400 hover:text-white" id="close-modal">✕</button>
        </div>
        <div class="grid gap-6 md:grid-cols-2">
          <form id="feed-form" class="space-y-4">
            <div>
              <label class="block text-sm text-slate-300 mb-1">Feed Name</label>
              <input name="name" required class="w-full rounded-xl px-4 py-3 text-slate-900" placeholder="Tech Radar" />
            </div>
            <div>
              <label class="block text-sm text-slate-300 mb-1">Topics & Keywords</label>
              <textarea name="keywords" required rows="4" class="w-full rounded-xl px-4 py-3 text-slate-900" placeholder="AI, startups, venture capital"></textarea>
            </div>
            <button class="bg-brand hover:bg-brand/80 transition rounded-xl py-3 font-semibold">Create Feed</button>
          </form>
          <div class="space-y-6">
            <div class="flex items-center justify-between">
              <h3 class="font-semibold">Newsletter Sources</h3>
              <button type="button" class="text-brand-light text-sm" id="scan-email">Scan Email for Newsletters</button>
            </div>
            <div class="bg-surface/40 rounded-2xl p-4 space-y-3 max-h-52 overflow-y-auto">
              ${state.sources
                .map(
                  (source) => `
                    <label class="flex items-center gap-3 text-sm">
                      <input type="checkbox" data-source-id="${source.id}" ${
                        state.modalSelectedSources.has(source.id) ? 'checked' : ''
                      } />
                      <div>
                        <p class="font-medium">${source.name}</p>
                        <p class="text-slate-400 text-xs">${source.emailAddress}</p>
                      </div>
                    </label>`
                )
                .join('')}
            </div>
            <div>
              <h4 class="font-semibold mb-2 text-sm">Add Source Manually</h4>
              <form id="source-form" class="space-y-3">
                <input name="newSourceName" placeholder="Name" class="w-full rounded-xl px-4 py-2 text-slate-900" value="${
                  state.modalForm.newSourceName
                }" />
                <input name="newSourceEmail" placeholder="Email" class="w-full rounded-xl px-4 py-2 text-slate-900" value="${
                  state.modalForm.newSourceEmail
                }" />
                <button class="w-full border border-white/20 rounded-xl py-2 text-sm">Add Source</button>
              </form>
            </div>
            ${state.suggestions.length
              ? `<div>
                  <h4 class="font-semibold mb-2 text-sm">Suggestions</h4>
                  <div class="space-y-2">
                    ${state.suggestions
                      .map(
                        (suggestion) => `
                          <div class="flex items-center justify-between bg-surface/50 rounded-xl px-4 py-2 text-sm">
                            <div>
                              <p class="font-medium">${suggestion.name}</p>
                              <p class="text-slate-400 text-xs">${suggestion.emailAddress}</p>
                            </div>
                            <button class="text-brand-light text-xs" data-add-suggestion="${suggestion.emailAddress}">Add</button>
                          </div>`
                      )
                      .join('')}
                  </div>
                </div>`
              : ''}
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderDashboard() {
  return `
    <div class="min-h-screen flex">
      <aside class="w-72 bg-card/40 border-r border-white/10 p-6 flex flex-col gap-6">
        <div>
          <p class="text-sm uppercase tracking-widest text-slate-400">Newsletter Hub AI</p>
          <h2 class="text-2xl font-semibold">Feeds</h2>
        </div>
        <button id="new-feed" class="bg-brand/20 hover:bg-brand/40 rounded-xl py-2 text-brand-light font-semibold">
          + New Feed
        </button>
        <div class="space-y-2 overflow-y-auto flex-1">
          ${renderFeedList()}
        </div>
      </aside>
      <main class="flex-1 p-8">
        <header class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-8">
          <div>
            <p class="text-sm text-slate-400">Dashboard</p>
            <h1 class="text-3xl font-semibold">${state.activeFeedId ? 'Feed Insights' : 'Welcome'}</h1>
          </div>
          <div class="flex items-center gap-4 bg-card rounded-2xl px-4 py-2">
            <img src="${state.user.avatarUrl}" alt="avatar" class="w-12 h-12 rounded-full border border-white/10" />
            <div>
              <p class="font-semibold">${state.user.name}</p>
              <p class="text-sm text-slate-400">${state.user.email}</p>
            </div>
            <button id="logout" class="ml-auto text-sm text-brand-light">Logout</button>
          </div>
        </header>
        ${renderArticles()}
      </main>
      ${renderModal()}
    </div>
  `;
}

function render() {
  if (!state.token) {
    appEl.innerHTML = renderAuthView();
    const form = document.getElementById('auth-form');
    form?.addEventListener('submit', handleAuthSubmit);
    document.getElementById('toggle-auth')?.addEventListener('click', () => {
      setState({ authMode: state.authMode === 'login' ? 'register' : 'login', authError: '' });
    });
    return;
  }
  appEl.innerHTML = renderDashboard();
  document.getElementById('logout')?.addEventListener('click', logout);
  document.getElementById('new-feed')?.addEventListener('click', () => toggleModal(true));
  document.querySelectorAll('[data-feed-id]')?.forEach((button) => {
    button.addEventListener('click', () => loadArticles(button.dataset.feedId));
  });
  if (state.showModal) {
    document.getElementById('close-modal')?.addEventListener('click', () => toggleModal(false));
    document.getElementById('feed-form')?.addEventListener('submit', handleCreateFeed);
    document.getElementById('source-form')?.addEventListener('submit', (event) => {
      state.modalForm.newSourceName = event.target.newSourceName.value;
      state.modalForm.newSourceEmail = event.target.newSourceEmail.value;
      handleAddSource(event);
    });
    document.querySelectorAll('[data-source-id]')?.forEach((checkbox) => {
      checkbox.addEventListener('change', () => {
        const selected = new Set(state.modalSelectedSources);
        if (checkbox.checked) {
          selected.add(checkbox.dataset.sourceId);
        } else {
          selected.delete(checkbox.dataset.sourceId);
        }
        state.modalSelectedSources = selected;
      });
    });
    document.getElementById('scan-email')?.addEventListener('click', (event) => handleScanEmail(event.target));
    document.querySelectorAll('[data-add-suggestion]')?.forEach((button) => {
      button.addEventListener('click', () => {
        const suggestion = state.suggestions.find((s) => s.emailAddress === button.dataset.addSuggestion);
        if (suggestion) {
          selectSuggestion(suggestion);
        }
      });
    });
  }
}

render();
if (state.token) {
  initializeDashboard();
}
