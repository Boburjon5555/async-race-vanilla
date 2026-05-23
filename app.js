const BASE_URL = 'http://localhost:3000';

const state = {
  currentPage: 1,
  cars: [],
  totalCount: 0,
  activeAnimations: {},
  isRacing: false,      // Poyga ketyaptimi yoki yo'q
  raceWinner: null      // Joriy poyga g'olibi
};

//  API dan mashinalarni olish
async function fetchCars(page) {
  const res = await fetch(`${BASE_URL}/garage?_page=${page}&_limit=7`);
  state.cars = await res.json();
  state.totalCount = Number(res.headers.get('X-Total-Count') || '0');
  renderGarage();
}

//  Mashinalarni ekranga chiqarish
function renderGarage() {
  document.getElementById('car-count').innerText = state.totalCount;
  document.getElementById('page-num').innerText = `Page ${state.currentPage}`;
  
  const container = document.getElementById('cars-container');
  container.innerHTML = '';

  state.cars.forEach(car => {
    const track = document.createElement('div');
    track.className = 'car-track';
    track.innerHTML = `
      <div class="track-controls">
        <button onclick="deleteCar(${car.id})">Remove</button>
        <span><strong>${car.name}</strong></span>
      </div>
      <div class="race-line">
        <div class="engine-buttons">
          <button id="start-${car.id}" onclick="startCarHandler(${car.id})">A</button>
          <button id="stop-${car.id}" onclick="stopCarHandler(${car.id})" disabled>B</button>
        </div>
        <div class="road">
          <div id="car-img-${car.id}" class="car-sprite" style="fill: ${car.color}; left: 0px;">
            <svg width="40" height="20" viewBox="0 0 100 50">
              <path d="M15 30h70v10H15zm10-15l10-10h30l10 10h10v15H15V15z"/>
            </svg>
          </div>
          <div class="flag">🏁</div>
        </div>
      </div>
    `;
    container.appendChild(track);
  });
}

// Alohida "A" tugmasi bosilganda ishlaydigan yordamchi funksiya
async function startCarHandler(id) {
  await startCar(id);
}

// Alohida "B" tugmasi bosilganda
async function stopCarHandler(id) {
  await stopCar(id);
}

//  ASOSIY START FUNKSIYASI (Vaqt va va'da qaytaradi)
function startCar(id) {
  return new Promise(async (resolve) => {
    document.getElementById(`start-${id}`).disabled = true;
    document.getElementById(`stop-${id}`).disabled = false;

    //  Engine Started
    const startRes = await fetch(`${BASE_URL}/engine?id=${id}&status=started`, { method: 'PATCH' });
    const { velocity, distance } = await startRes.json();
    const duration = distance / velocity; // millisekundda

    const carElem = document.getElementById(`car-img-${id}`);
    const roadWidth = carElem.parentElement.clientWidth - 70; // Bayroqqacha masofa
    const startTime = performance.now();
    let broken = false;

    // Animatsiya qadami
    function step(currentTime) {
      if (broken) return;

      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      carElem.style.left = `${progress * roadWidth}px`;

      if (progress < 1) {
        state.activeAnimations[id] = requestAnimationFrame(step);
      } else {
        // Mashina marraga buzilmay yetib keldi!
        const timeInSeconds = (duration / 1000).toFixed(2);
        resolve({ id, time: timeInSeconds, success: true });
      }
    }

    state.activeAnimations[id] = requestAnimationFrame(step);

    //  Engine Drive (Orqa fonda tekshiriladi)
    const driveRes = await fetch(`${BASE_URL}/engine?id=${id}&status=drive`, { method: 'PATCH' });
    
    if (driveRes.status === 500) {
      broken = true;
      cancelAnimationFrame(state.activeAnimations[id]);
      alert(` ${id}-mashina motori Buzildi!`);
      resolve({ id, success: false }); // G'oliblikka loyiq emas
    }
  });
}

//  ASOSIY STOP FUNKSIYASI
async function stopCar(id) {
  cancelAnimationFrame(state.activeAnimations[id]);
  await fetch(`${BASE_URL}/engine?id=${id}&status=stopped`, { method: 'PATCH' });
  
  const carElem = document.getElementById(`car-img-${id}`);
  if (carElem) carElem.style.left = '0px';

  if(document.getElementById(`start-${id}`)) document.getElementById(`start-${id}`).disabled = false;
  if(document.getElementById(`stop-${id}`)) document.getElementById(`stop-${id}`).disabled = true;
}

//  OMMAVIY POYGA (RACE BUTTON)
document.getElementById('race-btn').addEventListener('click', async () => {
  state.isRacing = true;
  state.raceWinner = null;
  document.getElementById('race-btn').disabled = true;
  document.getElementById('reset-btn').disabled = false;
  hideWinner();

  // Sahifadagi barcha mashinalar poygasini parallel boshlaymiz
  const promises = state.cars.map(async (car) => {
    const result = await startCar(car.id);
    
    // Agar kimdir birinchi yetib kelsa va poygada hali g'olib chiqmagan bo'lsa
    if (result.success && !state.raceWinner && state.isRacing) {
      state.raceWinner = car;
      showWinner(car.name, result.time);
      
    }
    return result;
  });

  await Promise.all(promises);
});

//  HAMMASINI ORTGA QAYTARISH (RESET BUTTON)
document.getElementById('reset-btn').addEventListener('click', async () => {
  state.isRacing = false;
  document.getElementById('reset-btn').disabled = true;
  hideWinner();

  const promises = state.cars.map(car => stopCar(car.id));
  await Promise.all(promises);

  document.getElementById('race-btn').disabled = false;
});

// G'olibni ekranda ko'rsatish funksiyalari
function showWinner(name, time) {
  const box = document.getElementById('winner-message');
  box.innerText = `🏆 G'OLIB: ${name} (${time} soniyada marraga yetdi!)`;
  box.style.display = 'block';
}

function hideWinner() {
  document.getElementById('winner-message').style.style = 'none';
  document.getElementById('winner-message').innerText = '';
}

// Mashina o'chirish
async function deleteCar(id) {
  await fetch(`${BASE_URL}/garage/${id}`, { method: 'DELETE' });
  fetchCars(state.currentPage);
}

// Navigatsiya
document.getElementById('to-garage-btn').addEventListener('click', () => {
  document.getElementById('garage-view').style.display = 'block';
  document.getElementById('winners-view').style.display = 'none';
});

document.getElementById('to-winners-btn').addEventListener('click', () => {
  document.getElementById('garage-view').style.display = 'none';
  document.getElementById('winners-view').style.display = 'block';
});
 

// Tasodifiy ma'lumotlar massivi
const CAR_BRANDS = ['Tesla', 'BMW', 'Mercedes', 'Audi', 'Toyota', 'Chevrolet', 'Ford', 'Hyundai', 'Porsche', 'Ferrari'];
const CAR_MODELS = ['Model S', 'X5', 'S-Class', 'A6', 'Camry', 'Malibu', 'Mustang', 'Elantra', '911', 'Roma'];

//  Tasodifiy rang yaratish funksiyasi
function getRandomColor() {
  const letters = '0123456789ABCDEF';
  let color = '#';
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
}

//  Tasodifiy nom yaratish funksiyasi
function getRandomName() {
  const brand = CAR_BRANDS[Math.floor(Math.random() * CAR_BRANDS.length)];
  const model = CAR_MODELS[Math.floor(Math.random() * CAR_MODELS.length)];
  return `${brand} ${model}`;
}

//  100 ta mashina generatsiya qilish asosiy funksiyasi
async function generate100Cars() {
  const generateBtn = document.getElementById('generate-btn');
  generateBtn.disabled = true;
  generateBtn.innerText = '⏳ Generating...';

  const promises = [];

  for (let i = 0; i < 100; i++) {
    const carData = {
      name: getRandomName(),
      color: getRandomColor()
    };

    // Serverga saqlash so'rovini ro'yxatga qo'shamiz (Parallel yuklanishi uchun)
    const p = fetch(`${BASE_URL}/garage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(carData)
    });
    promises.push(p);
  }

  // 100 ta so'rov serverga parallel ketadi va hammasi tugashini kutamiz
  await Promise.all(promises);

  // Tugmani asliga qaytaramiz va joriy sahifani yangilaymiz
  generateBtn.disabled = false;
  generateBtn.innerText = '⚡ Generate 100 Cars';
  
  // Garajdagi mashinalar soni o'zgargani uchun qayta yuklaymiz
  fetchCars(state.currentPage);
}

// 4. Tugmaga hodisani bog'lash (Event Listener)
document.getElementById('generate-btn').addEventListener('click', generate100Cars);

async function createCar() {
    const nameInput = document.getElementById('create-name');
    const colorInput = document.getElementById('create-color');
    
    const name = nameInput.value.trim();
    const color = colorInput.value;
  
    if (!name) {
      alert('Iltimos, mashina nomini kiriting!');
      return;
    }
  
    await fetch(`${BASE_URL}/garage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, color })
    });
  
    // Inputni tozalaymiz
    nameInput.value = '';
    
    // Garajni yangilaymiz
    fetchCars(state.currentPage);
  }
  
  document.getElementById('create-btn').addEventListener('click', createCar);

  document.getElementById('prev-page-btn').addEventListener('click', () => {
    if (state.currentPage > 1) {
      state.currentPage--;
      fetchCars(state.currentPage);
    }
  });
  
  document.getElementById('next-page-btn').addEventListener('click', () => {
    const maxPages = Math.ceil(state.totalCount / 7);
    if (state.currentPage < maxPages) {
      state.currentPage++;
      fetchCars(state.currentPage);
    }
  });

// Ilk yuklanish
fetchCars(state.currentPage);