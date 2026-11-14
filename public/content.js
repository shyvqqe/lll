import { translate, translateApiError } from './i18n.js?v=7';

const postsSection = document.querySelector('#public-posts');
const status = document.querySelector('#site-posts-status');
const editor = document.querySelector('#post-editor');
const form = document.querySelector('#post-editor-form');
form.noValidate = true;
const titleField = document.querySelector('#post-title');
const bodyField = document.querySelector('#post-body');
const editorError = document.querySelector('#post-editor-error');
const submitButton = form.querySelector('button[type="submit"]');
const closeButtons = editor.querySelectorAll('[data-post-close]');
const defaultTitles = { news: 'Новости', notes: 'Заметки' };

const posts = new Map();
for (const article of postsSection.querySelectorAll('[data-site-post]')) {
  posts.set(article.dataset.sitePost, {
    title: article.querySelector('[data-post-title]'),
    body: article.querySelector('[data-post-body]'),
    button: article.querySelector('[data-post-edit]'),
    block: null,
  });
}

let isAdmin = false;
let editingPost = null;
let saving = false;
let statusMessage;
let errorMessage;

function updateActions() {
  for (const { button, block } of posts.values()) {
    button.hidden = !isAdmin || !block;
  }
}

function renderBlock(block) {
  const post = posts.get(block?.id);
  if (!post || typeof block.title !== 'string' || typeof block.body !== 'string') return false;
  post.block = block;
  renderPostCopy(block.id, post);
  return true;
}

function renderPostCopy(id, post) {
  const block = post.block;
  const defaultTitle = translate(`posts.${id}`);
  post.title.textContent = !block || (block.body === '' && block.title === defaultTitles[id])
    ? defaultTitle : block.title;
  if (block) post.body.textContent = block.body || translate('action.posts.empty');
}

function messageText(message) {
  if (typeof message === 'string') return translate(message);
  return message ? translateApiError(message.message) : '';
}

function renderError() {
  editorError.textContent = messageText(errorMessage);
  editorError.hidden = !errorMessage;
}

function setError(message, field) {
  titleField.removeAttribute('aria-invalid');
  bodyField.removeAttribute('aria-invalid');
  errorMessage = message;
  renderError();
  if (field) {
    field.setAttribute('aria-invalid', 'true');
    field.focus();
  }
}

function setSaving(nextSaving) {
  saving = nextSaving;
  submitButton.disabled = saving;
  titleField.readOnly = saving;
  bodyField.readOnly = saving;
  for (const button of closeButtons) button.disabled = saving;
}

function announce(message) {
  statusMessage = message;
  status.textContent = messageText(statusMessage);
}

async function fetchContent(path = '', options) {
  let response;
  try {
    response = await fetch(`/api/content${path}`, options);
  } catch {
    throw new Error('', { cause: 'action.error.network' });
  }
  const data = await response.json().catch(() => null);
  if (!response.ok || !data) {
    throw new Error(typeof data?.error === 'string' ? data.error : '');
  }
  return data;
}

for (const post of posts.values()) {
  post.button.addEventListener('click', () => {
    if (!isAdmin || !post.block || saving || editor.open) return;
    editingPost = post;
    titleField.value = post.block.title;
    bodyField.value = post.block.body;
    setError();
    announce();
    editor.showModal();
    titleField.focus();
  });
}

for (const button of closeButtons) {
  button.addEventListener('click', () => editor.close());
}
editor.addEventListener('cancel', (event) => {
  if (saving) event.preventDefault();
});
editor.addEventListener('close', () => {
  if (editingPost && !editingPost.button.hidden) {
    editingPost.button.focus({ preventScroll: true });
  }
  editingPost = null;
});

for (const field of [titleField, bodyField]) {
  field.addEventListener('input', () => setError());
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!isAdmin || !editingPost || saving) return;
  const blockId = editingPost.block.id;
  const title = titleField.value.trim();
  const body = bodyField.value.trim();
  const titleLength = [...title].length;
  if (titleLength < 2 || titleLength > 70) {
    setError('action.api.postTitleLength', titleField);
    return;
  }
  if (!body || [...body].length > 2500) {
    setError('action.api.postBodyLength', bodyField);
    return;
  }

  setError();
  setSaving(true);
  try {
    const { block } = await fetchContent(`/${encodeURIComponent(blockId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, body }),
    });
    if (block?.id !== blockId || !renderBlock(block)) {
      throw new Error('', { cause: 'action.posts.unknownUpdate' });
    }
    if (editor.open) editor.close();
    announce('action.posts.saved');
  } catch (error) {
    if (editor.open) setError(error.cause ?? error);
    else announce(error.cause ?? error);
  } finally {
    setSaving(false);
  }
});

document.addEventListener('suzy:session', (event) => {
  isAdmin = event.detail?.isAdmin === true;
  updateActions();
  if (!isAdmin && editor.open) editor.close();
});

function renderLocalizedCopy() {
  for (const [id, post] of posts) renderPostCopy(id, post);
  status.textContent = messageText(statusMessage);
  renderError();
}

document.addEventListener('suzy:language', renderLocalizedCopy);
renderLocalizedCopy();
announce('action.posts.loading');
fetchContent().then(({ blocks }) => {
  if (!Array.isArray(blocks)) throw new Error();
  for (const block of blocks) renderBlock(block);
  updateActions();
  if ([...posts.values()].some(({ block }) => !block)) throw new Error();
  announce();
}).catch(() => {
  announce('action.posts.loadFailed');
});
