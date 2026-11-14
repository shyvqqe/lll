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

const authCopy = {
  register: {
    title: 'Создать аккаунт',
    intro: 'Придумай никнейм и пароль для входа в клуб.',
    switchPrompt: 'Уже есть аккаунт?',
    switchLabel: 'Войти',
    success: 'Аккаунт создан. Добро пожаловать!',
  },
  login: {
    title: 'Войти в клуб',
    intro: 'Введи свой никнейм и пароль.',
    switchPrompt: 'Впервые здесь?',
    switchLabel: 'Создать аккаунт',
    success: 'Ты вошёл в аккаунт.',
  },
};

let mode = 'login';
let user = null;
let pending = false;
let toastTimer;

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
  passwordToggle.setAttribute('aria-label', visible ? 'Скрыть пароль' : 'Показать пароль');
}

function setError(container, message = '') {
  const target = container.querySelector('.form-error');
  target.hidden = !message;
  target.textContent = message;
}

function openDialog(nextMode) {
  mode = nextMode;
  const isProfile = mode === 'profile';
  const isRegister = mode === 'register';
  const copy = authCopy[mode];
  document.querySelector('#dialog-title').textContent = copy?.title ?? 'Мой профиль';
  document.querySelector('#dialog-text').textContent = copy?.intro ?? 'Ты вошёл в аккаунт suzy.';
  form.hidden = isProfile;
  profile.hidden = !isProfile;
  submit.querySelector('span').textContent = isRegister ? 'Создать аккаунт' : 'Войти';
  document.querySelector('#switch-prompt').textContent = copy?.switchPrompt ?? '';
  switchButton.textContent = copy?.switchLabel ?? '';
  document.querySelector('#nickname-hint').hidden = !isRegister;
  document.querySelector('#password-hint').hidden = !isRegister;
  password.autocomplete = isRegister ? 'new-password' : 'current-password';
  nickname.placeholder = isRegister ? 'Например, ТихаяУтка' : '';
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
    throw new Error('Не удалось подключиться. Проверь интернет и попробуй ещё раз.');
  }
  const result = await response.json().catch(() => null);
  if (!response.ok || !result) {
    throw new Error(result?.error ?? 'Что-то пошло не так. Попробуй ещё раз.');
  }
  return result;
}

function notify(message) {
  clearTimeout(toastTimer);
  toast.hidden = false;
  toast.querySelector('span').textContent = message;
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
  if (!name) return markInvalid(nickname, 'Введи никнейм.');
  if (mode === 'register' && (name.length < 4 || name.length > 25)) {
    return markInvalid(nickname, 'Никнейм должен содержать от 4 до 25 символов.');
  }
  if (!secret) return markInvalid(password, 'Введи пароль.');
  if (mode === 'register' && [...secret].length < 8) {
    return markInvalid(password, 'В пароле должно быть не меньше 8 символов.');
  }

  setPending(true);
  try {
    const result = await api(mode, { nickname: name, password: secret });
    updateUser(result.user);
    finishDialog();
    notify(authCopy[mode].success);
  } catch (error) {
    setError(form, error.message);
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
    notify('Ты вышел из аккаунта.');
  } catch (error) {
    setError(profile, error.message);
  } finally {
    setPending(false);
  }
});

const initialSession = new AbortController();
form.addEventListener('submit', () => initialSession.abort(), { once: true });
fetch('/api/session', { signal: initialSession.signal })
  .then((response) => response.ok ? response.json() : null)
  .then((result) => { if (result && !initialSession.signal.aborted) updateUser(result.user); })
  .catch(() => {});
