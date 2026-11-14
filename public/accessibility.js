const root = document.documentElement;
const dialog = document.querySelector('#accessibility-dialog');
const openButton = document.querySelector('#accessibility-open');
const resetButton = document.querySelector('#accessibility-reset');
const motionCheckbox = document.querySelector('#reduce-motion');
const contrastCheckbox = document.querySelector('#high-contrast');
const textCheckbox = document.querySelector('#larger-text');
const calmCheckbox = document.querySelector('#calm-view');
const systemMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
const systemContrast = window.matchMedia?.('(prefers-contrast: more)');
const systemMotionNotice = document.querySelector('[data-system-motion]');
const systemContrastNotice = document.querySelector('[data-system-contrast]');
const storageKey = 'suzy.accessibility';
const preferenceControls = {
  calmView: calmCheckbox,
  reducedMotion: motionCheckbox,
  highContrast: contrastCheckbox,
  largerText: textCheckbox,
};

function readChoices() {
  let stored;
  try {
    stored = JSON.parse(localStorage.getItem(storageKey));
  } catch { /* Use defaults if stored settings are unavailable. */ }
  return Object.fromEntries(Object.keys(preferenceControls).map((key) => [key, stored?.[key] === true]));
}

let choices = readChoices();

function syncPreferences() {
  const reducedBySystem = systemMotion?.matches === true;
  const contrastBySystem = systemContrast?.matches === true;
  const calmView = choices.calmView === true;
  const reducedMotion = choices.reducedMotion || reducedBySystem || calmView;
  const highContrast = choices.highContrast || contrastBySystem;
  const largerText = choices.largerText;
  const changed = reducedMotion !== isMotionReduced() ||
    highContrast !== (root.dataset.contrast === 'high') ||
    largerText !== (root.dataset.text === 'large') || calmView !== root.hasAttribute('data-calm-view');

  root.toggleAttribute('data-calm-view', calmView);
  root.dataset.motion = reducedMotion ? 'reduced' : 'enabled';
  if (highContrast) root.dataset.contrast = 'high';
  else delete root.dataset.contrast;
  if (largerText) root.dataset.text = 'large';
  else delete root.dataset.text;

  for (const [key, checkbox] of Object.entries(preferenceControls)) checkbox.checked = choices[key] === true;
  if (systemMotionNotice) systemMotionNotice.hidden = !reducedBySystem;
  if (systemContrastNotice) systemContrastNotice.hidden = !contrastBySystem;
  motionCheckbox.setAttribute('aria-describedby', reducedBySystem ? 'motion-hint system-motion-hint' : 'motion-hint');
  contrastCheckbox.setAttribute('aria-describedby', contrastBySystem ? 'contrast-hint system-contrast-hint' : 'contrast-hint');

  if (changed) {
    document.dispatchEvent(new CustomEvent('suzy:accessibility', {
      detail: { reducedMotion, highContrast, largerText, calmView },
    }));
  }
}

export function isMotionReduced() {
  return root.dataset.motion === 'reduced';
}

function saveChoices() {
  choices = Object.fromEntries(Object.entries(preferenceControls).map(([key, checkbox]) => [key, checkbox.checked]));
  try {
    localStorage.setItem(storageKey, JSON.stringify(choices));
  } catch { /* Apply choices in this tab when storage is unavailable. */ }
  syncPreferences();
}

syncPreferences();
for (const checkbox of Object.values(preferenceControls)) {
  checkbox.addEventListener('change', saveChoices);
}

openButton.addEventListener('click', () => {
  if (dialog.open) return;
  dialog.showModal();
  calmCheckbox.focus();
});
for (const button of dialog.querySelectorAll('[data-accessibility-close]')) {
  button.addEventListener('click', () => dialog.close());
}
dialog.addEventListener('close', () => openButton.focus({ preventScroll: true }));

resetButton.addEventListener('click', () => {
  choices = { reducedMotion: false, highContrast: false, largerText: false, calmView: false };
  try {
    localStorage.removeItem(storageKey);
  } catch { /* Reset still applies in this tab. */ }
  syncPreferences();
});

systemMotion?.addEventListener?.('change', syncPreferences);
systemContrast?.addEventListener?.('change', syncPreferences);
window.addEventListener('storage', (event) => {
  if (event.key !== storageKey && event.key !== null) return;
  choices = readChoices();
  syncPreferences();
});
