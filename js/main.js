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

// === 2. Кнопки записи [data-booking] ===

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

function initBooking() {
  const buttons = document.querySelectorAll('[data-booking]');

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

    const note = document.querySelector('[data-booking-note]');
    if (note) {
      note.textContent = `Через ${CONFIG.messengerName}`;
    }
    return;
  }

  // Ссылки нет: переход к #contacts происходит сам (это обычная ссылка), добавляем подсказку
  document.body.append(toast);
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

  // <dialog> с showModal() сам удерживает фокус внутри, закрывается по Esc
  // и делает остальную страницу недоступной, пока открыт
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

  const image = dialog.querySelector('.lightbox__img');
  const caption = dialog.querySelector('.lightbox__caption');
  const counter = dialog.querySelector('.lightbox__counter');
  let current = 0;
  let opener = null;

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
      opener = link;
      show(index);
      dialog.showModal();
      root.classList.add('is-locked');
    });
  });

  dialog.querySelector('.lightbox__btn--close').addEventListener('click', () => dialog.close());
  dialog.querySelector('.lightbox__btn--prev').addEventListener('click', () => show(current - 1));
  dialog.querySelector('.lightbox__btn--next').addEventListener('click', () => show(current + 1));

  dialog.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') show(current - 1);
    if (event.key === 'ArrowRight') show(current + 1);
  });

  // Клик по тёмному фону (мимо фото и кнопок) закрывает лайтбокс
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) {
      dialog.close();
    }
  });

  // Срабатывает при любом закрытии: крестик, фон, Esc
  dialog.addEventListener('close', () => {
    root.classList.remove('is-locked');
    if (opener) {
      opener.focus(); // фокус возвращается на фото, которое открывали
    }
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
