// =================================================================================
// INITIALIZATION
// =================================================================================
document.addEventListener('DOMContentLoaded', () => {
    firebase.initializeApp(CONFIG.firebase);
    
    const userPanel = document.getElementById('user-panel');
    const userNameInput = document.getElementById('user-name-input');
    const setUserBtn = document.getElementById('set-user-btn');
    const appBody = document.getElementById('app-body');
    const userDisplay = document.getElementById('user-display');
    
    window.currentUser = '';

    function setUser(name) {
        window.currentUser = name.trim();
        localStorage.setItem('salesRouteUser', window.currentUser);
        userDisplay.innerHTML = `User: <strong>${window.currentUser}</strong> (<span id="change-user-btn">change</span>)`;
        userDisplay.querySelector('#change-user-btn').addEventListener('click', () => {
            localStorage.removeItem('salesRouteUser');
            location.reload();
        });
        userPanel.classList.add('hidden');
        appBody.classList.remove('hidden');
        loadGoogleMapsScript();
    }

    function checkForUser() {
        const savedUser = localStorage.getItem('salesRouteUser');
        if (savedUser) setUser(savedUser);
        else userPanel.classList.remove('hidden');
    }

    setUserBtn.addEventListener('click', () => {
        if (userNameInput.value.trim()) setUser(userNameInput.value);
    });

    checkForUser();
});

function loadGoogleMapsScript() {
    if (document.getElementById('google-maps-script')) return;
    const script = document.createElement('script');
    script.id = 'google-maps-script';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${CONFIG.API_KEY}&libraries=places,directions,geocoding&callback=initGooglePlacesApi`;
    script.defer = true;
    document.head.appendChild(script);
}

// =================================================================================
// HELPERS
// =================================================================================
function getTempColor(percentage) { return `hsl(${(percentage / 100) * 120}, 90%, 45%)`; }
function getAddressComponent(components, type, useShortName = false) {
    if (!components) return '';
    const component = components.find(c => c.types.includes(type));
    return useShortName ? component?.shortText : (component?.longText || '');
}

// =================================================================================
// MAIN APP INITIALIZATION (Callback from Google Maps)
// =================================================================================
window.initGooglePlacesApi = function() {
    // --- SERVICES ---
    const autocompleteService = new google.maps.places.AutocompleteService();
    const directionsService = new google.maps.DirectionsService();
    const geocoder = new google.maps.Geocoder();
    const db = firebase.database();

    // --- DOM ELEMENTS ---
    const showAddPanelBtn = document.getElementById('show-add-panel-btn');
    const entryPanel = document.getElementById('entry-panel');
    const panelTitle = document.getElementById('panel-title');
    const daySelect = document.getElementById('day-select');
    const searchInput = document.getElementById('customer-search');
    const tempInput = document.getElementById('temperature-input');
    const mainActionBtn = document.getElementById('main-action-btn');
    const deleteBtn = document.getElementById('delete-btn');
    const notesSection = document.getElementById('notes-section');
    const notesThread = document.getElementById('notes-thread');
    const noteInput = document.getElementById('note-input');
    const addNoteBtn = document.getElementById('add-note-btn');
    const dayStartToggles = document.querySelectorAll('.day-start-btn');
    const dropzones = document.querySelectorAll('.dropzone');
    const toggleSectorBtn = document.getElementById('toggle-sector-btn');
    const sectorCalculator = document.getElementById('sector-calculator');
    const sectorInputs = document.querySelectorAll('.sector-input');
    const enableWeightingCheckbox = document.getElementById('enable-weighting');
    const weightingInputsContainer = document.getElementById('weighting-inputs');
    const weightInputs = Array.from(document.querySelectorAll('.weight-input'));
    const showOptimizerBtn = document.getElementById('show-optimizer-btn');
    const optimizerPanel = document.getElementById('optimizer-panel');
    const cancelEntryPanelBtn = document.getElementById('cancel-entry-panel');
    const cancelOptimizerPanelBtn = document.getElementById('cancel-optimizer-panel');
    const optimizerStartLocation = document.getElementById('optimizer-start-location');
    const optimizerStartTime = document.getElementById('optimizer-start-time');
    const optimizerInterval = document.getElementById('optimizer-interval');
    const optimizerSearch = document.getElementById('optimizer-search');
    const optimizerStopsList = document.getElementById('optimizer-stops-list');
    const runOptimizationBtn = document.getElementById('run-optimization-btn');
    const optimizerResults = document.getElementById('optimizer-results');
    const optimizerResultsList = document.getElementById('optimizer-results-list');
    const optimizerBackBtn = document.getElementById('optimizer-back-btn');
    const optimizerDaySelect = document.getElementById('optimizer-day-select');

    // --- STATE ---
    let currentMode = 'hidden';
    let activeEntryKey = null;
    let selectedPlaceDetails = null;
    let scheduleData = { schedule: {}, startLocations: {} };
    let draggedItem = null;
    let sectorMode = false;
    let searchBiasCenter = null;
    let optimizerStops = [];
    
    // --- GEOCODING & INIT ---
    geocoder.geocode({ address: CONFIG.STARTING_LOCATIONS.shop }, (results, status) => {
        if (status === 'OK') searchBiasCenter = results[0].geometry.location;
    });

    db.ref().on('value', (snapshot) => {
        const data = snapshot.val() || {};
        scheduleData = { schedule: data.schedule || {}, startLocations: data.startLocations || {} };
        renderFullSchedule();
    });

    // --- RENDER FUNCTIONS ---
    async function getTravelTime(origin, destination) {
        return new Promise(resolve => {
            if (!origin || !destination) return resolve('N/A');
            directionsService.route({ origin, destination, travelMode: 'DRIVING' }, (response, status) => {
                if (status === 'OK') resolve(response.routes[0].legs[0].duration.text);
                else resolve('N/A');
            });
        });
    }

    function renderConnector(time, startLabel = null) {
        const connector = document.createElement('div');
        connector.className = 'entry-connector';
        let label = '';
        if (startLabel) {
            label = ` from ${startLabel.charAt(0).toUpperCase() + startLabel.slice(1)}`;
        }
        connector.innerHTML = `<div class="connector-line"></div><div class="connector-time">${time}${label}</div>`;
        return connector;
    }

    function renderCalendarEntry(key, data) {
        const entryDiv = document.createElement('div');
        entryDiv.className = 'entry';
        entryDiv.draggable = true;
        entryDiv.dataset.key = key;
        Object.keys(data).forEach(k => {
             if (typeof data[k] === 'object') entryDiv.dataset[k] = JSON.stringify(data[k]);
             else entryDiv.dataset[k] = data[k];
        });
        entryDiv.innerHTML = `<div class="temp-dot" style="background-color: ${getTempColor(data.temp)};"></div><div class="name">${data.name} (${data.temp}%)</div><div class="location">${data.address}</div>`;
        entryDiv.addEventListener('click', () => editEntry(entryDiv));
        return entryDiv;
    }

    async function renderFullSchedule() {
        for (const day of ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']) {
            const dayContainer = document.querySelector(`#cal-${day} .content`);
            dayContainer.innerHTML = '';
            const startLocation = scheduleData.startLocations[day] || 'shop';
            document.querySelectorAll(`.day-start-btn[data-day="${day}"]`).forEach(btn => btn.classList.toggle('active', btn.dataset.location === startLocation));
            const dayStops = scheduleData.schedule[day] ? Object.entries(scheduleData.schedule[day]).sort(([, a], [, b]) => a.order - b.order) : [];
            let previousStopAddress = CONFIG.STARTING_LOCATIONS[startLocation];
            for (const [key, stopData] of dayStops) {
                const travelTime = await getTravelTime(previousStopAddress, stopData.formattedAddress);
                dayContainer.appendChild(renderConnector(travelTime, dayStops[0][0] === key ? startLocation : null));
                dayContainer.appendChild(renderCalendarEntry(key, stopData));
                previousStopAddress = stopData.formattedAddress;
            }
        }
    }

    function renderNotes(notesObject = {}) {
        notesThread.innerHTML = !notesObject ? '' : Object.values(notesObject).sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp)).map(note => `
            <div class="note">
                <div class="note-meta">${new Date(note.timestamp).toLocaleString()} by <strong>${note.user}</strong></div>
                <div class="note-text">${note.text}</div>
            </div>
        `).join('');
    }

    // --- UI & LOGIC ---
    function setPanelMode(mode, data = {}) {
        currentMode = mode;
        optimizerPanel.classList.add('hidden');
        entryPanel.classList.toggle('hidden', mode === 'hidden');
        document.querySelector('.controls').classList.toggle('hidden', mode !== 'hidden');
        showAddPanelBtn.classList.toggle('hidden', mode !== 'hidden');
        
        if (mode === 'hidden') return;

        panelTitle.textContent = mode === 'add' ? 'Add a New Customer' : 'Edit Customer';
        mainActionBtn.textContent = mode === 'add' ? 'Add to Route' : 'Save Changes';
        notesSection.classList.toggle('hidden', mode === 'add');
        deleteBtn.classList.toggle('hidden', mode === 'add');
        
        searchInput.value = data.name || '';
        daySelect.value = data.day || 'monday';
        tempInput.value = data.temp || 50;
        selectedPlaceDetails = null;
        renderNotes(data.notes);
    }

    function editEntry(entryElement) {
        activeEntryKey = entryElement.dataset.key;
        const data = {};
        for(const [k, v] of Object.entries(entryElement.dataset)) {
             if (v.startsWith('{') || v.startsWith('[')) {
                data[k] = JSON.parse(v);
            } else {
                data[k] = v;
            }
        }
        setPanelMode('edit', data);
    }
    
    function updateScheduleFromDOM() {
        const updates = {};
        const allKeysInDb = new Set(Object.values(scheduleData.schedule || {}).flatMap(day => Object.keys(day || {})));
        const keysInDom = new Set();

        document.querySelectorAll('.calendar-day').forEach(dayEl => {
            const dayId = dayEl.id.replace('cal-', '');
            dayEl.querySelectorAll('.entry').forEach((entryEl, index) => {
                const key = entryEl.dataset.key;
                keysInDom.add(key);
                const originalDay = entryEl.dataset.day;
                
                const currentData = scheduleData.schedule[originalDay]?.[key] || {};
                const datasetData = {};
                for(const [k,v] of Object.entries(entryEl.dataset)) {
                    if (v.startsWith('{') || v.startsWith('[')) datasetData[k] = JSON.parse(v);
                    else datasetData[k] = v;
                }

                updates[`/schedule/${dayId}/${key}`] = { ...currentData, ...datasetData, order: index, day: dayId };
                 if (originalDay !== dayId && scheduleData.schedule[originalDay]?.[key]) {
                    updates[`/schedule/${originalDay}/${key}`] = null;
                }
            });
        });

        allKeysInDb.forEach(key => {
            if (!keysInDom.has(key)) {
                Object.keys(scheduleData.schedule).forEach(dayId => {
                    if (scheduleData.schedule[dayId]?.[key]) {
                         updates[`/schedule/${dayId}/${key}`] = null;
                    }
                });
            }
        });
        
        db.ref().update(updates);
    }

    // --- OPTIMIZER LOGIC ---
    function showOptimizerForDay(day) {
        const dayStops = scheduleData.schedule[day] ? Object.values(scheduleData.schedule[day]).sort((a, b) => a.order - b.order) : [];
        optimizerList.innerHTML = dayStops.map(stop => `<li>${stop.name} - ${stop.address}</li>`).join('');
    }
    
    // --- SECTOR CALCULATOR LOGIC ---
    const calculateAverage = () => {
        const values = Array.from(sectorInputs).map(input => parseInt(input.value, 10) || 0);
        if (enableWeightingCheckbox.checked) {
            const weights = weightInputs.map(input => parseInt(input.value, 10) || 0);
            const totalWeight = weights.reduce((sum, w) => sum + w, 0);
            if (totalWeight === 0) return 50;
            const weightedSum = values.reduce((sum, val, i) => sum + (val * (weights[i] / 100)), 0);
            return Math.round(weightedSum);
        } else {
            return Math.round(values.reduce((sum, val) => sum + val, 0) / values.length);
        }
    };

    const updateTempFromSectors = () => {
        if (!sectorMode) return;
        const average = calculateAverage();
        tempInput.value = average;
        tempInput.dispatchEvent(new Event('input'));
    };

    const adjustWeights = (changedInput) => {
        let changedValue = parseInt(changedInput.value, 10);
        if (isNaN(changedValue) || changedValue < 0) changedValue = 0;
        if (changedValue > 100) changedValue = 100;
        changedInput.value = changedValue;

        const otherInputs = weightInputs.filter(input => input !== changedInput);
        let remainingTotal = 100 - changedValue;
        
        let otherInputsTotal = otherInputs.reduce((sum, input) => sum + (parseInt(input.value, 10) || 0), 0);

        if (otherInputsTotal === 0 && otherInputs.length > 0) {
            const equalShare = Math.floor(remainingTotal / otherInputs.length);
            otherInputs.forEach(input => input.value = equalShare);
        } else if (otherInputs.length > 0) {
            otherInputs.forEach(input => {
                const proportion = (parseInt(input.value, 10) || 0) / otherInputsTotal;
                input.value = Math.round(remainingTotal * proportion);
            });
        }
        
        let finalSum = weightInputs.reduce((sum, input) => sum + (parseInt(input.value, 10) || 0), 0);
        const difference = 100 - finalSum;
        if (difference !== 0 && otherInputs.length > 0) {
            otherInputs[0].value = (parseInt(otherInputs[0].value, 10) || 0) + difference;
        }
    };
    
    // --- EVENT LISTENERS ---
    showAddPanelBtn.addEventListener('click', () => setPanelMode('add'));
    addNoteBtn.addEventListener('click', () => {
        if (!activeEntryKey || !noteInput.value.trim()) return;
        const day = document.querySelector(`[data-key="${activeEntryKey}"]`).dataset.day.replace(/"/g, '');
        db.ref(`schedule/${day}/${activeEntryKey}/notes`).push({
            timestamp: new Date().toISOString(),
            text: noteInput.value.trim(),
            user: window.currentUser
        });
        noteInput.value = '';
    });
    deleteBtn.addEventListener('click', () => {
        if (activeEntryKey) {
            const day = document.querySelector(`[data-key="${activeEntryKey}"]`).dataset.day.replace(/"/g, '');
            db.ref(`schedule/${day}/${activeEntryKey}`).remove();
            setPanelMode('hidden');
        }
    });

    mainActionBtn.addEventListener('click', async () => {
        if (currentMode === 'add') {
            if (!selectedPlaceDetails) return alert("Please select a valid customer from the dropdown.");
            const day = daySelect.value;
            const stopsOnDay = scheduleData.schedule[day] ? Object.values(scheduleData.schedule[day]) : [];
            db.ref(`schedule/${day}`).push({
                name: selectedPlaceDetails.displayName,
                address: `${getAddressComponent(selectedPlaceDetails.addressComponents, 'locality')}, ${getAddressComponent(selectedPlaceDetails.addressComponents, 'administrative_area_level_1', true)}`,
                formattedAddress: selectedPlaceDetails.formattedAddress,
                temp: tempInput.value,
                day: day,
                placeId: selectedPlaceDetails.id,
                lastEditedBy: window.currentUser,
                order: stopsOnDay.length
            });
            setPanelMode('hidden');
        } else if (currentMode === 'edit' && activeEntryKey) {
            const originalDay = document.querySelector(`[data-key="${activeEntryKey}"]`).dataset.day.replace(/"/g, '');
            const newDay = daySelect.value;
            const currentData = scheduleData.schedule[originalDay][activeEntryKey];

            if (originalDay !== newDay) {
                const entryData = { 
                    ...currentData, 
                    day: newDay, 
                    name: searchInput.value,
                    temp: tempInput.value,
                    lastEditedBy: window.currentUser 
                };
                db.ref(`schedule/${originalDay}/${activeEntryKey}`).remove();
                db.ref(`schedule/${newDay}`).push(entryData);
            } else {
                db.ref(`schedule/${originalDay}/${activeEntryKey}`).update({
                    name: searchInput.value,
                    temp: tempInput.value,
                    lastEditedBy: window.currentUser
                });
            }
            setPanelMode('hidden');
        }
    });

    let suggestionsList = null;
    optimizerSearch.addEventListener('input', () => { /* ... new optimizer search ... */ });
    searchInput.addEventListener('input', () => {
        if (suggestionsList) suggestionsList.remove();
        if (!searchInput.value) return;
        
        const request = { input: searchInput.value };
        if (searchBiasCenter) {
            request.locationBias = new google.maps.Circle({ center: searchBiasCenter, radius: 100000 });
        }
        
        autocompleteService.getPlacePredictions(request, (predictions, status) => {
            if (status === 'OK' && predictions) {
                suggestionsList = document.createElement('ul');
                suggestionsList.className = 'suggestions-list';
                searchInput.parentNode.appendChild(suggestionsList);
                predictions.forEach(p => {
                    const item = document.createElement('li');
                    item.className = 'suggestion-item';
                    item.textContent = p.description;
                    item.addEventListener('click', async () => {
                        if (suggestionsList) suggestionsList.remove();
                        const place = new google.maps.places.Place({ id: p.place_id });
                        await place.fetchFields({ fields: ['displayName', 'addressComponents', 'formattedAddress', 'id'] });
                        selectedPlaceDetails = place;
                        searchInput.value = place.displayName;
                    });
                    suggestionsList.appendChild(item);
                });
            }
        });
    });
    document.addEventListener('click', (e) => {
        if (suggestionsList && !searchInput.parentNode.contains(e.target)) {
            suggestionsList.remove();
        }
    });

    dayStartToggles.forEach(btn => {
        btn.addEventListener('click', () => {
            const day = btn.dataset.day;
            const location = btn.dataset.location;
            db.ref(`startLocations/${day}`).set(location);
        });
    });

    document.addEventListener('dragstart', (e) => {
        if (e.target.classList.contains('entry')) {
            draggedItem = e.target;
            setTimeout(() => e.target.classList.add('dragging'), 0);
        }
    });
    document.addEventListener('dragend', () => {
        if (draggedItem) {
            draggedItem.classList.remove('dragging');
            draggedItem = null;
            updateScheduleFromDOM();
        }
    });
    dropzones.forEach(zone => {
        zone.addEventListener('dragover', (e) => {
            e.preventDefault();
            const afterElement = getDragAfterElement(zone, e.clientY);
            if (afterElement == null) zone.appendChild(draggedItem);
            else zone.insertBefore(draggedItem, afterElement);
        });
    });

    function getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.entry:not(.dragging)')];
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) return { offset: offset, element: child };
            else return closest;
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }
    
    showOptimizerBtn.addEventListener('click', () => {
        optimizerPanel.classList.remove('hidden');
        document.querySelector('.controls').classList.add('hidden');
        showAddPanelBtn.classList.add('hidden');
        showOptimizerForDay(optimizerDaySelect.value);
    });
    cancelEntryPanelBtn.addEventListener('click', () => {
        setPanelMode('hidden');
    });
    cancelOptimizerPanelBtn.addEventListener('click', () => {
        optimizerPanel.classList.add('hidden');
        document.querySelector('.controls').classList.remove('hidden');
        showAddPanelBtn.classList.remove('hidden');
    });
    optimizerDaySelect.addEventListener('change', () => showOptimizerForDay(optimizerDaySelect.value));
    runOptimizationBtn.addEventListener('click', () => { 
        if (optimizerStops.length < 2) return alert("Please add at least two stops to optimize.");
        const origin = CONFIG.STARTING_LOCATIONS[optimizerStartLocation.value];
        const waypoints = optimizerStops.map(stop => ({ location: stop.formattedAddress }));
        directionsService.route({ origin, destination: origin, waypoints, travelMode: 'DRIVING', optimizeWaypoints: true }, (response, status) => {
            if (status === 'OK') {
                const newOrderMap = response.routes[0].waypoint_order;
                const legs = response.routes[0].legs;
                let currentTime = new Date(`1970-01-01T${optimizerStartTime.value}`);
                let resultsHTML = `<div class="result-item"><div class="result-time">${currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div><div class="result-details"><strong>Start from ${optimizerStartLocation.value}</strong></div></div>`;
                newOrderMap.forEach((originalIndex, i) => {
                    const travelDurationSeconds = legs[i].duration.value;
                    currentTime.setSeconds(currentTime.getSeconds() + travelDurationSeconds);
                    const stop = optimizerStops[originalIndex];
                    resultsHTML += `<div class="result-item"><div class="result-time">${currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div><div class="result-details">${stop.name}</div></div>`;
                    currentTime.setMinutes(currentTime.getMinutes() + parseInt(optimizerInterval.value, 10));
                });
                optimizerResultsList.innerHTML = resultsHTML;
                optimizerResults.classList.remove('hidden');
                optimizerInputs.classList.add('hidden');
            } else {
                alert("Could not optimize route: " + status);
            }
        });
    });
    optimizerBackBtn.addEventListener('click', () => {
        optimizerResults.classList.add('hidden');
        optimizerInputs.classList.remove('hidden');
    });
    
    toggleSectorBtn.addEventListener('click', () => {
        sectorMode = !sectorMode;
        sectorCalculator.classList.toggle('hidden');
        document.getElementById('simple-temp-group').classList.toggle('hidden');
        toggleSectorBtn.textContent = sectorMode ? 'Disable Sector Calculation' : 'Enable Sector Calculation';
        if(sectorMode) updateTempFromSectors();
    });
    enableWeightingCheckbox.addEventListener('change', () => {
        weightingInputsContainer.classList.toggle('hidden', !enableWeightingCheckbox.checked);
        updateTempFromSectors();
    });
    sectorInputs.forEach(input => input.addEventListener('input', updateTempFromSectors));
    weightInputs.forEach(input => {
        input.addEventListener('input', () => adjustWeights(input));
        input.addEventListener('change', updateTempFromSectors);
    });
};
