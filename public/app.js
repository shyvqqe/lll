import { translate, translateApiError } from './i18n.js?v=7';

const dialog = document.querySelector('#account-dialog');
const form = document.querySelector('#account-form');
const profile = document.querySelector('#profile-panel');
const nickname = document.querySelector('#nickname');
const password = document.querySelector('#password');
const submit = document.querySelector('#submit-account');
const switchButton = form.querySelector('[data-switch]');
const passwordToggle = form.querySelector('[data-password]');
const logout = profile.querySelector('[data-logout]');
const toast = document.querySelector('.toast');

const errors = new Map();

let mode = 'login';
let user = null;
let pending = false;
let toastTimer;
let toastKey;

function updateUser(nextUser) {
  user = nextUser;
  document.querySelectorAll('[data-member]').forEach((element) => { element.hidden = !user; });
  document.querySelectorAll('[data-guest]').forEach((element) => { element.hidden = Boolean(user); });
  document.querySelectorAll('[data-nickname]').forEach((element) => { element.textContent = user?.nickname ?? ''; });
  document.dispatchEvent(new CustomEvent('suzy:session', { detail: user }));
}

function setPasswordVisible(visible) {
  password.type = visible ? 'text' : 'password';
  passwordToggle.setAttribute('aria-pressed', String(visible));
  renderPasswordToggle();
}

function renderPasswordToggle() {
  const key = password.type === 'text' ? 'auth.hidePassword' : 'auth.showPassword';
  passwordToggle.setAttribute('aria-label', translate(key));
}

function renderError(container) {
  const target = container.querySelector('.form-error');
  const failure = errors.get(container);
  const message = typeof failure === 'string' ? translate(failure)
    : failure ? translateApiError(failure.message) : '';
  target.hidden = !message;
  target.textContent = message;
}

function setError(container, failure) {
  errors.set(container, failure);
  renderError(container);
}

function renderDialogCopy() {
  const isProfile = mode === 'profile';
  const isRegister = mode === 'register';
  document.querySelector('#dialog-title').textContent = translate(`action.${mode}.title`);
  document.querySelector('#dialog-text').textContent = translate(`action.${mode}.intro`);
  submit.querySelector('span').textContent = translate(isRegister ? 'action.register.title' : 'action.login.button');
  document.querySelector('#switch-prompt').textContent = isProfile ? '' : translate(`action.${mode}.prompt`);
  switchButton.textContent = isProfile ? '' : translate(isRegister ? 'action.login.button' : 'action.register.title');
  nickname.placeholder = isRegister ? translate('action.register.placeholder') : '';
  renderPasswordToggle();
}

function openDialog(nextMode) {
  mode = nextMode;
  const isProfile = mode === 'profile';
  const isRegister = mode === 'register';
  renderDialogCopy();
  form.hidden = isProfile;
  profile.hidden = !isProfile;
  document.querySelector('#nickname-hint').hidden = !isRegister;
  document.querySelector('#password-hint').hidden = !isRegister;
  password.autocomplete = isRegister ? 'new-password' : 'current-password';
  nickname.removeAttribute('aria-invalid');
  password.removeAttribute('aria-invalid');
  password.value = '';
  setPasswordVisible(false);
  setError(form);
  setError(profile);
  if (!dialog.open) {
    nickname.value = '';
    dialog.showModal();
  }
  (isProfile ? dialog.querySelector('[data-close]') : nickname).focus();
}

async function api(path, payload) {
  let response;
  try {
    response = await fetch(`/api/${path}`, payload === undefined ? undefined : {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error('', { cause: 'action.error.network' });
  }
  const result = await response.json().catch(() => null);
  if (!response.ok || !result) {
    throw new Error(typeof result?.error === 'string' ? result.error : '');
  }
  return result;
}

function notify(key) {
  clearTimeout(toastTimer);
  toastKey = key;
  toast.hidden = false;
  toast.querySelector('span').textContent = translate(key);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 5000);
}

function markInvalid(input, message) {
  input.setAttribute('aria-invalid', 'true');
  setError(form, message);
  input.focus();
}

function setPending(nextPending) {
  pending = nextPending;
  for (const button of [submit, switchButton, logout, dialog.querySelector('[data-close]')]) {
    button.disabled = pending;
  }
}

function finishDialog() {
  dialog.close();
  const activeAction = user ? '[data-member] [data-open="profile"]' : '[data-guest] [data-open="login"]';
  document.querySelector(activeAction)?.focus({ preventScroll: true });
}

document.querySelectorAll('[data-open]').forEach((button) => {
  button.addEventListener('click', () => openDialog(button.dataset.open));
});
dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());
dialog.addEventListener('cancel', (event) => { if (pending) event.preventDefault(); });
dialog.addEventListener('click', (event) => {
  if (event.target !== dialog || pending) return;
  const bounds = dialog.getBoundingClientRect();
  if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) {
    dialog.close();
  }
});
dialog.addEventListener('close', () => { password.value = ''; });
passwordToggle.addEventListener('click', () => setPasswordVisible(password.type === 'password'));
switchButton.addEventListener('click', () => openDialog(mode === 'register' ? 'login' : 'register'));

for (const input of [nickname, password]) {
  input.addEventListener('input', () => {
    input.removeAttribute('aria-invalid');
    setError(form);
  });
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (pending) return;
  const name = nickname.value.trim().normalize('NFC');
  const secret = password.value;
  setError(form);
  if (!name) return markInvalid(nickname, 'action.auth.nicknameRequired');
  if (mode === 'register' && (name.length < 4 || name.length > 25)) {
    return markInvalid(nickname, 'action.auth.nicknameLength');
  }
  if (!secret) return markInvalid(password, 'action.auth.passwordRequired');
  if (mode === 'register' && [...secret].length < 8) {
    return markInvalid(password, 'action.auth.passwordMin');
  }

  setPending(true);
  try {
    const result = await api(mode, { nickname: name, password: secret });
    updateUser(result.user);
    finishDialog();
    notify(`action.${mode}.success`);
  } catch (error) {
    setError(form, error.cause ?? error);
  } finally {
    setPending(false);
  }
});

logout.addEventListener('click', async () => {
  if (pending) return;
  setPending(true);
  setError(profile);
  try {
    await api('logout', {});
    updateUser(null);
    finishDialog();
    notify('action.logout.success');
  } catch (error) {
    setError(profile, error.cause ?? error);
  } finally {
    setPending(false);
  }
});

document.addEventListener('suzy:language', () => {
  renderDialogCopy();
  renderError(form);
  renderError(profile);
  if (!toast.hidden && toastKey) toast.querySelector('span').textContent = translate(toastKey);
});

const initialSession = new AbortController();
form.addEventListener('submit', () => initialSession.abort(), { once: true });
fetch('/api/session', { signal: initialSession.signal })
  .then((response) => response.ok ? response.json() : null)
  .then((result) => { if (result && !initialSession.signal.aborted) updateUser(result.user); })
  .catch(() => {});
