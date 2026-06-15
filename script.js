// Function for animating the counter
function animateValue(obj, start, end, duration) {
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        obj.textContent = Math.floor(progress * (end - start) + start);
        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    };
    window.requestAnimationFrame(step);
}

// Функція для динамічної оптимізації картинок через CDN
const isLocal = window.location.hostname === '' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
function getImageUrl(url) {
    if (!url) return 'study-icon.png';
    if (url === 'study-icon.png') return url;
    if (isLocal || url.startsWith('http')) return url;

    let baseUrl = window.location.origin + window.location.pathname.replace(/index\.html$/, '');
    if (!baseUrl.endsWith('/')) baseUrl += '/';
    const absoluteUrl = baseUrl + url;

    // Використовуємо wsrv.nl для ресайзу до 300px та стиснення в WebP (80%)
    return `https://wsrv.nl/?url=${absoluteUrl.replace(/^https?:\/\//, '')}&w=300&output=webp&q=80`;
}

// Офіційне посилання на канал
const BASE_CHANNEL_URL = 'https://t.me/gradedenglishreaders';

// Елементи DOM
const booksContainer = document.getElementById('books-container');
const searchInput = document.getElementById('search-input');
const pubButtons = document.querySelectorAll('.pub-btn');
const lvlButtons = document.querySelectorAll('.lvl-btn');
const totalCount = document.getElementById('total-count');

let allBooks = [];
let filteredBooks = [];
let currentPubFilter = 'all';
let currentLvlFilter = 'all';
let currentDisplayedCount = 30;
const ITEMS_PER_PAGE = 30;

const loadMoreBtn = document.getElementById('load-more-btn');

// Функція для завантаження даних (тепер тільки статичний books.json)
async function fetchBooks() {
    try {
        console.log("Завантажуємо свіжий books.json...");
        // Додаємо випадковий параметр, щоб браузер не кешував старий файл
        const response = await fetch(`books.json?v=${new Date().getTime()}`);

        if (!response.ok) {
            throw new Error(`Помилка HTTP: ${response.status}`);
        }

        const data = await response.json();
        allBooks = Array.isArray(data) ? data : Object.values(data);

        // Сортуємо книги за датою додавання в канал (за message_id, новіші - зверху)
        allBooks.sort((a, b) => (b.message_id || 0) - (a.message_id || 0));

        filteredBooks = [...allBooks];

        console.log(`Успішно завантажено ${allBooks.length} книг.`);

        // Перевіряємо, чи є книги у видавництв. Якщо ні - додаємо (Stay Tuned) червоним
        pubButtons.forEach(btn => {
            const pubName = btn.dataset.pub;
            if (pubName !== 'all') {
                const hasBooks = allBooks.some(b => b.publisher === pubName);
                if (!hasBooks && ['Easy Classic', 'Who HQ Reader', 'Step Into Reading', 'Oxford Bookworms'].includes(pubName)) {
                    btn.innerHTML = `${pubName} <span style="color: #ef4444; font-size: 11px; margin-left: 4px;">(Stay Tuned)</span>`;
                    btn.disabled = true;
                    btn.style.opacity = '0.7';
                } else {
                    btn.innerHTML = pubName;
                }
            }
        });

        if (totalCount) {
            const currentVal = parseInt(totalCount.textContent) || 0;
            animateValue(totalCount, currentVal, allBooks.length, 1200);
        }

        // Рендеримо з перемішуванням при першому завантаженні
        filterBooks(true);
    } catch (error) {
        console.error("Помилка завантаження книг:", error);
        booksContainer.innerHTML = '<p class="error-msg" style="text-align: center; grid-column: 1/-1; color: var(--text-color);">Oops! Failed to load books. Please refresh the page.</p>';
    }
}

// Рендер книг
function renderBooks(reset = true) {
    if (reset) {
        booksContainer.innerHTML = '';
        currentDisplayedCount = ITEMS_PER_PAGE;
    }

    if (filteredBooks.length === 0) {
        booksContainer.innerHTML = '<p style="text-align: center; width: 100%; color: var(--text-muted);">No books found 😔</p>';
        loadMoreBtn.style.display = 'none';
        return;
    }

    const startIndex = reset ? 0 : currentDisplayedCount - ITEMS_PER_PAGE;
    const booksToDisplay = filteredBooks.slice(startIndex, currentDisplayedCount);

    booksToDisplay.forEach(book => {
        try {
            const card = document.createElement('div');
            card.className = 'book-card';

            // Формуємо динамічне посилання на завантаження
            const downloadLink = `${BASE_CHANNEL_URL}/${book.message_id}`;

            // Формуємо HTML для картинок (слайдер з кнопками та lazy load)
            let imagesHtml = '';
            let sliderControls = '';
            if (Array.isArray(book.coverUrls) && book.coverUrls.length > 1) {
                imagesHtml = book.coverUrls.map((url, index) => {
                    const optimizedUrl = getImageUrl(url);
                    return `<img src="${optimizedUrl}" data-original="${url}" loading="lazy" alt="Cover" class="book-cover" onclick="openModal(this.dataset.original)" onerror="this.src='study-icon.png'">`;
                }).join('');
                sliderControls = `
                    <button class="slider-btn prev-btn" onclick="event.preventDefault(); this.parentElement.querySelector('.cover-slider').scrollBy({left: -200, behavior: 'smooth'})">❮</button>
                    <button class="slider-btn next-btn" onclick="event.preventDefault(); this.parentElement.querySelector('.cover-slider').scrollBy({left: 200, behavior: 'smooth'})">❯</button>
                `;
            } else if (Array.isArray(book.coverUrls) && book.coverUrls.length === 1) {
                const url = book.coverUrls[0];
                const optimizedUrl = getImageUrl(url);
                imagesHtml = `<img src="${optimizedUrl}" data-original="${url}" loading="lazy" alt="Cover" class="book-cover" onclick="openModal(this.dataset.original)" onerror="this.src='study-icon.png'">`;
            } else {
                const url = book.coverUrl || 'study-icon.png';
                const optimizedUrl = getImageUrl(url);
                imagesHtml = `<img src="${optimizedUrl}" data-original="${url}" loading="lazy" alt="Cover" class="book-cover" onclick="openModal(this.dataset.original)" onerror="this.src='study-icon.png'">`;
            }

            const pubClass = book.publisher && typeof book.publisher === 'string' ? book.publisher.split(' ')[0].toLowerCase() : 'default';
            const pubNameDisplay = book.publisher && typeof book.publisher === 'string' ? book.publisher.toUpperCase() : 'OTHER';

            card.innerHTML = `
                <div class="book-cover-container" style="position: relative;">
                    <div class="cover-slider">
                        ${imagesHtml}
                    </div>
                    ${sliderControls}
                </div>
                <div class="book-info">
                    <h3 class="book-title">${book.title || 'Unknown Title'}</h3>
                    <div class="tags">
                        <span class="tag pub-${pubClass}">${pubNameDisplay}</span>
                        <span class="tag level-${book.level ? book.level.replace(/\s+/g, '-') : 'Unknown'}">${book.level || 'Unknown'}</span>
                    </div>
                    <a href="${downloadLink}" class="download-btn" target="_blank">
                        Download PDF
                    </a>
                </div>
            `;
            booksContainer.appendChild(card);
        } catch (err) {
            console.error("Помилка при рендері книги:", err, book);
        }
    });

    // Управління кнопкою "Показати ще"
    if (currentDisplayedCount < filteredBooks.length) {
        loadMoreBtn.style.display = 'inline-block';
        loadMoreBtn.textContent = "Show 40 more books";
    } else {
        loadMoreBtn.style.display = 'none';
    }
}

// Завантаження додаткових книг при кліку
loadMoreBtn.addEventListener('click', () => {
    currentDisplayedCount += ITEMS_PER_PAGE;
    renderBooks(false); // append, no reset
});

// Додаємо параметр shouldShuffle (за замовчуванням false)
function filterBooks(shouldShuffle = false) {
    const searchTerm = searchInput.value.toLowerCase().trim();

    filteredBooks = allBooks.filter(book => {
        if (!book) return false;

        const matchesSearch = (book.title && book.title.toLowerCase().includes(searchTerm)) ||
            (book.publisher && book.publisher.toLowerCase().includes(searchTerm));

        const matchesPub = currentPubFilter === 'all' || book.publisher === currentPubFilter;
        const matchesLvl = currentLvlFilter === 'all' || book.level === currentLvlFilter;

        return matchesSearch && matchesPub && matchesLvl;
    });

    const shuffleCheckbox = document.getElementById('shuffle-checkbox');
    const isShuffleOn = shuffleCheckbox ? shuffleCheckbox.checked : true; // За замовчуванням true, якщо раптом елемента немає

    if (shouldShuffle && isShuffleOn) {
        // Якщо клікнули на кнопку фільтра і тумблер УВІМКНЕНО — перемішуємо результати
        for (let i = filteredBooks.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [filteredBooks[i], filteredBooks[j]] = [filteredBooks[j], filteredBooks[i]];
        }
    } else if (searchTerm !== '' || !isShuffleOn) {
        // Якщо працює пошук АБО тумблер ВИМКНЕНО — сортуємо за новизною (датою)
        filteredBooks.sort((a, b) => (b.message_id || 0) - (a.message_id || 0));
    } else {
        // Якщо це просто рендер після "Показати ще" або щось інше, де shouldShuffle=false і немає пошуку
        // Залишаємо той порядок, що є
    }

    renderBooks(true);
}

// Обробники подій для пошуку (без перемішування)
searchInput.addEventListener('input', () => filterBooks(false));

// Обробник для тумблера перемішування
const shuffleCheckboxElem = document.getElementById('shuffle-checkbox');
if (shuffleCheckboxElem) {
    shuffleCheckboxElem.addEventListener('change', () => {
        // Якщо тумблер увімкнули або вимкнули, оновлюємо видачу. 
        // Якщо ввімкнули - перемішуємо. Якщо вимкнули - відсортує за датою.
        filterBooks(shuffleCheckboxElem.checked);
    });
}

// Обробники для кнопок видавництва
pubButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        pubButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentPubFilter = btn.dataset.pub;

        if (currentPubFilter === 'National Geographic') {
            document.querySelectorAll('.cefr-btn').forEach(el => el.style.display = 'none');
            document.querySelectorAll('.blackcat-btn').forEach(el => el.style.display = 'none');
            document.querySelectorAll('.penguin-btn').forEach(el => el.style.display = 'none');
            document.querySelectorAll('.macmillan-btn').forEach(el => el.style.display = 'none');
            document.querySelectorAll('.natgeo-btn').forEach(el => el.style.display = 'inline-block');
            currentLvlFilter = 'all';
            lvlButtons.forEach(b => b.classList.remove('active'));
            document.querySelector('.lvl-btn[data-level="all"]').classList.add('active');
        } else if (currentPubFilter === 'Black Cat') {
            document.querySelectorAll('.cefr-btn').forEach(el => el.style.display = 'none');
            document.querySelectorAll('.natgeo-btn').forEach(el => el.style.display = 'none');
            document.querySelectorAll('.penguin-btn').forEach(el => el.style.display = 'none');
            document.querySelectorAll('.macmillan-btn').forEach(el => el.style.display = 'none');
            document.querySelectorAll('.blackcat-btn').forEach(el => el.style.display = 'inline-block');
            currentLvlFilter = 'all';
            lvlButtons.forEach(b => b.classList.remove('active'));
            document.querySelector('.lvl-btn[data-level="all"]').classList.add('active');
        } else {
            // Для всіх інших - показуємо CEFR
            document.querySelectorAll('.cefr-btn').forEach(el => el.style.display = 'inline-block');
            document.querySelectorAll('.natgeo-btn').forEach(el => el.style.display = 'none');
            document.querySelectorAll('.blackcat-btn').forEach(el => el.style.display = 'none');

            // Якщо Penguin Readers - показуємо його кнопки
            if (currentPubFilter === 'Penguin Readers') {
                document.querySelectorAll('.penguin-btn').forEach(el => el.style.display = 'inline-block');
                document.querySelectorAll('.macmillan-btn').forEach(el => el.style.display = 'none');
            }
            // Якщо Macmillan - показуємо його кнопки
            else if (currentPubFilter === 'Macmillan Reader') {
                document.querySelectorAll('.macmillan-btn').forEach(el => el.style.display = 'inline-block');
                document.querySelectorAll('.penguin-btn').forEach(el => el.style.display = 'none');
            }
            // В інших випадках ховаємо
            else {
                document.querySelectorAll('.penguin-btn').forEach(el => el.style.display = 'none');
                document.querySelectorAll('.macmillan-btn').forEach(el => el.style.display = 'none');
            }

            // Якщо вибрана підкатегорія, якої тут немає - скидаємо на "All"
            if (!['all', 'A0-A1', 'A1', 'A2', 'A2-B1', 'B1', 'B2', 'C1', 'Penguin Young Reader', 'Penguin Kids', 'Macmillan Literature Collections'].includes(currentLvlFilter)) {
                currentLvlFilter = 'all';
                lvlButtons.forEach(b => b.classList.remove('active'));
                document.querySelector('.lvl-btn[data-level="all"]').classList.add('active');
            }
        }

        filterBooks(true);
    });
});

// Обробники для кнопок рівня
lvlButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        lvlButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentLvlFilter = btn.dataset.level;
        filterBooks(true);
    });
});

// Запускаємо додаток
fetchBooks();

// Логіка модального вікна для зображень
const imageModal = document.getElementById('image-modal');
const modalImg = document.getElementById('modal-img');
const closeModalBtn = document.querySelector('.close-modal');

function openModal(src) {
    if (src.includes('study-icon.png')) return; // Не відкриваємо заглушку
    modalImg.src = src;
    imageModal.classList.add('show');
    document.body.style.overflow = 'hidden'; // Забороняємо скрол фону
}

function closeModal() {
    imageModal.classList.remove('show');
    document.body.style.overflow = ''; // Повертаємо скрол
}

closeModalBtn.addEventListener('click', closeModal);

imageModal.addEventListener('click', (e) => {
    if (e.target === imageModal) {
        closeModal();
    }
});

// Закриття по Escape
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && imageModal.classList.contains('show')) {
        closeModal();
    }
});
