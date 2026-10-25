/* =========================================================
   BARBER HOUSE — интерактив сайта
   Сайт работает и без этого файла: меню и якоря — обычные ссылки,
   фото галереи открываются в новой вкладке. Скрипт только добавляет удобства.
   ========================================================= */

'use strict';

// === 1. CONFIG — ссылка на мессенджер для записи ===

// Единственное место, где меняется ссылка записи.
// Пока bookingUrl пустой, кнопки «Записаться» ведут к контактам и показывают подсказку.
// Примеры: 'https://t.me/username' или 'https://wa.me/79990000000'
const CONFIG = {
  bookingUrl: '',
  messengerName: 'Telegram',
};

// Те же точки перелома, что в CSS
const DESKTOP_QUERY = window.matchMedia('(min-width: 1024px)');
const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)');

const root = document.documentElement;

// Иконка из SVG-спрайта в index.html
function icon(name) {
  return `<svg class="icon" aria-hidden="true"><use href="#icon-${name}"></use></svg>`;
}

// Общая логика модальных окон <dialog> (окно записи и лайтбокс галереи).
// showModal() сам держит фокус внутри окна (остальная страница становится недоступной)
// и закрывает окно по Esc. Здесь добавляем то, чего браузер не делает:
// блокировку прокрутки фона, закрытие кликом по затемнению и возврат фокуса.
// Возвращает функцию open(кнопка, которая открыла окно)
function setupModal(dialog) {
  let opener = null;
  let pressedOnBackdrop = false;

  // Клик по затемнению — это клик по самому <dialog>, а не по его содержимому.
  // Проверяем и нажатие, и отпускание: если выделяли текст в поле и отпустили мышь
  // на фоне, окно не закроется
  dialog.addEventListener('pointerdown', (event) => {
    pressedOnBackdrop = event.target === dialog;
  });
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog && pressedOnBackdrop) {
      dialog.close();
    }
  });

  // Срабатывает при любом закрытии: крестик, фон, Esc
  dialog.addEventListener('close', () => {
    root.classList.remove('is-locked');
    if (opener) {
      opener.focus(); // фокус возвращается туда, откуда окно открыли
    }
  });

  return function open(trigger) {
    opener = trigger;
    dialog.showModal();
    root.classList.add('is-locked'); // страница под окном не прокручивается

    // Обычно браузер сам ставит фокус в поле с autofocus. Подстраховка на случай,
    // если фокус достался самому окну (такое один раз наблюдалось в Chrome)
    const autofocusField = dialog.querySelector('[autofocus]');
    if (autofocusField && document.activeElement === dialog) {
      autofocusField.focus();
    }
  };
}

// === 2. Запись: кнопки [data-booking] и окно записи ===

// Всплывающая подсказка внизу экрана.
// role="status" — экранный диктор прочитает текст, как только он появится
const toast = document.createElement('div');
toast.className = 'toast';
toast.setAttribute('role', 'status');
let toastTimer;

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 4000);
}

// Правила проверки полей формы записи: возвращают текст ошибки или пустую строку
const BOOKING_RULES = {
  name: (value) => (value.trim().length >= 2 ? '' : 'Введите имя — минимум 2 буквы.'),
  phone: (value) => {
    if (/[^\d\s()+-]/.test(value)) {
      return 'В номере могут быть только цифры, пробелы, скобки, «+» и «-».';
    }
    const digits = value.replace(/\D/g, '').length;
    return digits >= 10 && digits <= 15 ? '' : 'Введите номер телефона: от 10 до 15 цифр.';
  },
  service: (value) => (value ? '' : 'Выберите услугу.'),
};

// Окно записи. Возвращает функцию открытия окна или null, если окна нет
// или браузер не поддерживает <dialog>
function initBookingModal() {
  const dialog = document.getElementById('booking-modal');
  const form = document.getElementById('booking-form');
  if (!dialog || !form || typeof HTMLDialogElement !== 'function') return null;

  const open = setupModal(dialog);
  const fields = Object.keys(BOOKING_RULES).map((name) => form.elements[name]);

  // Список услуг берём из прайса: названия и цены хранятся в одном месте
  const select = form.elements.service;
  document.querySelectorAll('.price-list__item').forEach((item) => {
    const name = item.querySelector('.price-list__name').firstChild.textContent.trim();
    const price = item.querySelector('.price-list__price').textContent.trim();
    select.add(new Option(`${name} — ${price}`, name));
  });

  // Если в CONFIG есть ссылка на мессенджер — показываем её в окне как второй способ записи
  if (CONFIG.bookingUrl) {
    const alt = dialog.querySelector('[data-booking-alt]');
    const link = alt.querySelector('a');
    link.href = CONFIG.bookingUrl;
    link.textContent = `Написать в ${CONFIG.messengerName}`;
    alt.hidden = false;
  }

  // Ошибка показывается под полем; aria-invalid и aria-describedby
  // сообщают о ней экранному диктору
  function showError(field, message) {
    const error = document.getElementById(field.getAttribute('aria-describedby'));
    error.textContent = message;
    error.hidden = !message;
    if (message) {
      field.setAttribute('aria-invalid', 'true');
    } else {
      field.removeAttribute('aria-invalid');
    }
  }

  function validate(field) {
    const message = BOOKING_RULES[field.name](field.value);
    showError(field, message);
    return !message;
  }

  // Поле с ошибкой перепроверяем при каждом вводе — ошибка исчезает сразу после исправления
  fields.forEach((field) => {
    const eventName = field.tagName === 'SELECT' ? 'change' : 'input';
    field.addEventListener(eventName, () => {
      if (field.hasAttribute('aria-invalid')) {
        validate(field);
      }
    });
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault(); // форма демонстрационная: ничего не отправляем
    const invalid = fields.filter((field) => !validate(field)); // проверяем все поля сразу
    if (invalid.length) {
      invalid[0].focus(); // фокус — на первое поле с ошибкой
      return;
    }
    dialog.close();
    showToast('Демонстрация: заявка не отправлена');
  });

  dialog.querySelector('[data-modal-close]').addEventListener('click', () => dialog.close());

  // Любое закрытие стирает введённое: персональные данные не остаются даже в открытой странице
  dialog.addEventListener('close', () => {
    form.reset();
    fields.forEach((field) => showError(field, ''));
  });

  return open;
}

function initBooking() {
  const buttons = document.querySelectorAll('[data-booking]');
  document.body.append(toast);

  if (CONFIG.bookingUrl) {
    const note = document.querySelector('[data-booking-note]');
    if (note) {
      note.textContent = `Через ${CONFIG.messengerName}`;
    }
  }

  // Основной вариант: кнопки «Записаться» открывают окно записи
  const openBooking = initBookingModal();
  if (openBooking) {
    buttons.forEach((button) => {
      button.addEventListener('click', (event) => {
        event.preventDefault(); // не переходим к #contacts
        openBooking(button);
      });
    });
    return;
  }

  // Запасной вариант для браузеров без <dialog> — как было до появления окна:
  // ссылка на мессенджер или переход к контактам с подсказкой
  if (CONFIG.bookingUrl) {
    buttons.forEach((button) => {
      button.href = CONFIG.bookingUrl;
      button.target = '_blank';
      button.rel = 'noopener noreferrer'; // новая вкладка не получает доступ к нашей странице
      button.setAttribute(
        'aria-label',
        `${button.textContent.trim()} через ${CONFIG.messengerName} (откроется в новой вкладке)`
      );
    });
    return;
  }

  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      showToast(`Онлайн-запись через ${CONFIG.messengerName} скоро откроется.`);
    });
  });
}

// === 3. Бургер-меню ===

function initMenu() {
  const header = document.querySelector('.header');
  const burger = document.querySelector('.burger');
  const nav = document.querySelector('.nav');
  if (!header || !burger || !nav) return;

  const isOpen = () => nav.classList.contains('is-open');

  function setOpen(open) {
    nav.classList.toggle('is-open', open);
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
    root.classList.toggle('is-locked', open); // страница под меню не прокручивается
  }

  burger.addEventListener('click', () => setOpen(!isOpen()));

  // Клик по любой ссылке в шапке (пункт меню, логотип, «Записаться») закрывает меню
  header.addEventListener('click', (event) => {
    if (event.target.closest('a') && isOpen()) {
      setOpen(false);
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && isOpen()) {
      setOpen(false);
      burger.focus(); // возвращаем фокус туда, откуда меню открыли
    }
  });

  // На десктопе бургера нет — открытое меню закрываем
  DESKTOP_QUERY.addEventListener('change', (event) => {
    if (event.matches) {
      setOpen(false);
    }
  });
}

// Пока меняется ширина окна (поворот планшета, растягивание окна),
// анимации меню отключены — иначе меню на долю секунды «мигает» при переходе через 1024px
function initResizeGuard() {
  let timer;
  window.addEventListener('resize', () => {
    root.classList.add('is-resizing');
    clearTimeout(timer);
    timer = setTimeout(() => root.classList.remove('is-resizing'), 200);
  });
}

// === 4. Шапка при прокрутке ===

function initHeaderScroll() {
  const header = document.querySelector('.header');
  if (!header) return;

  const update = () => header.classList.toggle('header--scrolled', window.scrollY > 40);
  update();
  // passive: обработчик не мешает браузеру плавно прокручивать страницу
  window.addEventListener('scroll', update, { passive: true });
}

// === 5. Подсветка активного пункта меню ===

function initActiveLink() {
  if (!('IntersectionObserver' in window)) return;

  const links = [...document.querySelectorAll('.nav__link')];
  const linkById = new Map(links.map((link) => [link.hash.slice(1), link]));
  // Hero тоже наблюдаем: когда он на экране, ни один пункт не подсвечен
  const sections = ['hero', ...linkById.keys()]
    .map((id) => document.getElementById(id))
    .filter(Boolean);

  // Узкая полоса посередине экрана: активна секция, которая её пересекает
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      links.forEach((link) => {
        link.classList.remove('is-active');
        link.removeAttribute('aria-current');
      });
      const active = linkById.get(entry.target.id);
      if (active) {
        active.classList.add('is-active');
        active.setAttribute('aria-current', 'true');
      }
    });
  }, { rootMargin: '-50% 0px -50% 0px' });

  sections.forEach((section) => observer.observe(section));
}

// === 6. Появление блоков при прокрутке ===

function initReveal() {
  // Если человек отключил анимации в системе — ничего не прячем и не анимируем
  if (REDUCED_MOTION.matches || !('IntersectionObserver' in window)) return;

  const targets = document.querySelectorAll(
    '.section__title, .about__text, .feature, .service-card, .price-list__item, ' +
    '.team-card, .gallery__item, .contacts__info, .contacts__map'
  );

  // Проявить блок. После анимации убираем служебные классы, чтобы вернулись собственные
  // переходы элемента (например, подъём карточки при наведении)
  function reveal(element) {
    observer.unobserve(element);
    const cleanUp = (event) => {
      if (event.target !== element) return; // переходы вложенных элементов не считаем
      element.removeEventListener('transitionend', cleanUp);
      element.classList.remove('reveal', 'is-visible');
      element.style.removeProperty('transition-delay');
    };
    element.addEventListener('transitionend', cleanUp);
    element.classList.add('is-visible');
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        reveal(entry.target);
      }
    });
  }, { rootMargin: '0px 0px -10% 0px' });

  targets.forEach((element) => {
    // Соседние карточки появляются «лесенкой» с небольшой задержкой
    const index = [...element.parentElement.children].indexOf(element);
    element.style.transitionDelay = `${(index % 4) * 80}ms`;
    element.classList.add('reveal');
    observer.observe(element);
  });

  // Пользователь клавиатуры не должен видеть рамку фокуса вокруг ещё прозрачного блока:
  // если фокус попал внутрь блока, который не проявился полностью, — показываем его мгновенно
  document.addEventListener('focusin', (event) => {
    const element = event.target.closest('.reveal');
    if (element) {
      observer.unobserve(element);
      element.classList.remove('reveal', 'is-visible');
      element.style.removeProperty('transition-delay');
    }
  });
}

// === 7. Лайтбокс галереи ===

function initLightbox() {
  const links = [...document.querySelectorAll('.gallery__link')];
  // Старый браузер без <dialog> — ссылки просто откроют фото в новой вкладке
  if (!links.length || typeof HTMLDialogElement !== 'function') return;

  // Окно на <dialog>: фокус, Esc, затемнение и блокировку прокрутки даёт setupModal()
  const dialog = document.createElement('dialog');
  dialog.className = 'lightbox';
  dialog.setAttribute('aria-label', 'Просмотр фотографии');
  dialog.innerHTML = `
    <figure class="lightbox__figure">
      <img class="lightbox__img" src="" alt="">
      <figcaption class="lightbox__caption" aria-hidden="true"></figcaption>
    </figure>
    <p class="lightbox__counter"></p>
    <button class="lightbox__btn lightbox__btn--close" type="button" aria-label="Закрыть">${icon('close')}</button>
    <button class="lightbox__btn lightbox__btn--prev" type="button" aria-label="Предыдущее фото">${icon('arrow-left')}</button>
    <button class="lightbox__btn lightbox__btn--next" type="button" aria-label="Следующее фото">${icon('arrow-right')}</button>
  `;
  document.body.append(dialog);

  const openLightbox = setupModal(dialog);
  const image = dialog.querySelector('.lightbox__img');
  const caption = dialog.querySelector('.lightbox__caption');
  const counter = dialog.querySelector('.lightbox__counter');
  let current = 0;

  function show(index) {
    current = (index + links.length) % links.length; // по кругу: после последнего — первое
    const link = links[current];
    const thumbnail = link.querySelector('img');
    image.src = link.href; // большая версия 1200px
    image.alt = thumbnail.alt;
    caption.textContent = thumbnail.alt;
    counter.textContent = `${current + 1} / ${links.length}`;
  }

  links.forEach((link, index) => {
    link.addEventListener('click', (event) => {
      event.preventDefault(); // не открываем файл в новой вкладке
      show(index);
      openLightbox(link);
    });
  });

  dialog.querySelector('.lightbox__btn--close').addEventListener('click', () => dialog.close());
  dialog.querySelector('.lightbox__btn--prev').addEventListener('click', () => show(current - 1));
  dialog.querySelector('.lightbox__btn--next').addEventListener('click', () => show(current + 1));

  dialog.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') show(current - 1);
    if (event.key === 'ArrowRight') show(current + 1);
  });
}

// === 8. Текущий год в футере ===

function initYear() {
  const year = String(new Date().getFullYear());
  document.querySelectorAll('[data-year]').forEach((element) => {
    element.textContent = year;
  });
}

// === Запуск ===
// Скрипт подключён с defer, поэтому HTML к этому моменту уже разобран

initBooking();
initMenu();
initResizeGuard();
initHeaderScroll();
initActiveLink();
initReveal();
initLightbox();
initYear();
