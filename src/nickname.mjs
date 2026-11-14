const allowedCharacters = /^[a-zA-Zа-яёА-ЯЁ0-9_]{4,25}$/u;
const englishLetter = /[a-zA-Z]/u;
const russianLetter = /[а-яёА-ЯЁ]/u;
const reservedRole = /^(?:admin(?:istrator|istration)?|staff|moderator|support|official|root|system|админ(?:истратор|истрация)?|модератор|поддержка|администрация|система)$/u;
const siteName = /^(?:duckclub|utkinclub|даклаб|утиныйклуб|уткинклуб)$/u;
const sitePrefix = /^(?:duckclub|utkinclub|даклаб|утиныйклуб|уткинклуб)/u;
const obfuscatedLetters = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't' };

const explicitMarkers = [
  /nigg(?:er|a)|faggot|trann(?:y|ie)|wetback|heilhitler|whitesupremac|neonazi/u,
  /fuck|cocksuck|dickhead|shithead|asshole|bitch|whore/u,
  /kill(?:you|yourself|all)|iwills(?:hoot|tab)|slaughterall|suicidechallenge|selfharmchallenge/u,
  /porn|blowjob|handjob|masturbat|dildo|orgasm|sexcam|deepthroat|childgroom|pedo(?:phile|philia)/u,
  /cocaine|heroin(?!e)|methamphetamine|fentanyl|buy(?:meth|drugs)|sell(?:meth|drugs)/u,
  /пидор|пидар|пидераст|убитьвсех|убьютебя|тебяубью|всехубью|сдохни|дохнисука/u,
  /хуй|ху[её]сос|ху[её]в|пизд|бля(?:д|ть)|долбо[её]б|вы[её]б|за[её]б|на[её]б|[её]бан|[её]бать/u,
  /порнограф|минет|мастурбац|дилдо|оргазм|сексчат|педофил|детск(?:ое|ий)порн/u,
  /кокаин|героин(?![яьи])|метамфетамин|фентанил|продамнарк|куплюнарк|убейсебя|суицидчеллендж/u,
];

const explicitWord = /^(?:anal|penis|vagina|cunt|cock|shit|sex|rape|meth|nazi|isis|kike|moron|idiot|секс|порно|пенис|вагина|мудак|сука|жопа|чмо|мразь|дебил|гандон|гондон|нацист|террорист|игил)(?:[0-9]+)?$/u;
const formatError = 'Введите от 4 до 25 символов. Можно использовать буквы одного алфавита, цифры и нижнее подчёркивание.';
const contentError = 'Этот никнейм нарушает правила клуба. Выберите другой.';

function moderationTokens(nickname) {
  return nickname
    .replace(/([a-zа-яё])([A-ZА-ЯЁ])/gu, '$1_$2')
    .toLowerCase()
    .split(/_+/u)
    .filter(Boolean);
}

export function normalizeNickname(value) {
  if (typeof value !== 'string') return { error: formatError };

  const nickname = value.trim().normalize('NFC');
  const hasEnglish = englishLetter.test(nickname);
  const hasRussian = russianLetter.test(nickname);
  if (!allowedCharacters.test(nickname) || hasEnglish === hasRussian) {
    return { error: formatError };
  }

  return { nickname, key: nickname.toLowerCase() };
}

export function validateNickname(value) {
  const normalized = normalizeNickname(value);
  if (normalized.error) return normalized;

  const { nickname, key } = normalized;
  const tokens = moderationTokens(nickname);
  const compact = key.replace(/_/gu, '');
  const decoded = compact.replace(/[013457]/gu, (digit) => obfuscatedLetters[digit]);
  const roleTokens = tokens.map((token) => token.replace(/\d+$/u, ''));
  const impersonatesStaff = roleTokens.some((token) => reservedRole.test(token))
    || siteName.test(compact.replace(/\d+$/u, ''))
    || reservedRole.test(compact.replace(sitePrefix, '').replace(/\d+$/u, ''))
    || reservedRole.test(decoded);
  if (impersonatesStaff) {
    return { error: 'Этот никнейм зарезервирован. Выберите другое имя.' };
  }

  if (/(?:\d_*){10,}/u.test(key)
    || explicitWord.test(compact)
    || tokens.some((token) => explicitWord.test(token))
    || explicitMarkers.some((marker) => marker.test(compact) || marker.test(decoded))) {
    return { error: contentError };
  }

  return normalized;
}
