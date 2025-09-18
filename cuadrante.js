document.addEventListener('DOMContentLoaded', function() {
    // --- CONFIGURACIÓN INICIAL ---
    const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    const weekDays = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
    const MAX_YEAR = 2030;

    // --- REFERENCIAS A ELEMENTOS DEL DOM ---
    const userSelect = document.getElementById('user-select');
    const manageUsersBtn = document.getElementById('manage-users-btn');
    const searchInput = document.getElementById('search-input');
    const clearSearchBtn = document.getElementById('clear-search-btn');
    const searchResultsCount = document.getElementById('search-results-count');
    const monthSelect = document.getElementById('month-select');
    const yearSelect = document.getElementById('year-select');
    const calendarTable = document.getElementById('calendar');
    const printBtn = document.getElementById('print-btn');
    const printTitle = document.getElementById('print-title');
    // Modal de usuarios
    const globalSearchResultsContainer = document.getElementById('global-search-results-container');
    const globalSearchResults = document.getElementById('global-search-results');
    const userModal = document.getElementById('user-modal');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const userList = document.getElementById('user-list');
    const addUserBtn = document.getElementById('add-user-btn');
    const newUserNameInput = document.getElementById('new-user-name');

    // --- ESTADO DE LA APLICACIÓN ---
    let users = [];
    let currentUser = '';
    let currentMonth = new Date().getMonth();
    let currentYear = new Date().getFullYear();
    let monthData = {}; // Guardar los datos del mes en memoria para eficiencia
    let db; // Referencia a la base de datos IndexedDB

    // --- FUNCIONES DE DATOS ---

    function initDB() {
        const request = indexedDB.open('calendarFileStorage', 1);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('files')) {
                db.createObjectStore('files', { keyPath: 'id' });
            }
        };

        request.onsuccess = (event) => {
            db = event.target.result;
        };

        request.onerror = (event) => {
            console.error("Error al inicializar IndexedDB:", event.target.errorCode);
        };
    }

    function storeFile(file) {
        return new Promise((resolve, reject) => {
            if (!db) return reject("DB not initialized");
            const transaction = db.transaction(['files'], 'readwrite');
            const store = transaction.objectStore('files');
            const request = store.put(file);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    function getFile(id) {
        return new Promise((resolve, reject) => {
            if (!db) return reject("DB not initialized");
            const transaction = db.transaction(['files'], 'readonly');
            const store = transaction.objectStore('files');
            const request = store.get(id);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    function deleteFileFromDB(id) {
        return new Promise((resolve, reject) => {
            if (!db) return reject("DB not initialized");
            const transaction = db.transaction(['files'], 'readwrite');
            const store = transaction.objectStore('files');
            const request = store.delete(id);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    function loadUsers() {
        const storedUsers = localStorage.getItem('calendarUsers');
        users = storedUsers ? JSON.parse(storedUsers) : ['Usuario 1', 'Usuario 2', 'Usuario 3'];
        if (!storedUsers) saveUsers(); // Guardar los default si no existen
    }

    function saveUsers() {
        localStorage.setItem('calendarUsers', JSON.stringify(users));
    }

    function getStorageKey(year, month) {
        return `calendarData-${year}-${month}`;
    }

    function loadData(year, month) {
        const key = getStorageKey(year, month);
        const data = localStorage.getItem(key);
        // Actualizamos la variable en memoria
        return data ? JSON.parse(data) : {};
    }

    function saveData(year, month, data) {
        const key = getStorageKey(year, month);
        localStorage.setItem(key, JSON.stringify(data));
    }

    // --- FUNCIONES DE RENDERIZADO ---

    function populateUserSelect() {
        userSelect.innerHTML = '';
        users.forEach(user => {
            const option = document.createElement('option');
            option.value = user;
            option.textContent = user;
            userSelect.appendChild(option);
        });

        // Asegurarse de que el currentUser sigue siendo válido
        if (!users.includes(currentUser)) {
            currentUser = users[0] || '';
        }
        userSelect.value = currentUser;
    }

    function renderUserList() {
        userList.innerHTML = '';
        users.forEach((user, index) => {
            const li = document.createElement('li');
            
            const nameInput = document.createElement('input');
            nameInput.type = 'text';
            nameInput.value = user;
            nameInput.dataset.index = index;
            nameInput.addEventListener('change', (e) => {
                const oldName = users[index];
                const newName = e.target.value.trim();
                if (newName && !users.includes(newName)) {
                    users[index] = newName;
                    // Opcional: Actualizar datos guardados si se quiere renombrar el editor
                } else {
                    e.target.value = oldName; // Revertir si está vacío o duplicado
                }
            });

            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = 'X';
            deleteBtn.className = 'delete-user-btn';
            deleteBtn.title = 'Eliminar usuario';
            deleteBtn.addEventListener('click', () => {
                if (users.length > 1) {
                    users.splice(index, 1);
                    renderUserList(); // Re-renderizar la lista en el modal
                } else {
                    alert('No se puede eliminar el último usuario.');
                }
            });

            li.append(nameInput, deleteBtn);
            userList.appendChild(li);
        });
    }

    async function renderCalendar(year, month) {
        printTitle.textContent = `${monthNames[month]} de ${year}`;

        calendarTable.innerHTML = ''; // Limpiar tabla
        monthData = loadData(year, month); // Cargar datos del mes actual en la variable

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

                const dayData = monthData[dateKey] || { name: '', address: '', phone: '', files: [] };
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

                // --- Lógica de archivos ---
                const fileList = document.createElement('ul');
                fileList.className = 'file-list';
                (dayData.files || []).forEach(fileData => {
                    const fileItem = document.createElement('li');
                    const fileLink = document.createElement('a');
                    fileLink.className = 'file-link';
                    fileLink.textContent = fileData.name;
                    fileLink.title = fileData.name;
                    fileLink.onclick = () => {
                        getFile(fileData.id).then(fileRecord => {
                            if (fileRecord && fileRecord.blob) {
                                const url = URL.createObjectURL(fileRecord.blob);
                                window.open(url, '_blank');
                            }
                        }).catch(err => console.error("Error al obtener archivo:", err));
                    };

                    const deleteFileBtn = document.createElement('button');
                    deleteFileBtn.className = 'delete-file-btn';
                    deleteFileBtn.innerHTML = '&times;';
                    deleteFileBtn.title = 'Eliminar archivo';
                    deleteFileBtn.onclick = () => {
                        if (confirm(`¿Seguro que quieres eliminar el archivo "${fileData.name}"?`)) {
                            deleteFileFromDB(fileData.id).then(() => {
                                monthData[dateKey].files = monthData[dateKey].files.filter(f => f.id !== fileData.id);
                                saveData(year, month, monthData);
                                renderCalendar(year, month); // Re-render para actualizar la vista
                            }).catch(err => console.error("Error al eliminar archivo:", err));
                        }
                    };

                    fileItem.append(fileLink, deleteFileBtn);
                    fileList.appendChild(fileItem);
                });

                const addFileBtn = document.createElement('button');
                addFileBtn.className = 'add-file-btn';
                addFileBtn.textContent = 'Adjuntar archivo';

                const fileInput = document.createElement('input');
                fileInput.type = 'file';
                fileInput.accept = '.jpg, .jpeg, .png, .pdf, .doc, .docx, .xls, .xlsx, .ppt, .pptx';
                fileInput.style.display = 'none';

                addFileBtn.onclick = () => fileInput.click();

                fileInput.onchange = (e) => {
                    const file = e.target.files[0];
                    if (!file) return;

                    const fileId = `${dateKey}-${Date.now()}`;
                    const fileDataForDB = { id: fileId, blob: file };
                    
                    storeFile(fileDataForDB).then(() => {
                        const fileInfoForLS = { id: fileId, name: file.name, type: file.type };
                        if (!monthData[dateKey]) {
                            monthData[dateKey] = { name: '', address: '', phone: '', editor: '', files: [] };
                        }
                        if (!monthData[dateKey].files) {
                            monthData[dateKey].files = [];
                        }
                        monthData[dateKey].files.push(fileInfoForLS);
                        saveData(year, month, monthData);
                        renderCalendar(year, month); // Re-render para mostrar el archivo
                    }).catch(err => console.error("Error al guardar archivo:", err));
                };

                cell.append(dayNumberDiv,
                            createContentDiv('name', 'Nombre...', dayData.name),
                            createContentDiv('address', 'Dirección...', dayData.address),
                            createContentDiv('phone', 'Teléfono...', dayData.phone),
                            fileList,
                            addFileBtn,
                            fileInput,
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
        highlightCurrentMonth();
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
            
            highlightCurrentMonth();

            const globalResultsData = [];
            const dataKeyRegex = /^calendarData-(\d{4})-(\d{1,2})$/;

            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                const match = key.match(dataKeyRegex);

                if (match) {
                    const year = parseInt(match[1], 10);
                    const month = parseInt(match[2], 10);

                    if (year === currentYear && month === currentMonth) {
                        continue;
                    }

                    const monthData = JSON.parse(localStorage.getItem(key));

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
                }
            }

            if (globalResultsData.length > 0) {
                globalSearchResultsContainer.style.display = 'block';
                globalResultsData.forEach(result => {
                    const li = document.createElement('li');
                    li.innerHTML = `<span class="date">${result.dateKey}:</span> <span class="content">${result.content}</span>`;
                    li.onclick = () => navigateToDate(result.dateKey);
                    globalSearchResults.appendChild(li);
                });
            }

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

        renderCalendar(currentYear, currentMonth);

        setTimeout(() => {
            const targetCell = document.querySelector(`td[data-date="${dateKey}"]`);
            if (targetCell) {
                targetCell.classList.add('highlight-target');
                targetCell.scrollIntoView({ behavior: 'smooth', block: 'center' });
                setTimeout(() => targetCell.classList.remove('highlight-target'), 2000);
            }
        }, 100);
    }


    // --- INICIALIZACIÓN Y MANEJADORES DE EVENTOS ---

    function init() {
        initDB();
        loadUsers();
        currentUser = users[0] || '';
        populateUserSelect();

        const startYear = new Date().getFullYear();
        for (let y = startYear; y <= MAX_YEAR; y++) {
            const option = document.createElement('option');
            option.value = y;
            option.textContent = y;
            yearSelect.appendChild(option);
        }

        userSelect.value = currentUser;
        monthSelect.value = currentMonth;
        yearSelect.value = currentYear;

        userSelect.addEventListener('change', (e) => {
            currentUser = e.target.value;
        });

        monthSelect.addEventListener('change', (e) => {
            currentMonth = parseInt(e.target.value, 10);
            renderCalendar(currentYear, currentMonth);
        });

        yearSelect.addEventListener('change', (e) => {
            currentYear = parseInt(e.target.value, 10);
            renderCalendar(currentYear, currentMonth);
        });

        printBtn.addEventListener('click', () => {
            window.print();
        });

        searchInput.addEventListener('input', handleSearch);

        clearSearchBtn.addEventListener('click', () => {
            searchInput.value = '';
            handleSearch();
        });


        // --- Eventos del Modal de Usuarios ---
        manageUsersBtn.addEventListener('click', () => {
            renderUserList();
            userModal.style.display = 'flex';
        });

        closeModalBtn.addEventListener('click', () => {
            saveUsers();
            populateUserSelect();
            userModal.style.display = 'none';
        });

        addUserBtn.addEventListener('click', () => {
            const newName = newUserNameInput.value.trim();
            if (newName && !users.includes(newName)) {
                users.push(newName);
                renderUserList();
                newUserNameInput.value = '';
                newUserNameInput.focus();
            } else if (users.includes(newName)) {
                alert('El nombre de usuario ya existe.');
            }
        });

        // Event delegation para guardar datos al salir de un campo
        calendarTable.addEventListener('blur', (event) => {
            const target = event.target;
            if (target.classList.contains('cell-content')) {
                const cell = target.closest('td');
                if (!cell) return;

                const dateKey = cell.dataset.date;
                const field = target.dataset.field;

                if (!dateKey || !field) return;

                if (!monthData[dateKey]) {
                    monthData[dateKey] = { name: '', address: '', phone: '', editor: '', files: [] };
                }

                monthData[dateKey][field] = target.textContent;
                monthData[dateKey].editor = currentUser;

                saveData(currentYear, currentMonth, monthData);
            }
        }, true);

        // Renderizar el calendario inicial
        renderCalendar(currentYear, currentMonth);

        // Registrar el Service Worker para la PWA
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('service-worker.js')
                    .then(registration => console.log('Service Worker registrado con éxito:', registration.scope))
                    .catch(err => console.log('Fallo en el registro del Service Worker:', err));
            });
        }
    }

    // Iniciar la aplicación
    init();
});
