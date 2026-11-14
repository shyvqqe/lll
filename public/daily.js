const signs = [
  ['Овен', '♈', 'fire'], ['Телец', '♉', 'earth'], ['Близнецы', '♊', 'air'],
  ['Рак', '♋', 'water'], ['Лев', '♌', 'fire'], ['Дева', '♍', 'earth'],
  ['Весы', '♎', 'air'], ['Скорпион', '♏', 'water'], ['Стрелец', '♐', 'fire'],
  ['Козерог', '♑', 'earth'], ['Водолей', '♒', 'air'], ['Рыбы', '♓', 'water'],
];

const readings = {
  fire: [
    ['Энергия сегодня лучше всего работает в начале дела. Разреши себе сделать первый черновик.', 'Поставь таймер на 10 минут и начни то, что откладываешь.'],
    ['Смена маршрута может вернуть интерес к привычному.', 'Пройди часть знакомого пути другой улицей и найди одну новую деталь.'],
    ['Порыв легко перепутать со срочностью. Дай сильной идее немного остыть.', 'Запиши одну идею утром и выбери для неё первый шаг вечером.'],
    ['День подходит для честного разговора. Прямота звучит лучше, когда есть место для ответа.', 'Задай один вопрос, который давно хотел задать, и выслушай ответ до конца.'],
    ['Лучше всего получится то, чему ты можешь уделить всё внимание.', 'На пятнадцать минут отложи телефон и займись одним делом.'],
    ['В расписании пригодится место для спонтанности.', 'Выдели двадцать минут на занятие, которое выбираешь прямо сейчас.'],
    ['Хорошая компания усилит азарт, даже если вы заняты разным.', 'Предложи другу короткую прогулку или совместный перерыв.'],
    ['Сегодня можно вернуть интерес к тому, что когда-то захватывало.', 'Посвяти десять минут старому хобби и запиши, что всё ещё нравится.'],
    ['Переключись с обещаний на маленькое дело, которое можно закончить.', 'Заверши одну задачу, которая занимает меньше пяти минут.'],
  ],
  earth: [
    ['Спокойный темп поможет увидеть, что действительно требует внимания.', 'Разбери одну полку, папку или стопку. Остановись на ней.'],
    ['День располагает к простым привычкам. Опирайся на то, что уже работает.', 'Выбери одну полезную привычку и выдели на неё пять минут.'],
    ['Сегодня полезно отделить важное от накопившегося.', 'Из списка дел выбери одно на сегодня и одно на потом.'],
    ['Тебе может пригодиться пауза среди дел, которые требуют точности.', 'Проведи один перерыв без экрана и посмотри в окно.'],
    ['Знакомое дело пойдёт легче, если заранее убрать одно препятствие.', 'Подготовь сегодня то, что обычно ищешь в последний момент.'],
    ['Довести один замысел до конца приятнее, чем держать в голове сразу несколько.', 'Выбери один незаконченный черновик и допиши его до понятной точки.'],
    ['В повседневной мелочи найдётся повод для удовольствия.', 'Завари любимый напиток и первые три глотка сделай без телефона.'],
    ['Полезный порядок начинается с решения, куда что положить.', 'Найди постоянное место для одной вещи, которая часто теряется.'],
    ['Заметь, сколько шагов ты уже сделал. Это поможет выбрать следующий.', 'Запиши три вещи, которые получились на этой неделе.'],
  ],
  air: [
    ['Сегодня любопытство приведёт к удачной находке, если выбрать один вопрос.', 'Узнай ответ на один давний вопрос и запиши его одним предложением.'],
    ['Разговор может подсказать новый взгляд на знакомую тему.', 'Спроси близкого человека, что интересного он узнал за неделю.'],
    ['У идеи появится форма, когда её можно коротко пересказать.', 'Объясни одну свою идею в трёх предложениях.'],
    ['Тишина между сообщениями даст мыслям время собраться.', 'Закрой мессенджеры на десять минут и запиши всё, что крутится в голове.'],
    ['День подходит для знакомства с чужим взглядом.', 'Прочитай одну короткую заметку на тему, которую редко выбираешь.'],
    ['Пусть выбор сегодня будет достаточно хорошим, чтобы двигаться дальше.', 'Прими одно мелкое решение за две минуты и освободи для него место в расписании.'],
    ['Из старых идей может получиться неожиданная пара.', 'Объедини две строчки из своих заметок в один новый замысел.'],
    ['Иногда самое полезное в беседе — попросить уточнить.', 'В одном разговоре задай дополнительный вопрос вместо догадки.'],
    ['Смена обстановки поможет взглянуть на привычное по-другому.', 'Проведи десять минут за чтением или записью мыслей в новом месте.'],
  ],
  water: [
    ['Дай себе время заметить настроение прежде, чем выбирать темп дня.', 'Запиши три слова о том, как себя чувствуешь сейчас.'],
    ['Сегодня маленький знак внимания может сказать многое.', 'Отправь одному человеку короткое тёплое сообщение.'],
    ['В спокойном ритме можно услышать мысли, которые теряются в суете.', 'Послушай одну песню целиком, не занимаясь параллельно другими делами.'],
    ['Привычное место удивит, если смотреть внимательно.', 'Заметь красивый свет, отражение или звук и сохрани его в одной строчке.'],
    ['Будь внимателен к своим границам. Пауза даёт время выбрать слова.', 'Придумай одну фразу, которой сможешь вежливо попросить время на ответ.'],
    ['День располагает к творчеству, в котором важен сам процесс.', 'Пять минут порисуй или попиши от руки, не исправляя то, что получилось.'],
    ['Приятное воспоминание может подсказать, чего хочется сейчас.', 'Выбери фотографию, которая вызывает улыбку, и вспомни деталь того дня.'],
    ['Тепло возвращается через простые жесты.', 'Сделай одну маленькую вещь, которая добавит уюта тебе или близкому.'],
    ['Вечером пригодится мягкий переход от дел к отдыху.', 'Выбери один способ закрыть день: прогулка, музыка или тёплый чай.'],
  ],
};

const buttons = document.querySelector('#signs');
const dateLabel = document.querySelector('#daily-date');
const mark = document.querySelector('#daily-mark');
const signLabel = document.querySelector('#daily-sign');
const forecast = document.querySelector('#daily-forecast');
const task = document.querySelector('#daily-task');
const doneButton = document.querySelector('#daily-done');
const doneText = doneButton.querySelector('span');
const shortDate = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' });
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

function stored(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}

function store(key, value) {
  try { localStorage.setItem(key, value); } catch { /* Storage can be unavailable. */ }
}

function localDate(date) {
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()].map((part) => String(part).padStart(2, '0')).join('-');
}

const savedSign = Number(stored('suzy.daily.sign'));
let selected = Number.isInteger(savedSign) && signs[savedSign] ? savedSign : 0;
let shownDate;
let completed = new Set();
let copyAnimation;
let markAnimation;

function updateCompletion() {
  const done = completed.has(selected);
  doneButton.setAttribute('aria-pressed', String(done));
  doneText.textContent = done ? 'Выполнено' : 'Отметить выполненным';
}

function showDaily(animate = false) {
  const now = new Date();
  const date = localDate(now);
  if (shownDate !== date) {
    shownDate = date;
    dateLabel.dateTime = date;
    dateLabel.textContent = shortDate.format(now);
    const [savedDate, values] = (stored('suzy.daily.completed') ?? '').split(':');
    completed = new Set(savedDate === date ? values.split(',').filter(Boolean).map(Number) : []);
  }
  const [name, symbol, element] = signs[selected];
  const day = Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86_400_000);
  const choices = readings[element];
  const index = ((day + Math.floor(selected / 4) * 3) % choices.length + choices.length) % choices.length;
  mark.textContent = `${symbol}\uFE0E`;
  signLabel.textContent = name;
  [forecast.textContent, task.textContent] = choices[index];
  Array.from(buttons.children).forEach((button, position) => button.setAttribute('aria-pressed', String(position === selected)));
  updateCompletion();
  doneButton.hidden = false;

  if (animate && !reduceMotion.matches) {
    copyAnimation?.cancel();
    markAnimation?.cancel();
    copyAnimation = document.querySelector('#daily-copy').animate(
      [{ opacity: .25, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }],
      { duration: 310, easing: 'cubic-bezier(.22,.72,.27,1)' },
    );
    markAnimation = mark.animate(
      [{ opacity: .2, transform: 'rotate(-24deg) scale(.8)' }, { opacity: 1, transform: 'none' }],
      { duration: 440, easing: 'cubic-bezier(.22,.72,.27,1)' },
    );
  }
}

signs.forEach(([name, symbol], index) => {
  const button = document.createElement('button');
  const icon = document.createElement('span');
  button.type = 'button';
  button.className = 'sign-button';
  icon.textContent = `${symbol}\uFE0E`;
  icon.setAttribute('aria-hidden', 'true');
  button.append(icon, name);
  button.addEventListener('click', () => {
    if (index === selected) return;
    selected = index;
    store('suzy.daily.sign', String(index));
    showDaily(true);
  });
  buttons.append(button);
});

doneButton.addEventListener('click', () => {
  if (shownDate !== localDate(new Date())) return showDaily();
  if (completed.has(selected)) completed.delete(selected);
  else completed.add(selected);
  store('suzy.daily.completed', `${shownDate}:${[...completed].join(',')}`);
  updateCompletion();
});

showDaily();
function refreshDate() {
  if (shownDate !== localDate(new Date())) showDaily();
}
setInterval(refreshDate, 30_000);
document.addEventListener('visibilitychange', refreshDate);

if (!reduceMotion.matches && 'IntersectionObserver' in window) {
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('revealed');
      observer.unobserve(entry.target);
    }
  }, { rootMargin: '0px 0px -32px' });
  document.querySelectorAll('[data-reveal]').forEach((element) => observer.observe(element));
}
