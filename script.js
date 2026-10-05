document.addEventListener('DOMContentLoaded', () => {
    // --- CLOCK AND DATE ---
    function updateClock() {
        const now = new Date();
        
        // Time
        const timeStr = now.toLocaleTimeString('pt-BR', { hour12: false });
        document.getElementById('currentTime').textContent = timeStr;
        
        // Date
        const dateOptions = { day: '2-digit', month: '2-digit', year: 'numeric' };
        document.getElementById('currentDate').textContent = now.toLocaleDateString('pt-BR', dateOptions);
    }
    
    setInterval(updateClock, 1000);
    updateClock();

    // --- TAB SWITCHING ---
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabPanels = document.querySelectorAll('.tab-panel');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active from all
            tabBtns.forEach(b => b.classList.remove('active'));
            tabPanels.forEach(p => p.classList.remove('active'));
            
            // Add active to clicked
            btn.classList.add('active');
            const target = btn.getAttribute('data-target');
            document.getElementById(target).classList.add('active');
            
            // Map needs to be invalidated when its container becomes visible
            if (target === 'formulario-tab' && map) {
                setTimeout(() => {
                    map.invalidateSize();
                }, 100);
            }
        });
    });

    // --- MAP & GEOLOCATION ---
    let map;
    let marker;
    const getLocationBtn = document.getElementById('getLocationBtn');
    const locationStatus = document.getElementById('locationStatus');
    const latInput = document.getElementById('latitude');
    const lngInput = document.getElementById('longitude');

    function initMap(lat = -15.7801, lng = -47.9292, zoom = 4) { // Default Brazil center
        if (!map) {
            map = L.map('map').setView([lat, lng], zoom);
            L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
                subdomains: 'abcd',
                maxZoom: 20
            }).addTo(map);
            
            // Allow user to click on map to set location manually
            map.on('click', function(e) {
                setMarker(e.latlng.lat, e.latlng.lng);
            });
        }
    }

    function setMarker(lat, lng) {
        if (marker) {
            marker.setLatLng([lat, lng]);
        } else {
            marker = L.marker([lat, lng]).addTo(map);
        }
        map.setView([lat, lng], 15);
        latInput.value = lat;
        lngInput.value = lng;
        locationStatus.textContent = `Local: ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        locationStatus.style.color = 'var(--brand-green)';
    }

    // Initialize map
    initMap();

    getLocationBtn.addEventListener('click', () => {
        locationStatus.textContent = "Obtendo localização...";
        locationStatus.style.color = "var(--text-muted)";
        
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const lat = position.coords.latitude;
                    const lng = position.coords.longitude;
                    setMarker(lat, lng);
                },
                (error) => {
                    locationStatus.textContent = "Erro. Clique no mapa.";
                    locationStatus.style.color = "red";
                },
                { enableHighAccuracy: true }
            );
        } else {
            locationStatus.textContent = "Não suportado.";
            locationStatus.style.color = "red";
        }
    });

    // --- IMAGE PREVIEW ---
    const imageInput = document.getElementById('imagem');
    const imagePreview = document.getElementById('imagePreview');

    imageInput.addEventListener('change', function() {
        const file = this.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                imagePreview.src = e.target.result;
                imagePreview.style.display = 'block';
            }
            reader.readAsDataURL(file);
        } else {
            imagePreview.src = '';
            imagePreview.style.display = 'none';
        }
    });

    // --- FORM SUBMISSION & CRUD ---
    const form = document.getElementById('weedForm');
    const recordsBody = document.getElementById('recordsBody');
    let editingId = null;

    loadRecords();

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const formData = new FormData(form);
        const record = {
            id: editingId ? editingId : Date.now(),
            codFz: formData.get('codFz'),
            sigla: formData.get('sigla'),
            bloco: formData.get('bloco'),
            talhao: formData.get('talhao'),
            variedade: formData.get('variedade'),
            plantaDaninha: formData.get('plantaDaninha'),
            latitude: formData.get('latitude'),
            longitude: formData.get('longitude'),
            date: editingId ? formData.get('originalDate') : new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'})
        };

        const file = formData.get('imagem');
        if (file && file.size > 0) {
            const reader = new FileReader();
            reader.onload = function(e) {
                // Compress image before saving
                const img = new Image();
                img.onload = function() {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 800;
                    const MAX_HEIGHT = 800;
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > MAX_WIDTH) {
                            height *= MAX_WIDTH / width;
                            width = MAX_WIDTH;
                        }
                    } else {
                        if (height > MAX_HEIGHT) {
                            width *= MAX_HEIGHT / height;
                            height = MAX_HEIGHT;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    
                    // Compress as JPEG
                    record.image = canvas.toDataURL('image/jpeg', 0.7);
                    saveRecord(record);
                }
                img.src = e.target.result;
            }
            reader.readAsDataURL(file);
        } else {
            // Se estiver editando e não enviou nova imagem, manter a antiga
            if (editingId) {
                let records = JSON.parse(localStorage.getItem('weedRecordsLight') || '[]');
                let oldRecord = records.find(r => r.id === editingId);
                if (oldRecord && oldRecord.image) {
                    record.image = oldRecord.image;
                }
            }
            saveRecord(record);
        }
    });

    function saveRecord(record) {
        let records = JSON.parse(localStorage.getItem('weedRecordsLight') || '[]');
        
        if (editingId) {
            const index = records.findIndex(r => r.id === editingId);
            if (index !== -1) {
                records[index] = record;
            }
        } else {
            records.unshift(record);
        }

        try {
            localStorage.setItem('weedRecordsLight', JSON.stringify(records));
            alert(editingId ? "Levantamento atualizado com sucesso!" : "Levantamento salvo com sucesso!");
        } catch (e) {
            console.error(e);
            alert("Erro ao salvar! A foto é muito grande e estourou a memória do navegador. Tente enviar fotos menores ou exclua registros antigos.");
            return;
        }
        
        resetFormState();
        loadRecords();
        
        // Retornar para a aba da base de dados
        document.querySelector('.tab-btn[data-target="basedados-tab"]').click();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function resetFormState() {
        form.reset();
        editingId = null;
        imagePreview.style.display = 'none';
        if (marker) {
            map.removeLayer(marker);
            marker = null;
        }
        locationStatus.textContent = "Localização não capturada";
        locationStatus.style.color = "var(--text-muted)";
        latInput.value = "";
        lngInput.value = "";
        
        document.querySelector('#weedForm button[type="submit"]').textContent = "Salvar Levantamento";
        document.getElementById('cancelEditBtn').style.display = 'none';
        
        const dateInput = document.getElementById('originalDate');
        if (dateInput) dateInput.remove();
    }

    // Cancelar edição
    document.getElementById('cancelEditBtn').addEventListener('click', () => {
        resetFormState();
        document.querySelector('.tab-btn[data-target="basedados-tab"]').click();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    function loadRecords() {
        let records = JSON.parse(localStorage.getItem('weedRecordsLight') || '[]');
        recordsBody.innerHTML = '';
        
        if (records.length === 0) {
            recordsBody.innerHTML = '<tr><td colspan="10" style="text-align: center; color: var(--text-muted);">Nenhum registro encontrado.</td></tr>';
            return;
        }

        records.forEach(record => {
            const tr = document.createElement('tr');
            
            // Location
            let locationHtml = '<span class="text-muted">N/A</span>';
            if (record.latitude && record.longitude) {
                locationHtml = `<a href="https://www.google.com/maps?q=${record.latitude},${record.longitude}" target="_blank" class="table-link">🌍 Ver Mapa</a>`;
            }

            // Image
            let imageHtml = '<span class="text-muted">N/A</span>';
            if (record.image) {
                imageHtml = `<span class="table-link" onclick="window.openImageModal('${record.image}')">📷 Ver Foto</span>`;
            }

            // Actions
            let actionsHtml = `
                <div class="action-buttons">
                    <button class="btn-icon btn-edit" onclick="window.editRecord(${record.id})" title="Editar">✏️</button>
                    <button class="btn-icon btn-delete" onclick="window.deleteRecord(${record.id})" title="Excluir">🗑️</button>
                </div>
            `;

            tr.innerHTML = `
                <td>${record.codFz}</td>
                <td>${record.sigla}</td>
                <td>${record.bloco}</td>
                <td>${record.talhao}</td>
                <td>${record.variedade}</td>
                <td>${record.plantaDaninha}</td>
                <td>${locationHtml}</td>
                <td>${imageHtml}</td>
                <td>${record.date}</td>
                <td>${actionsHtml}</td>
            `;
            recordsBody.appendChild(tr);
        });
    }

    // --- CRUD ACTIONS ---
    window.deleteRecord = function(id) {
        if (confirm("Tem certeza que deseja excluir este levantamento?")) {
            let records = JSON.parse(localStorage.getItem('weedRecordsLight') || '[]');
            records = records.filter(r => r.id !== id);
            localStorage.setItem('weedRecordsLight', JSON.stringify(records));
            loadRecords();
        }
    }

    window.editRecord = function(id) {
        let records = JSON.parse(localStorage.getItem('weedRecordsLight') || '[]');
        let record = records.find(r => r.id === id);
        
        if (!record) return;

        editingId = record.id;
        
        // Populate form
        document.getElementById('codFz').value = record.codFz || '';
        document.getElementById('sigla').value = record.sigla || '';
        document.getElementById('bloco').value = record.bloco || '';
        document.getElementById('talhao').value = record.talhao || '';
        document.getElementById('variedade').value = record.variedade || '';
        document.getElementById('plantaDaninha').value = record.plantaDaninha || '';
        
        // Handle Location
        if (record.latitude && record.longitude) {
            latInput.value = record.latitude;
            lngInput.value = record.longitude;
            setMarker(parseFloat(record.latitude), parseFloat(record.longitude));
        }

        // Handle Image
        if (record.image) {
            imagePreview.src = record.image;
            imagePreview.style.display = 'block';
        } else {
            imagePreview.src = '';
            imagePreview.style.display = 'none';
        }

        // Store original date
        let dateInput = document.getElementById('originalDate');
        if (!dateInput) {
            dateInput = document.createElement('input');
            dateInput.type = 'hidden';
            dateInput.id = 'originalDate';
            dateInput.name = 'originalDate';
            form.appendChild(dateInput);
        }
        dateInput.value = record.date;

        // Change submit button text
        document.querySelector('#weedForm button[type="submit"]').textContent = "Atualizar Levantamento";
        document.getElementById('cancelEditBtn').style.display = 'inline-block';

        // Switch to form tab
        document.querySelector('.tab-btn[data-target="formulario-tab"]').click();
        
        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // --- MODAL LOGIC ---
    const modal = document.getElementById("imageModal");
    const modalImg = document.getElementById("modalImage");
    const span = document.getElementsByClassName("close-modal")[0];

    window.openImageModal = function(imageSrc) {
        modal.style.display = "block";
        modalImg.src = imageSrc;
    }

    span.onclick = function() {
        modal.style.display = "none";
    }

    window.onclick = function(event) {
        if (event.target == modal) {
            modal.style.display = "none";
        }
    }

    // --- CADASTROS LOGIC (Variedades e Plantas Daninhas) ---
    function loadCadastros() {
        const variedades = JSON.parse(localStorage.getItem('weedVariedades') || '[]');
        const plantasDaninhas = JSON.parse(localStorage.getItem('weedPlantasDaninhas') || '[]');

        // Populate lists
        const listaVariedade = document.getElementById('listaVariedade');
        listaVariedade.innerHTML = '';
        variedades.forEach(v => {
            const li = document.createElement('li');
            li.innerHTML = `<span>${v}</span> <button class="btn-icon btn-delete" onclick="window.deleteVariedade('${v}')">🗑️</button>`;
            listaVariedade.appendChild(li);
        });

        const listaPlanta = document.getElementById('listaPlantaDaninha');
        listaPlanta.innerHTML = '';
        plantasDaninhas.forEach(p => {
            const li = document.createElement('li');
            li.innerHTML = `<span>${p}</span> <button class="btn-icon btn-delete" onclick="window.deletePlantaDaninha('${p}')">🗑️</button>`;
            listaPlanta.appendChild(li);
        });

        // Populate select inputs in Formulario
        const selectVariedade = document.getElementById('variedade');
        // Save current selection to restore if editing
        const currentVar = selectVariedade.value;
        selectVariedade.innerHTML = '<option value="" disabled selected>Selecione a Variedade</option>';
        variedades.forEach(v => {
            const opt = document.createElement('option');
            opt.value = v;
            opt.textContent = v;
            selectVariedade.appendChild(opt);
        });
        if(currentVar) selectVariedade.value = currentVar;

        const selectPlanta = document.getElementById('plantaDaninha');
        const currentPlanta = selectPlanta.value;
        selectPlanta.innerHTML = '<option value="" disabled selected>Selecione a Planta Daninha</option>';
        plantasDaninhas.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p;
            opt.textContent = p;
            selectPlanta.appendChild(opt);
        });
        if(currentPlanta) selectPlanta.value = currentPlanta;
    }

    window.addVariedade = function() {
        const input = document.getElementById('novaVariedade');
        const val = input.value.trim();
        if(!val) return;

        let variedades = JSON.parse(localStorage.getItem('weedVariedades') || '[]');
        if(!variedades.includes(val)) {
            variedades.push(val);
            localStorage.setItem('weedVariedades', JSON.stringify(variedades));
        }
        input.value = '';
        loadCadastros();
    }

    window.addPlantaDaninha = function() {
        const input = document.getElementById('novaPlantaDaninha');
        const val = input.value.trim();
        if(!val) return;

        let plantas = JSON.parse(localStorage.getItem('weedPlantasDaninhas') || '[]');
        if(!plantas.includes(val)) {
            plantas.push(val);
            localStorage.setItem('weedPlantasDaninhas', JSON.stringify(plantas));
        }
        input.value = '';
        loadCadastros();
    }

    window.deleteVariedade = function(val) {
        if(!confirm(`Remover variedade: ${val}?`)) return;
        let variedades = JSON.parse(localStorage.getItem('weedVariedades') || '[]');
        variedades = variedades.filter(v => v !== val);
        localStorage.setItem('weedVariedades', JSON.stringify(variedades));
        loadCadastros();
    }

    window.deletePlantaDaninha = function(val) {
        if(!confirm(`Remover planta daninha: ${val}?`)) return;
        let plantas = JSON.parse(localStorage.getItem('weedPlantasDaninhas') || '[]');
        plantas = plantas.filter(p => p !== val);
        localStorage.setItem('weedPlantasDaninhas', JSON.stringify(plantas));
        loadCadastros();
    }

    // Call loadCadastros on initialization
    loadCadastros();
});
