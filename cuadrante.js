document.addEventListener('DOMContentLoaded', function() {
    // =================================================================================
    // Configuración de Firebase
    // =================================================================================
    const firebaseConfig = {
      apiKey: "AIzaSyDOeer8UkOo4JGRAsio1yITrcX2pAc4orY",
      authDomain: "cuadritos-ae665.firebaseapp.com",
      projectId: "cuadritos-ae665",
      storageBucket: "cuadritos-ae665.appspot.com",
      messagingSenderId: "447412668989",
      appId: "1:447412668989:web:cab4b1ae54509801d0b854",
      measurementId: "G-Y9L1YCQN8T"
    };
    // =================================================================================

    // --- INICIALIZACIÓN DE FIREBASE Y LA APP ---
    firebase.initializeApp(firebaseConfig);
    const db = firebase.firestore(); // La base de datos en tiempo real
    const auth = firebase.auth(); // El sistema de usuarios

    const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    const weekDays = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
    const MAX_YEAR = 2030;

    // --- REFERENCIAS A ELEMENTOS DEL DOM ---
    const loginContainer = document.getElementById('login-container');
    const appContainer = document.getElementById('app-container');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const loginBtn = document.getElementById('login-btn');
    const registerBtn = document.getElementById('register-btn');
    const loginError = document.getElementById('login-error');

    const searchInput = document.getElementById('search-input');
    const clearSearchBtn = document.getElementById('clear-search-btn');
    const searchResultsCount = document.getElementById('search-results-count');
    const monthSelect = document.getElementById('month-select');
    const yearSelect = document.getElementById('year-select');
    const calendarTable = document.getElementById('calendar');
    const printBtn = document.getElementById('print-btn');
    const printTitle = document.getElementById('print-title');
    const globalSearchResultsContainer = document.getElementById('global-search-results-container');
    const globalSearchResults = document.getElementById('global-search-results');

    // --- ESTADO DE LA APLICACIÓN ---
    let localUser = null; // El usuario que ha iniciado sesión
    let currentMonth = new Date().getMonth();
    let currentYear = new Date().getFullYear();
    let monthUnsubscribe = null; // Para dejar de escuchar cambios cuando cambiamos de mes

    // --- FUNCIONES DE RENDERIZADO ---
    function renderCalendar(year, month, monthData) {
        printTitle.textContent = `${monthNames[month]} de ${year}`;
        calendarTable.innerHTML = ''; // Limpiar tabla

        // Crear cabecera (días de la semana)
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        weekDays.forEach(day => {
            const th = document.createElement('th');
            th.textContent = day;
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        calendarTable.appendChild(thead);

        // Crear cuerpo del calendario
        const tbody = document.createElement('tbody');
        const firstDayOfMonth = new Date(year, month, 1);
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        let dayCounter = 1;
        let dayOfWeek = firstDayOfMonth.getDay();
        if (dayOfWeek === 0) dayOfWeek = 7; // Convertir Domingo a 7
        const startingBlanks = dayOfWeek - 1;

        let weekRow = document.createElement('tr');

        // Celdas en blanco al inicio del mes
        for (let i = 0; i < startingBlanks; i++) {
            weekRow.appendChild(document.createElement('td')).classList.add('other-month');
        }

        while (dayCounter <= daysInMonth) {
            const currentDate = new Date(year, month, dayCounter);
            const currentDayOfWeek = currentDate.getDay();

            if (currentDayOfWeek !== 0 && currentDayOfWeek !== 6) {
                if (weekRow.children.length === 5) { // Nueva semana si la fila está llena (5 días)
                    tbody.appendChild(weekRow);
                    weekRow = document.createElement('tr');
                }

                const cell = document.createElement('td');
                const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayCounter).padStart(2, '0')}`;
                cell.dataset.date = dateKey;

                const dayData = monthData[dateKey] || { name: '', address: '', phone: '' };
                const editorText = dayData.editor ? `Mod. por: ${dayData.editor}` : '';

                // Marcar el día de hoy
                const today = new Date();
                if (currentDate.toDateString() === today.toDateString()) {
                    cell.classList.add('today');
                }

                // Creación segura de elementos
                const dayNumberDiv = document.createElement('div');
                dayNumberDiv.className = 'day-number';
                dayNumberDiv.textContent = dayCounter;

                const createContentDiv = (field, placeholder, value) => {
                    const div = document.createElement('div');
                    div.className = 'cell-content';
                    div.dataset.field = field;
                    div.dataset.placeholder = placeholder;
                    div.contentEditable = 'true';
                    div.textContent = value;
                    return div;
                };

                const editorInfoDiv = document.createElement('div');
                editorInfoDiv.className = 'editor-info';
                editorInfoDiv.textContent = editorText;

                cell.append(dayNumberDiv,
                            createContentDiv('name', 'Nombre...', dayData.name),
                            createContentDiv('address', 'Dirección...', dayData.address),
                            createContentDiv('phone', 'Teléfono...', dayData.phone),
                            editorInfoDiv);

                weekRow.appendChild(cell);
            }

            if (currentDayOfWeek === 5 || dayCounter === daysInMonth) { // Viernes o fin de mes
                while (weekRow.children.length > 0 && weekRow.children.length < 5) { // Rellenar hasta 5 días
                    weekRow.appendChild(document.createElement('td')).classList.add('other-month');
                }
                tbody.appendChild(weekRow);
                weekRow = document.createElement('tr');
            }
            dayCounter++;
        }

        calendarTable.appendChild(tbody);
        // La búsqueda se aplicará si es necesario desde el listener
    }

    function highlightCurrentMonth() {
        const searchTerm = searchInput.value.toLowerCase().trim();
        if (!searchTerm) return; // No hacer nada si no hay búsqueda

        const cells = calendarTable.querySelectorAll('td[data-date]');
        let count = 0;

        cells.forEach(cell => {
            cell.classList.remove('highlight');
            if (searchTerm) {
                const cellText = cell.innerText.toLowerCase();
                if (cellText.includes(searchTerm)) {
                    cell.classList.add('highlight');
                    count++;
                }
            }
        });

        searchResultsCount.textContent = `${count} resultado(s) en este mes`;
    }

    function handleSearch() {
        const searchTerm = searchInput.value.toLowerCase().trim();
        
        globalSearchResults.innerHTML = '';
        globalSearchResultsContainer.style.display = 'none';
        searchResultsCount.textContent = '';
        document.querySelectorAll('#calendar td.highlight').forEach(cell => cell.classList.remove('highlight'));

        if (searchTerm) {
            clearSearchBtn.style.display = 'inline';
            
            // La búsqueda local se hace visualmente, no necesitamos hacer más aquí.

            const globalResultsData = [];
            db.collection("calendarData").get().then(querySnapshot => {
                querySnapshot.forEach(doc => {
                    const monthId = doc.id; // ej: "2024-6"
                    const [year, month] = monthId.split('-').map(Number);

                    if (year === currentYear && month === currentMonth + 1) {
                        return; // En un forEach, 'return' actúa como 'continue' para saltar a la siguiente iteración
                    }

                    const monthData = doc.data();

                    for (const dateKey in monthData) {
                        const dayData = monthData[dateKey];
                        const fullText = `${dayData.name || ''} ${dayData.address || ''} ${dayData.phone || ''}`.toLowerCase();
                        if (fullText.includes(searchTerm)) {
                            globalResultsData.push({
                                dateKey: dateKey,
                                content: (dayData.name || dayData.address || dayData.phone).substring(0, 40) + '...'
                            });
                        }
                    }
                });

                if (globalResultsData.length > 0) {
                    globalSearchResultsContainer.style.display = 'block';
                    globalResultsData.forEach(result => {
                        const li = document.createElement('li');
                        li.innerHTML = `<span class="date">${result.dateKey}:</span> <span class="content">${result.content}</span>`;
                        li.onclick = () => navigateToDate(result.dateKey);
                        globalSearchResults.appendChild(li);
                    });
                }
            });

        } else {
            clearSearchBtn.style.display = 'none';
        }
    }

    function navigateToDate(dateKey) {
        const [year, month, day] = dateKey.split('-').map(Number);

        currentYear = year;
        currentMonth = month - 1;
        yearSelect.value = currentYear;
        monthSelect.value = currentMonth;

        listenToMonthData(currentYear, currentMonth);

        setTimeout(() => {
            const targetCell = document.querySelector(`td[data-date="${dateKey}"]`);
            if (targetCell) {
                targetCell.classList.add('highlight-target');
                targetCell.scrollIntoView({ behavior: 'smooth', block: 'center' });
                setTimeout(() => targetCell.classList.remove('highlight-target'), 2000);
            }
        }, 100);
    }

    // --- LÓGICA DE FIREBASE ---
    function listenToMonthData(year, month) {
        // Dejar de escuchar el mes anterior para no gastar recursos
        if (monthUnsubscribe) {
            monthUnsubscribe();
        }

        const monthId = `${year}-${month + 1}`;
        const docRef = db.collection("calendarData").doc(monthId);

        monthUnsubscribe = docRef.onSnapshot(doc => {
            console.log("Datos recibidos de Firebase!");
            const monthData = doc.exists ? doc.data() : {};
            renderCalendar(year, month, monthData);
            highlightCurrentMonth();
        });
    }

    // --- INICIALIZACIÓN Y MANEJADORES DE EVENTOS ---

    // --- LÓGICA DE AUTENTICACIÓN ---
    auth.onAuthStateChanged(user => {
        if (user) {
            // El usuario ha iniciado sesión
            localUser = user;
            loginContainer.style.display = 'none';
            appContainer.style.display = 'block';
            initApp(); // Iniciar la aplicación principal
        } else {
            // El usuario no ha iniciado sesión
            localUser = null;
            loginContainer.style.display = 'flex';
            appContainer.style.display = 'none';
        }
    });

    loginBtn.addEventListener('click', () => {
        const email = emailInput.value;
        const password = passwordInput.value;
        auth.signInWithEmailAndPassword(email, password)
            .catch(error => {
                loginError.textContent = error.message;
            });
    });

    registerBtn.addEventListener('click', () => {
        const email = emailInput.value;
        const password = passwordInput.value;
        auth.createUserWithEmailAndPassword(email, password)
            .catch(error => {
                loginError.textContent = error.message;
            });
    });

    // Función que se ejecuta una vez que el usuario ha iniciado sesión
    function initApp() {
        // Llenar años y establecer valores iniciales
        const startYear = new Date().getFullYear() - 5;
        for (let y = startYear; y <= MAX_YEAR; y++) {
            const option = document.createElement('option');
            option.value = y;
            option.textContent = y;
            yearSelect.appendChild(option);
        }
        monthSelect.value = currentMonth;
        yearSelect.value = currentYear;

        // Empezar a escuchar los datos del mes actual
        listenToMonthData(currentYear, currentMonth);

        // --- EVENTOS DE LA APP ---
        monthSelect.addEventListener('change', (e) => {
            currentMonth = parseInt(e.target.value, 10);
            listenToMonthData(currentYear, currentMonth);
        });

        yearSelect.addEventListener('change', (e) => {
            currentYear = parseInt(e.target.value, 10);
            listenToMonthData(currentYear, currentMonth);
        });

        printBtn.addEventListener('click', () => window.print());
        searchInput.addEventListener('input', handleSearch);
        clearSearchBtn.addEventListener('click', () => {
            searchInput.value = '';
            handleSearch();
        });

        // Guardar datos en Firebase al editar
        calendarTable.addEventListener('blur', (event) => {
            const target = event.target;
            if (target.classList.contains('cell-content')) {
                const cell = target.closest('td');
                if (!cell) return;

                const dateKey = cell.dataset.date;
                const field = target.dataset.field;
                if (!dateKey || !field) return;

                const monthId = `${currentYear}-${currentMonth + 1}`;
                const docRef = db.collection("calendarData").doc(monthId);

                // Usamos la notación de punto para actualizar un campo específico dentro de un mapa
                const updateData = {};
                updateData[`${dateKey}.${field}`] = target.textContent;
                updateData[`${dateKey}.editor`] = localUser.email;

                // set con merge:true crea el documento si no existe o actualiza los campos si existe
                docRef.set(updateData, { merge: true })
                    .catch(error => console.error("Error al guardar datos:", error));
            }
        }, true);
    }

    // Registrar el Service Worker para la PWA
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('service-worker.js')
                .then(registration => console.log('Service Worker registrado con éxito:', registration.scope))
                .catch(err => console.log('Fallo en el registro del Service Worker:', err));
        });
    }
});
