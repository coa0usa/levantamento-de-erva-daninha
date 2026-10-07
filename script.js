import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAZv_7DMG0sGKxTW0XpG1S41S6zAdeHfDg",
  authDomain: "levantamento-erva-daninha.firebaseapp.com",
  projectId: "levantamento-erva-daninha",
  storageBucket: "levantamento-erva-daninha.firebasestorage.app",
  messagingSenderId: "684274708603",
  appId: "1:684274708603:web:9a85b97f58f2ce936472de",
  measurementId: "G-VZVRBJ9361"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);


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
    let shapeLayer;
    let selectedShapeLayer;
    let shapeFeatures = [];
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

            loadShapeOverlay();
            
            // Allow user to click on map to set location manually
            map.on('click', function(e) {
                setMarker(e.latlng.lat, e.latlng.lng);
            });
        }
    }

    async function loadShapeOverlay() {
        try {
            const response = await fetch('./SANTAADELIA.geojson');
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const geojson = await response.json();
            shapeFeatures = geojson.features || [];
            shapeLayer = L.geoJSON(geojson, {
                style: { color: '#2563eb', weight: 1, opacity: 0.65, fillColor: '#3b82f6', fillOpacity: 0.08 },
                onEachFeature: (feature, layer) => {
                    const properties = feature.properties || {};
                    const farm = properties.NOME_FAZ || properties.FAZENDA || 'Talhão';
                    const field = properties.TALHAO ?? properties.DESC_TALHA ?? '';
                    layer.bindTooltip(`${farm}${field !== '' ? ` · Talhão ${field}` : ''}`);
                }
            }).addTo(map);
            if (latInput.value && lngInput.value) showShapeForLocation();
        } catch (error) {
            console.error('Não foi possível carregar o shape da Usina Santa Adélia:', error);
            locationStatus.textContent = 'Shape indisponível';
        }
    }

    function showShapeForLocation() {
        if (!shapeLayer || !shapeFeatures.length) return;
        const latitude = Number(latInput.value);
        const longitude = Number(lngInput.value);
        const farmCode = document.getElementById('codFz').value.trim();
        const fieldCode = document.getElementById('talhao').value.trim();
        const containsPoint = ring => {
            let inside = false;
            for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
                const [xi, yi] = ring[i];
                const [xj, yj] = ring[j];
                if (((yi > latitude) !== (yj > latitude)) &&
                    longitude < ((xj - xi) * (latitude - yi)) / ((yj - yi) || Number.EPSILON) + xi) inside = !inside;
            }
            return inside;
        };
        const containsCoordinates = (geometry) => {
            if (!geometry) return false;
            if (geometry.type === 'Polygon') return containsPoint(geometry.coordinates[0]);
            if (geometry.type === 'MultiPolygon') return geometry.coordinates.some(polygon => containsPoint(polygon[0]));
            return false;
        };
        let matches = shapeFeatures.filter(feature => containsCoordinates(feature.geometry));

        // GPS may fall just outside a boundary; use the entered farm and field as fallback.
        if (!matches.length && farmCode && fieldCode) {
            matches = shapeFeatures.filter(feature => {
                const properties = feature.properties || {};
                return String(properties.FAZENDA ?? '').trim() === farmCode &&
                    String(properties.TALHAO ?? properties.DESC_TALHA ?? '').trim() === fieldCode;
            });
        }

        if (selectedShapeLayer) map.removeLayer(selectedShapeLayer);
        if (!matches.length) return;
        selectedShapeLayer = L.geoJSON({ type: 'FeatureCollection', features: matches }, {
            style: { color: '#f97316', weight: 3, opacity: 1, fillColor: '#fb923c', fillOpacity: 0.3 }
        }).addTo(map);
        selectedShapeLayer.bringToFront();
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
        showShapeForLocation();
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
    let currentRecords = [];
    let currentVariedades = [];
    let currentPlantas = [];

    loadRecords();

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = document.querySelector('#weedForm button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = "Salvando...";
        
        const formData = new FormData(form);
        const record = {
            codFz: formData.get('codFz'),
            sigla: formData.get('sigla'),
            bloco: formData.get('bloco'),
            talhao: formData.get('talhao'),
            variedade: formData.get('variedade'),
            plantaDaninha: formData.get('plantaDaninha'),
            latitude: formData.get('latitude'),
            longitude: formData.get('longitude'),
            date: editingId ? formData.get('originalDate') : new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'}),
            timestamp: editingId ? Date.now() : Date.now()
        };

        const file = formData.get('imagem');
        if (file && file.size > 0) {
            const reader = new FileReader();
            reader.onload = function(e) {
                // Compress image before saving
                const img = new Image();
                img.onload = async function() {
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
                    record.image = canvas.toDataURL('image/jpeg', 0.6);
                    await saveRecord(record);
                }
                img.src = e.target.result;
            }
            reader.readAsDataURL(file);
        } else {
            // Se estiver editando e não enviou nova imagem, manter a antiga
            if (editingId) {
                let oldRecord = currentRecords.find(r => r.id === editingId);
                if (oldRecord && oldRecord.image) {
                    record.image = oldRecord.image;
                }
            }
            await saveRecord(record);
        }
    });

    async function saveRecord(record) {
        try {
            if (editingId) {
                const docRef = doc(db, "levantamentos", editingId);
                await updateDoc(docRef, record);
                alert("Levantamento atualizado com sucesso!");
            } else {
                await addDoc(collection(db, "levantamentos"), record);
                alert("Levantamento salvo com sucesso!");
            }
        } catch (e) {
            console.error(e);
            alert("Erro ao salvar! Verifique a conexão com a internet ou se a foto não está muito grande.");
        } finally {
            const submitBtn = document.querySelector('#weedForm button[type="submit"]');
            submitBtn.disabled = false;
            submitBtn.textContent = editingId ? "Atualizar Levantamento" : "Salvar Levantamento";
        }
        
        resetFormState();
        await loadRecords();
        
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

    async function loadRecords() {
        recordsBody.innerHTML = '<tr><td colspan="10" style="text-align: center; color: var(--text-muted);">Carregando registros...</td></tr>';
        
        try {
            const querySnapshot = await getDocs(collection(db, "levantamentos"));
            let records = [];
            querySnapshot.forEach((doc) => {
                records.push({ id: doc.id, ...doc.data() });
            });
            
            // Sort descending by timestamp
            records.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
            currentRecords = records;

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
                        <button class="btn-icon btn-edit" onclick="window.editRecord('${record.id}')" title="Editar">✏️</button>
                        <button class="btn-icon btn-delete" onclick="window.deleteRecord('${record.id}')" title="Excluir">🗑️</button>
                    </div>
                `;

                tr.innerHTML = `
                    <td>${record.codFz || ''}</td>
                    <td>${record.sigla || ''}</td>
                    <td>${record.bloco || ''}</td>
                    <td>${record.talhao || ''}</td>
                    <td>${record.variedade || ''}</td>
                    <td>${record.plantaDaninha || ''}</td>
                    <td>${locationHtml}</td>
                    <td>${imageHtml}</td>
                    <td>${record.date || ''}</td>
                    <td>${actionsHtml}</td>
                `;
                recordsBody.appendChild(tr);
            });
        } catch (e) {
            console.error("Erro ao carregar registros", e);
            recordsBody.innerHTML = '<tr><td colspan="10" style="text-align: center; color: red;">Erro ao carregar registros. Verifique sua conexão.</td></tr>';
        }
    }

    // --- CRUD ACTIONS ---
    window.deleteRecord = async function(id) {
        if (confirm("Tem certeza que deseja excluir este levantamento?")) {
            try {
                await deleteDoc(doc(db, "levantamentos", id));
                await loadRecords();
            } catch (e) {
                console.error(e);
                alert("Erro ao excluir!");
            }
        }
    }

    window.editRecord = function(id) {
        let record = currentRecords.find(r => r.id === id);
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
    async function loadCadastros() {
        try {
            const varSnapshot = await getDocs(collection(db, "variedades"));
            let variedades = [];
            varSnapshot.forEach(doc => {
                variedades.push({ id: doc.id, nome: doc.data().nome });
            });
            currentVariedades = variedades;

            const plantaSnapshot = await getDocs(collection(db, "plantasDaninhas"));
            let plantasDaninhas = [];
            plantaSnapshot.forEach(doc => {
                plantasDaninhas.push({ id: doc.id, nome: doc.data().nome });
            });
            currentPlantas = plantasDaninhas;

            // Populate lists
            const listaVariedade = document.getElementById('listaVariedade');
            listaVariedade.innerHTML = '';
            variedades.forEach(v => {
                const li = document.createElement('li');
                li.innerHTML = `<span>${v.nome}</span> <button class="btn-icon btn-delete" onclick="window.deleteVariedade('${v.id}')">🗑️</button>`;
                listaVariedade.appendChild(li);
            });

            const listaPlanta = document.getElementById('listaPlantaDaninha');
            listaPlanta.innerHTML = '';
            plantasDaninhas.forEach(p => {
                const li = document.createElement('li');
                li.innerHTML = `<span>${p.nome}</span> <button class="btn-icon btn-delete" onclick="window.deletePlantaDaninha('${p.id}')">🗑️</button>`;
                listaPlanta.appendChild(li);
            });

            // Populate select inputs in Formulario
            const selectVariedade = document.getElementById('variedade');
            const currentVar = selectVariedade.value;
            selectVariedade.innerHTML = '<option value="" disabled selected>Selecione a Variedade</option>';
            variedades.forEach(v => {
                const opt = document.createElement('option');
                opt.value = v.nome;
                opt.textContent = v.nome;
                selectVariedade.appendChild(opt);
            });
            if(currentVar) selectVariedade.value = currentVar;

            const selectPlanta = document.getElementById('plantaDaninha');
            const currentPlanta = selectPlanta.value;
            selectPlanta.innerHTML = '<option value="" disabled selected>Selecione a Planta Daninha</option>';
            plantasDaninhas.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p.nome;
                opt.textContent = p.nome;
                selectPlanta.appendChild(opt);
            });
            if(currentPlanta) selectPlanta.value = currentPlanta;

        } catch (e) {
            console.error("Erro ao carregar cadastros", e);
        }
    }

    window.addVariedade = async function() {
        const input = document.getElementById('novaVariedade');
        const val = input.value.trim();
        if(!val) return;

        // Verify if it already exists
        if(currentVariedades.find(v => v.nome.toLowerCase() === val.toLowerCase())) {
            alert("Esta variedade já está cadastrada!");
            return;
        }

        try {
            await addDoc(collection(db, "variedades"), { nome: val });
            input.value = '';
            await loadCadastros();
        } catch (e) {
            console.error("Erro ao adicionar variedade", e);
        }
    }

    window.addPlantaDaninha = async function() {
        const input = document.getElementById('novaPlantaDaninha');
        const val = input.value.trim();
        if(!val) return;

        if(currentPlantas.find(p => p.nome.toLowerCase() === val.toLowerCase())) {
            alert("Esta planta daninha já está cadastrada!");
            return;
        }

        try {
            await addDoc(collection(db, "plantasDaninhas"), { nome: val });
            input.value = '';
            await loadCadastros();
        } catch (e) {
            console.error("Erro ao adicionar planta daninha", e);
        }
    }

    window.deleteVariedade = async function(id) {
        if(!confirm(`Remover esta variedade?`)) return;
        try {
            await deleteDoc(doc(db, "variedades", id));
            await loadCadastros();
        } catch (e) {
            console.error("Erro ao remover", e);
        }
    }

    window.deletePlantaDaninha = async function(id) {
        if(!confirm(`Remover esta planta daninha?`)) return;
        try {
            await deleteDoc(doc(db, "plantasDaninhas", id));
            await loadCadastros();
        } catch (e) {
            console.error("Erro ao remover", e);
        }
    }

    // Call loadCadastros on initialization
    loadCadastros();
