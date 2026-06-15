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

// Конфігурація Firebase, яку ти надав
const firebaseConfig = {
    apiKey: "AIzaSyC51Qc4m3GIKCKmnO_PyKVwLX15PcDs_-4",
    authDomain: "gradedenglishreaders-ccdcb.firebaseapp.com",
    databaseURL: "https://gradedenglishreaders-ccdcb-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "gradedenglishreaders-ccdcb",
    storageBucket: "gradedenglishreaders-ccdcb.firebasestorage.app",
    messagingSenderId: "433844412188",
    appId: "1:433844412188:web:81fbcaa187186ab594a4d9"
};

// Ініціалізуємо Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const database = firebase.database();

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

// Функція для завантаження даних з Firebase
async function fetchBooks() {
    try {
        let cachedBooks = [];
        let maxMessageId = 0;
        
        // Зчитуємо кеш з LocalStorage
        const cacheString = localStorage.getItem('hubBooksCache');
        if (cacheString) {
            try {
                cachedBooks = JSON.parse(cacheString);
            } catch (e) {
                console.error("Помилка читання кешу", e);
                cachedBooks = [];
            }
        }

        // Якщо кеш порожній (перший візит), пробуємо скачати статичну базу
        if (!cachedBooks || cachedBooks.length === 0) {
            try {
                console.log("Локальний кеш порожній. Завантажуємо статичний books.json...");
                const response = await fetch('books.json');
                if (response.ok) {
                    const staticData = await response.json();
                    cachedBooks = Array.isArray(staticData) ? staticData : Object.values(staticData);
                    console.log(`Успішно завантажено ${cachedBooks.length} книг зі статичного файлу.`);
                } else {
                    console.log("Файл books.json не знайдено, продовжуємо без нього.");
                }
            } catch (e) {
                console.log("Файл books.json не завантажено:", e.message);
            }
        }

        // Знаходимо максимальний message_id у кеші (або статичній базі)
        if (Array.isArray(cachedBooks) && cachedBooks.length > 0) {
            maxMessageId = Math.max(...cachedBooks.map(b => b.message_id || 0));
        } else {
            cachedBooks = [];
        }

        let query = database.ref('books');
        
        // Якщо є кеш, завантажуємо ТІЛЬКИ нові книги
        if (maxMessageId > 0) {
            query = query.orderByChild('message_id').startAt(maxMessageId + 1);
        }

        let newBooks = [];
        try {
            const snapshot = await query.once('value');
            if (snapshot.exists()) {
                const data = snapshot.val();
                newBooks = Array.isArray(data) ? data : Object.values(data);
                newBooks = newBooks.filter(book => book !== null);
            }
        } catch (firebaseError) {
            console.error("Помилка підключення до Firebase (можливо ліміт вичерпано):", firebaseError);
            // Продовжуємо роботу, бо у нас може бути статична база в cachedBooks!
        }

        if (newBooks.length > 0 || cachedBooks.length > 0) {
            // Об'єднуємо старі і нові книги, уникаючи дублікатів
            const uniqueBooks = [];
            const seenIds = new Set();
            
            for (const b of [...cachedBooks, ...newBooks]) {
                if (b.message_id) {
                    if (!seenIds.has(b.message_id)) {
                        seenIds.add(b.message_id);
                        uniqueBooks.push(b);
                    }
                } else {
                    uniqueBooks.push(b); // Якщо немає ID, просто додаємо
                }
            }
            
            allBooks = uniqueBooks;
            filteredBooks = [...allBooks];
            
            // Якщо були завантажені НОВІ книги, оновлюємо кеш
            if (newBooks.length > 0) {
                localStorage.setItem('hubBooksCache', JSON.stringify(allBooks));
                console.log(`Завантажено ${newBooks.length} нових книг з Firebase. Всього у кеші: ${allBooks.length}`);
            } else {
                console.log(`Firebase не повернув нових книг. Використовуємо кеш (${allBooks.length} книг).`);
            }

            // Перевіряємо, чи є книги у видавництв. Якщо ні - додаємо (Stay Tuned) червоним
            pubButtons.forEach(btn => {
                const pubName = btn.dataset.pub;
                if (pubName !== 'all') {
                    const hasBooks = allBooks.some(b => b.publisher === pubName);
                    if (!hasBooks && ['Easy Classic', 'Who HQ Reader', 'Step Into Reading', 'Oxford Bookworms'].includes(pubName)) {
                        btn.innerHTML = `${pubName} <span style="color: #ef4444; font-size: 11px; margin-left: 4px;">(Stay Tuned)</span>`;
                    } else {
                        btn.innerHTML = pubName;
                    }
                }
            });

            if (totalCount) {
                const currentVal = parseInt(totalCount.textContent) || 0;
                animateValue(totalCount, currentVal, allBooks.length, 1200);
            }
            renderBooks(true);
        } else {
            console.log("Даних немає ні в кеші, ні в базі");
            booksContainer.innerHTML = '<p style="text-align: center; width: 100%; color: var(--text-muted);">Books are not loaded in the database yet.</p>';
        }
    } catch (error) {
        console.error('Помилка завантаження з Firebase:', error);
        booksContainer.innerHTML = '<p style="text-align: center; width: 100%; color: #ef4444;">Database connection error. Please try refreshing.</p>';
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

// Фільтрація
function filterBooks() {
    const searchTerm = searchInput.value.toLowerCase();

    filteredBooks = allBooks.filter(book => {
        if (!book) return false;

        const matchesSearch = (book.title && book.title.toLowerCase().includes(searchTerm)) ||
            (book.publisher && book.publisher.toLowerCase().includes(searchTerm));

        const matchesPub = currentPubFilter === 'all' || book.publisher === currentPubFilter;
        const matchesLvl = currentLvlFilter === 'all' || book.level === currentLvlFilter;

        return matchesSearch && matchesPub && matchesLvl;
    });

    renderBooks(true);
}

// Обробники подій для пошуку
searchInput.addEventListener('input', filterBooks);

// Обробники для кнопок видавництва
pubButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        pubButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentPubFilter = btn.dataset.pub;

        if (currentPubFilter === 'National Geographic') {
            document.querySelectorAll('.cefr-btn').forEach(el => el.style.display = 'none');
            document.querySelectorAll('.blackcat-btn').forEach(el => el.style.display = 'none');
            document.querySelectorAll('.natgeo-btn').forEach(el => el.style.display = 'inline-block');
            currentLvlFilter = 'all';
            lvlButtons.forEach(b => b.classList.remove('active'));
            document.querySelector('.lvl-btn[data-level="all"]').classList.add('active');
        } else if (currentPubFilter === 'Black Cat') {
            document.querySelectorAll('.cefr-btn').forEach(el => el.style.display = 'none');
            document.querySelectorAll('.natgeo-btn').forEach(el => el.style.display = 'none');
            document.querySelectorAll('.blackcat-btn').forEach(el => el.style.display = 'inline-block');
            currentLvlFilter = 'all';
            lvlButtons.forEach(b => b.classList.remove('active'));
            document.querySelector('.lvl-btn[data-level="all"]').classList.add('active');
        } else {
            document.querySelectorAll('.cefr-btn').forEach(el => el.style.display = 'inline-block');
            document.querySelectorAll('.natgeo-btn').forEach(el => el.style.display = 'none');
            document.querySelectorAll('.blackcat-btn').forEach(el => el.style.display = 'none');
            // Якщо зараз вибрано підкатегорію NatGeo або BlackCat, скидаємо на Всі рівні
            if (!['all', 'A0-A1', 'A1', 'A2', 'A2-B1', 'B1', 'B2', 'C1'].includes(currentLvlFilter)) {
                currentLvlFilter = 'all';
                lvlButtons.forEach(b => b.classList.remove('active'));
                document.querySelector('.lvl-btn[data-level="all"]').classList.add('active');
            }
        }

        filterBooks();
    });
});

// Обробники для кнопок рівня
lvlButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        lvlButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentLvlFilter = btn.dataset.level;
        filterBooks();
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
