// Инициализация Telegram WebApp
let tg = window.Telegram.WebApp;
tg.expand();
tg.ready();

// Получение данных пользователя
const user = tg.initDataUnsafe?.user;
const userId = user?.id;
const userName = user?.first_name || 'Пользователь';
const userUsername = user?.username ? `@${user.username}` : '';

// Установка темы
document.body.style.backgroundColor = tg.themeParams.bg_color || '#ffffff';
document.body.style.color = tg.themeParams.text_color || '#000000';

// Глобальные переменные
let currentTab = 'photo';
let allContent = [];
let userPurchases = [];

// API endpoints - ЗАМЕНИ НА СВОЙ СЕРВЕР!
const API_BASE = 'https://proliferous-suzann-nonengrossingly.ngrok-free.dev';
// Например: const API_BASE = 'http://123.45.67.89:8080/api';
// Или: const API_BASE = 'https://your-domain.com/api';

// Инициализация
async function init() {
    displayUserInfo();
    await loadContent();
}

// Отображение информации о пользователе
function displayUserInfo() {
    const avatarEl = document.getElementById('userAvatar');
    const profileAvatar = document.getElementById('profileAvatar');
    const profileName = document.getElementById('profileName');
    const profileUsername = document.getElementById('profileUsername');
    
    if (user?.photo_url) {
        avatarEl.style.backgroundImage = `url(${user.photo_url})`;
        avatarEl.textContent = '';
        profileAvatar.style.backgroundImage = `url(${user.photo_url})`;
        profileAvatar.textContent = '';
    } else {
        avatarEl.textContent = userName.charAt(0).toUpperCase();
        profileAvatar.textContent = userName.charAt(0).toUpperCase();
    }
    
    profileName.textContent = userName;
    profileUsername.textContent = userUsername;
}

// Загрузка контента
async function loadContent() {
    const contentGrid = document.getElementById('contentGrid');
    contentGrid.innerHTML = '<div class="loading">Загрузка...</div>';
    
    try {
        const response = await fetch(`${API_BASE}/content?type=${currentTab}&user_id=${userId}`);
        
        if (!response.ok) {
            throw new Error('Network error');
        }
        
        allContent = await response.json();
        
        if (userId) {
            const purchasesResponse = await fetch(`${API_BASE}/purchases?user_id=${userId}`);
            if (purchasesResponse.ok) {
                userPurchases = await purchasesResponse.json();
            }
        }
        
        displayContent();
    } catch (error) {
        console.error('Error loading content:', error);
        contentGrid.innerHTML = '<div class="empty">⚠️ Ошибка загрузки.<br>Проверь подключение к серверу.</div>';
    }
}

// Отображение контента
function displayContent() {
    const contentGrid = document.getElementById('contentGrid');
    const searchValue = document.getElementById('searchInput').value.toLowerCase();
    
    let filtered = allContent.filter(item => {
        const matchType = currentTab === 'photo' 
            ? item.type === 'photo' 
            : (item.type === 'video' || item.type === 'video_note');
        
        const matchSearch = searchValue === '' || item.id.toString().includes(searchValue);
        
        return matchType && matchSearch;
    });
    
    if (filtered.length === 0) {
        contentGrid.innerHTML = '<div class="empty">📭 Контент не найден</div>';
        return;
    }
    
    contentGrid.innerHTML = filtered.map(item => {
        const isPurchased = item.purchased || item.price === 0;
        const icon = item.type === 'photo' ? '📷' : (item.type === 'video_note' ? '⭕' : '🎥');
        const buttonText = isPurchased ? '✓ Посмотреть' : (item.price === 0 ? 'Бесплатно' : `Купить ${item.price} ⭐`);
        const buttonClass = isPurchased ? 'purchased' : '';
        
        return `
            <div class="content-card" onclick="handleContentClick(${item.id}, ${isPurchased})">
                <div class="content-preview">${icon}</div>
                <div class="content-info">
                    <div class="content-type">#${item.id} • ${item.type === 'photo' ? 'Фото' : 'Видео'}</div>
                    <div class="content-price">${item.price === 0 ? 'Бесплатно' : `${item.price} ⭐`}</div>
                    <button class="content-button ${buttonClass}">${buttonText}</button>
                </div>
            </div>
        `;
    }).join('');
}

// Обработка клика на контент
async function handleContentClick(contentId, isPurchased) {
    const item = allContent.find(c => c.id === contentId);
    if (!item) return;
    
    if (isPurchased || item.price === 0) {
        viewContent(item);
    } else {
        await purchaseContent(contentId, item.price);
    }
}

// Просмотр контента
function viewContent(item) {
    const modal = document.getElementById('viewModal');
    const viewContent = document.getElementById('viewContent');
    
    const icon = item.type === 'photo' ? '📷' : (item.type === 'video_note' ? '⭕' : '🎥');
    viewContent.innerHTML = `
        <div style="font-size: 80px; margin: 20px 0;">${icon}</div>
        <h3>Контент #${item.id}</h3>
        <p style="color: var(--tg-theme-hint-color, #999); margin-top: 10px;">
            Тип: ${item.type}<br>
            Цена: ${item.price === 0 ? 'Бесплатно' : `${item.price} ⭐`}
        </p>
        <p style="color: var(--tg-theme-hint-color, #999); margin-top: 15px; font-size: 14px;">
            В реальном приложении здесь будет отображаться медиафайл
        </p>
    `;
    
    modal.style.display = 'block';
}

// Покупка контента
async function purchaseContent(contentId, price) {
    try {
        tg.showAlert(`Инициирую покупку контента #${contentId} за ${price} ⭐...`);
        
        const response = await fetch(`${API_BASE}/create_invoice`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId, content_id: contentId })
        });
        
        const data = await response.json();
        
        if (data.free) {
            tg.showAlert('✅ Бесплатный контент добавлен!');
            await loadContent();
            return;
        }
        
        if (data.invoice_link) {
            tg.openInvoice(data.invoice_link, (status) => {
                if (status === 'paid') {
                    tg.showAlert('✅ Покупка успешна!');
                    loadContent();
                } else if (status === 'cancelled') {
                    tg.showAlert('Покупка отменена');
                } else if (status === 'failed') {
                    tg.showAlert('❌ Ошибка оплаты');
                }
            });
        }
        
    } catch (error) {
        console.error('Purchase error:', error);
        tg.showAlert('❌ Ошибка покупки. Проверь подключение к серверу.');
    }
}

// Переключение вкладок
function switchTab(tab) {
    currentTab = tab;
    
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    event.target.classList.add('active');
    
    loadContent();
}

// Фильтрация контента
function filterContent() {
    displayContent();
}

// Показать профиль
async function showProfile() {
    const modal = document.getElementById('profileModal');
    const purchasesList = document.getElementById('purchasesList');
    
    if (userPurchases.length === 0) {
        purchasesList.innerHTML = '<div class="empty">📭 Покупок пока нет</div>';
    } else {
        purchasesList.innerHTML = userPurchases.map(item => {
            const icon = item.type === 'photo' ? '📷' : (item.type === 'video_note' ? '⭕' : '🎥');
            const itemStr = JSON.stringify(item).replace(/"/g, '&quot;');
            return `<div class="purchase-item" onclick='viewContent(${itemStr})'>${icon}</div>`;
        }).join('');
    }
    
    modal.style.display = 'block';
}

// Закрыть профиль
function closeProfile() {
    document.getElementById('profileModal').style.display = 'none';
}

// Закрыть модальное окно просмотра
function closeViewModal() {
    document.getElementById('viewModal').style.display = 'none';
}

// Закрытие модальных окон по клику вне их
window.onclick = function(event) {
    const profileModal = document.getElementById('profileModal');
    const viewModal = document.getElementById('viewModal');
    
    if (event.target === profileModal) {
        closeProfile();
    }
    if (event.target === viewModal) {
        closeViewModal();
    }
}

// Запуск приложения
init();
