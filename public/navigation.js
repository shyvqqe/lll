import { translate } from './i18n.js?v=7';

const channelName = document.querySelector('.channel-name span');
const links = [...document.querySelectorAll('.header-nav a')];

function updateChannel() {
  const current = links.find((link) => link.hash === location.hash) ?? links[0];
  for (const link of links) {
    if (link === current) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  }
  channelName.dataset.i18n = current.querySelector('[data-i18n]').dataset.i18n;
  channelName.textContent = translate(channelName.dataset.i18n);
}

updateChannel();
window.addEventListener('hashchange', updateChannel);
