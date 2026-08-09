console.log("js loaded");

// =======================
// INDEX PAGE LOGIN/REGISTER TOGGLE
// =======================
if (document.querySelector('.wrapper')) {
    const wrapper = document.querySelector('.wrapper');
    const loginLink = document.querySelector('.login-link');
    const registerLink = document.querySelector('.register-link');

    if (registerLink) {
        registerLink.onclick = (e) => {
            e.preventDefault();
            wrapper.classList.add('active');
        };
    }

    if (loginLink) {
        loginLink.onclick = (e) => {
            e.preventDefault();
            wrapper.classList.remove('active');
        };
    }
}

// =======================
// HOME PAGE
// =======================
if (document.getElementById('map')) {
    let locationInterval = null;
    let map = null;
    let marker = null;
    let currentLat = null;
    let currentLon = null;
    let emergencyContacts = [];

    let soundInterval = null;
    let sosInterval = null;
    let voiceInterval = null;
    let currentOscillator = null;
    let currentAudioContext = null;
    let sosActive = false;

    // =======================
    // CSRF TOKEN
    // =======================
    function getCSRFToken() {
        const metaToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
        if (metaToken) return metaToken;

        const csrfCookie = document.cookie
            .split('; ')
            .find(row => row.startsWith('csrftoken='));

        return csrfCookie ? csrfCookie.split('=')[1] : '';
    }

    // =======================
    // MAP
    // =======================
    map = L.map('map').setView([20.5937, 78.9629], 5);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    // =======================
    // LOCATION
    // =======================
    function updateLocation(callback = null) {
        const gpsDisplay = document.getElementById('gps-display');

        if (!navigator.geolocation) {
            if (gpsDisplay) {
                gpsDisplay.textContent = 'Geolocation not supported.';
            }
            if (typeof callback === 'function') callback(false);
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                currentLat = position.coords.latitude;
                currentLon = position.coords.longitude;

                if (gpsDisplay) {
                    gpsDisplay.textContent = `Latitude: ${currentLat}, Longitude: ${currentLon}`;
                }

                if (map) {
                    map.setView([currentLat, currentLon], 13);

                    if (marker) {
                        map.removeLayer(marker);
                    }

                    marker = L.marker([currentLat, currentLon])
                        .addTo(map)
                        .bindPopup("You are here")
                        .openPopup();
                }

                if (typeof callback === 'function') {
                    callback(true);
                }
            },
            (error) => {
                console.error("Geolocation error:", error);

                if (gpsDisplay) {
                    switch (error.code) {
                        case error.PERMISSION_DENIED:
                            gpsDisplay.textContent = 'Location permission denied.';
                            break;
                        case error.POSITION_UNAVAILABLE:
                            gpsDisplay.textContent = 'Location information unavailable.';
                            break;
                        case error.TIMEOUT:
                            gpsDisplay.textContent = 'Location request timed out.';
                            break;
                        default:
                            gpsDisplay.textContent = 'Unable to fetch location.';
                            break;
                    }
                }

                if (typeof callback === 'function') {
                    callback(false);
                }
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
    }

    updateLocation();
    locationInterval = setInterval(updateLocation, 10000);

    function shareLocationWhatsApp() {
        if (currentLat !== null && currentLon !== null) {
            const mapsLink = `https://www.google.com/maps/search/?api=1&query=${currentLat},${currentLon}`;
            const message = `🚨 Emergency SOS! My live location: ${mapsLink}`;
            const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
            window.open(url, '_blank');
        } else {
            alert('Location not available yet. Please allow GPS permission and wait a few seconds.');
        }
    }

    // =======================
    // CONTACTS
    // =======================
    async function loadContacts() {
        try {
            const response = await fetch('/get-contacts/', {
                method: 'GET',
                headers: {
                    'X-CSRFToken': getCSRFToken()
                }
            });

            const data = await response.json();

            if (data.contacts) {
                emergencyContacts = data.contacts;
                displayContacts();
            }
        } catch (error) {
            console.error('Failed to load contacts:', error);
            const status = document.getElementById('contact-status');
            if (status) status.textContent = 'Could not load contacts.';
        }
    }

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function getInitials(name) {
        if (!name) return '?';
        return name
            .trim()
            .split(' ')
            .filter(Boolean)
            .slice(0, 2)
            .map(part => part[0].toUpperCase())
            .join('');
    }

    function displayContacts() {
        const div = document.getElementById('contacts-list');
        if (!div) return;

        if (!emergencyContacts.length) {
            div.innerHTML = '<p>No emergency contacts added yet.</p>';
            return;
        }

        div.innerHTML = emergencyContacts.map((c, i) => `
            <div class="contact-item">
                <div class="contact-left">
                    <div class="contact-avatar">${escapeHtml(getInitials(c.name))}</div>
                    <div class="contact-details">
                        <div class="contact-name">${escapeHtml(c.name || 'Unknown')}</div>
                        <div class="contact-meta">${escapeHtml(c.phone || 'No phone')}</div>
                        <div class="contact-meta">${escapeHtml(c.email || 'No email')}</div>
                    </div>
                </div>

                <div class="contact-menu-wrap">
                    <button type="button" class="contact-menu-btn" onclick="toggleContactMenu(${i}, event)">⋮</button>
                    <div id="contact-menu-${i}" class="contact-menu">
                        <button type="button" onclick="removeContact(${i})">Remove</button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    function toggleContactMenu(index, event) {
        event.stopPropagation();

        document.querySelectorAll('.contact-menu').forEach(menu => {
            if (menu.id !== `contact-menu-${index}`) {
                menu.classList.remove('show');
            }
        });

        const menu = document.getElementById(`contact-menu-${index}`);
        if (menu) {
            menu.classList.toggle('show');
        }
    }

    async function removeContact(index) {
        const contact = emergencyContacts[index];
        if (!contact || !contact.id) return;

        try {
            const response = await fetch(`/delete-contact/${contact.id}/`, {
                method: 'DELETE',
                headers: {
                    'X-CSRFToken': getCSRFToken()
                }
            });

            const data = await response.json();
            const status = document.getElementById('contact-status');

            if (response.ok && data.success) {
                emergencyContacts.splice(index, 1);
                displayContacts();
                if (status) status.textContent = 'Contact removed.';
            } else {
                if (status) status.textContent = data.error || 'Failed to remove contact.';
            }
        } catch (error) {
            console.error('Delete contact error:', error);
            const status = document.getElementById('contact-status');
            if (status) status.textContent = 'Error while removing contact.';
        }
    }

    const contactForm = document.getElementById('contact-form');
    if (contactForm) {
        contactForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const name = document.getElementById('contact-name')?.value.trim() || '';
            const phone = document.getElementById('contact-phone')?.value.trim() || '';
            const email = document.getElementById('contact-email')?.value.trim() || '';
            const status = document.getElementById('contact-status');

            if (!name || !phone) {
                if (status) status.textContent = 'Name and phone are required.';
                return;
            }

            try {
                const response = await fetch('/add-contact/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': getCSRFToken()
                    },
                    body: JSON.stringify({ name, phone, email })
                });

                const data = await response.json();

                if (response.ok && data.contact) {
                    emergencyContacts.push(data.contact);
                    displayContacts();
                    contactForm.reset();
                    if (status) status.textContent = 'Emergency contact added successfully.';
                } else if (response.ok && data.success) {
                    if (status) status.textContent = data.message || 'Emergency contact added successfully.';
                    contactForm.reset();
                    loadContacts();
                } else {
                    if (status) status.textContent = data.error || 'Failed to add contact.';
                }
            } catch (error) {
                console.error('Add contact error:', error);
                if (status) status.textContent = 'Error while adding contact.';
            }
        });
    }

    async function importMobileContacts() {
        const status = document.getElementById('contact-status');

        if (!('contacts' in navigator) || !('ContactsManager' in window)) {
            if (status) {
                status.textContent = 'Mobile contact import is not supported on this browser/device.';
            }
            return;
        }

        try {
            const supportedProperties = await navigator.contacts.getProperties();
            const props = ['name', 'tel', 'email'].filter(prop => supportedProperties.includes(prop));

            if (props.length === 0) {
                if (status) {
                    status.textContent = 'This device does not support name, phone, or email import.';
                }
                return;
            }

            const contacts = await navigator.contacts.select(props, { multiple: true });

            if (!contacts || contacts.length === 0) {
                if (status) {
                    status.textContent = 'No contacts selected.';
                }
                return;
            }

            let addedCount = 0;

            for (const selected of contacts) {
                const importedContact = {
                    name: selected.name && selected.name.length ? selected.name[0] : 'Unnamed Contact',
                    phone: selected.tel && selected.tel.length ? selected.tel[0] : '',
                    email: selected.email && selected.email.length ? selected.email[0] : ''
                };

                if (!importedContact.phone) continue;

                const response = await fetch('/add-contact/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': getCSRFToken()
                    },
                    body: JSON.stringify(importedContact)
                });

                const data = await response.json();

                if ((response.ok && data.contact) || (response.ok && data.success)) {
                    addedCount++;
                }
            }

            await loadContacts();

            if (status) {
                status.textContent = addedCount > 0
                    ? `${addedCount} contact(s) imported successfully.`
                    : 'Selected contacts were already added or had no phone number.';
            }
        } catch (error) {
            console.error('Contact import failed:', error);
            if (status) {
                status.textContent = 'Could not import contacts. Try again on a supported mobile browser.';
            }
        }
    }

    const importContactBtn = document.getElementById('import-contact-btn');
    if (importContactBtn) {
        importContactBtn.addEventListener('click', importMobileContacts);
    }

    document.addEventListener('click', () => {
        document.querySelectorAll('.contact-menu').forEach(menu => {
            menu.classList.remove('show');
        });
    });

    loadContacts();

    // =======================
    // SOS
    // =======================
    function speak(message) {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(message);
            utterance.rate = 1;
            utterance.pitch = 1.2;
            utterance.volume = 1;
            window.speechSynthesis.speak(utterance);
        }
    }

    async function playBeep() {
        try {
            if (!currentAudioContext) {
                currentAudioContext = new (window.AudioContext || window.webkitAudioContext)();
            }

            if (currentAudioContext.state === 'suspended') {
                await currentAudioContext.resume();
            }

            const oscillator = currentAudioContext.createOscillator();
            const gainNode = currentAudioContext.createGain();

            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(800, currentAudioContext.currentTime);
            gainNode.gain.setValueAtTime(0.3, currentAudioContext.currentTime);

            oscillator.connect(gainNode);
            gainNode.connect(currentAudioContext.destination);

            oscillator.start();
            oscillator.stop(currentAudioContext.currentTime + 1);

            currentOscillator = oscillator;
        } catch (error) {
            console.error('Beep sound error:', error);
        }
    }

    function sendSOSData() {
        fetch('/sos-trigger/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCSRFToken()
            },
            body: JSON.stringify({
                lat: currentLat,
                lon: currentLon,
                message: 'Emergency SOS!'
            })
        })
            .then(res => res.json())
            .then(data => console.log('SOS sent:', data))
            .catch(err => console.error('SOS error:', err));

        fetch('/send-push/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCSRFToken()
            },
            body: JSON.stringify({
                title: 'SOS Alert',
                body: 'Emergency triggered!'
            })
        }).catch(err => console.error('Push notification error:', err));

        shareLocationWhatsApp();

        if (sosInterval) {
            clearInterval(sosInterval);
        }

        sosInterval = setInterval(() => {
            if (currentLat !== null && currentLon !== null) {
                fetch('/live-location/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': getCSRFToken()
                    },
                    body: JSON.stringify({
                        lat: currentLat,
                        lon: currentLon
                    })
                })
                    .then(res => res.json())
                    .then(data => console.log('Live location sent:', data))
                    .catch(err => console.error('Live location error:', err));
            }
        }, 30000);
    }

    const sosButton = document.getElementById('sos-button');
    const stopSosButton = document.getElementById('stop-sos-button');
    const sosStatus = document.getElementById('sos-status');

    async function startSOS() {
        if (sosActive) return;
        sosActive = true;

        if (sosStatus) {
            sosStatus.textContent = 'SOS activated! Sending alerts and sharing location...';
        }

        if (stopSosButton) {
            stopSosButton.style.display = 'inline-block';
        }

        if (sosButton) {
            sosButton.textContent = 'SOS Active';
        }

        speak('SOS activated. Sending help. Help! Help!');

        voiceInterval = setInterval(() => {
            speak('Help! Help! Emergency!');
        }, 5000);

        await playBeep();
        soundInterval = setInterval(() => {
            playBeep();
        }, 2000);

        if (currentLat !== null && currentLon !== null) {
            sendSOSData();
        } else {
            updateLocation((success) => {
                if (success && currentLat !== null && currentLon !== null) {
                    sendSOSData();
                } else {
                    alert('Location could not be fetched. Please enable GPS and try again.');
                }
            });
        }
    }

    function stopSOS() {
        if (!sosActive) return;
        sosActive = false;

        clearInterval(soundInterval);
        clearInterval(sosInterval);
        clearInterval(voiceInterval);

        soundInterval = null;
        sosInterval = null;
        voiceInterval = null;

        if (currentOscillator) {
            try {
                currentOscillator.stop();
            } catch (e) {}
            currentOscillator = null;
        }

        if (currentAudioContext) {
            currentAudioContext.close().catch(() => {});
            currentAudioContext = null;
        }

        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
        }

        if (sosStatus) {
            sosStatus.textContent = 'SOS stopped.';
        }

        if (stopSosButton) {
            stopSosButton.style.display = 'none';
        }

        if (sosButton) {
            sosButton.textContent = 'Trigger SOS';
        }

        fetch('/stop-sos/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCSRFToken()
            }
        }).catch(err => console.error('Stop SOS error:', err));

        speak('SOS deactivated.');
    }

    if (sosButton) {
        sosButton.addEventListener('click', startSOS);
    }

    if (stopSosButton) {
        stopSosButton.addEventListener('click', stopSOS);
    }

    // =======================
    // PUSH
    // =======================
    if ('serviceWorker' in navigator && 'PushManager' in window) {
        navigator.serviceWorker.ready.then(registration => {
            registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: 'YOUR_VAPID_PUBLIC_KEY'
            }).then(subscription => {
                fetch('/subscribe-push/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': getCSRFToken()
                    },
                    body: JSON.stringify({ subscription: subscription.toJSON() })
                });
            }).catch(err => console.log('Push subscription failed:', err));
        });
    }

    // =======================
    // COMPLAINT FORM
    // =======================
    const complaintForm = document.getElementById('complaint-form');
    if (complaintForm) {
        complaintForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const subject = document.getElementById('subject')?.value.trim() || '';
            const description = document.getElementById('description')?.value.trim() || '';
            const status = document.getElementById('complaint-status');

            if (!subject || !description) {
                if (status) {
                    status.textContent = 'Please fill all complaint fields.';
                }
                return;
            }

            try {
                const response = await fetch('/report-complaint/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': getCSRFToken()
                    },
                    body: JSON.stringify({
                        subject: subject,
                        description: description
                    })
                });

                const data = await response.json();

                if (response.ok && data.success) {
                    if (status) {
                        status.textContent = 'Complaint submitted successfully.';
                    }
                    complaintForm.reset();
                } else {
                    if (status) {
                        status.textContent = data.error || 'Failed to submit complaint.';
                    }
                }
            } catch (error) {
                console.error('Complaint submit error:', error);
                if (status) {
                    status.textContent = 'Server error while submitting complaint.';
                }
            }
        });
    }

    // =======================
    // INFO SECTIONS
    // =======================
    function openInfo(type) {
        const dashboard = document.getElementById("main-dashboard");
        const infoSection = document.getElementById("info-section");
        const title = document.getElementById("info-title");
        const content = document.getElementById("info-content");

        if (!dashboard || !infoSection || !title || !content) return;

        let html = "";

        if (type === "legal") {
            title.textContent = "Legal Help";
            html = `
                <p><b>🚨 Emergency Helplines</b></p>
                <ul>
                    <li>Women Helpline (All India): <a href="tel:181">📞 181</a></li>
                    <li>Police Emergency: <a href="tel:112">📞 112</a></li>
                    <li>Women in Distress: <a href="tel:1091">📞 1091</a></li>
                    <li>Domestic Violence: <a href="tel:181">📞 181</a> / <a href="tel:1091">📞 1091</a></li>
                    <li>Child Helpline: <a href="tel:1098">📞 1098</a></li>
                    <li>Cyber Crime Helpline: <a href="tel:1930">📞 1930</a></li>
                </ul>

                <p><b>📜 Important Laws for Women (India)</b></p>
                <ul>
                    <li>Protection of Women from Domestic Violence Act, 2005</li>
                    <li>IPC Section 498A – Cruelty by Husband or Relatives</li>
                    <li>Sexual Harassment of Women at Workplace Act, 2013</li>
                    <li>IPC Section 354 – Assault on Women</li>
                </ul>
            `;
        } else if (type === "support") {
            title.textContent = "Support Community";
            html = `
                <p><b>🤝 Community Support</b></p>
                <ul>
                    <li>Women Helpline Support</li>
                    <li>Emotional & Mental Health Support</li>
                    <li>Legal Guidance Communities</li>
                    <li>Student & Youth Support Groups</li>
                    <li>NGO & Social Support Networks</li>
                </ul>

                <p><b>📞 Community Helplines</b></p>
                <ul>
                    <li>Women Helpline: <a href="tel:181">📞 181</a></li>
                    <li>Police Emergency: <a href="tel:112">📞 112</a></li>
                    <li>Child Helpline: <a href="tel:1098">📞 1098</a></li>
                </ul>
            `;
        } else if (type === "safety") {
            title.textContent = "Safety Tips";
            html = `
                <p><b>🚶 Personal Safety</b></p>
                <ul>
                    <li>Be aware of your surroundings</li>
                    <li>Avoid isolated places at night</li>
                    <li>Trust your instincts</li>
                    <li>Share your live location with trusted contacts</li>
                </ul>

                <p><b>📱 Mobile & Online Safety</b></p>
                <ul>
                    <li>Keep your phone charged</li>
                    <li>Do not share OTP or personal details</li>
                    <li>Avoid unknown links and profiles</li>
                    <li>Use strong passwords</li>
                </ul>

                <p><b>🚨 Emergency Action</b></p>
                <ul>
                    <li>Call <a href="tel:112">📞 112</a> or <a href="tel:181">📞 181</a> immediately</li>
                    <li>Use SOS button in the app</li>
                    <li>Go to a safe public place</li>
                </ul>
            `;
        } else if (type === "technology") {
            title.textContent = "Technology Tools";
            html = `
                <p><b>📍 Live GPS Location</b></p>
                <p><b>🚨 SOS Emergency Button</b></p>
                <p><b>📱 App Features</b></p>
                <ul>
                    <li>Progressive Web App (PWA)</li>
                    <li>Works on mobile & desktop</li>
                    <li>User-friendly dashboard</li>
                </ul>

                <p><b>🚀 Coming Soon Features</b></p>
                <ul>
                    <li>AI-based threat detection</li>
                    <li>Wearable device integration</li>
                    <li>Community alert system</li>
                    <li>Automatic audio & video recording</li>
                </ul>

                <p><b>🔒 Advanced Security</b></p>
                <ul>
                    <li>Encrypted user data</li>
                    <li>Secure cloud storage</li>
                    <li>Direct police integration</li>
                </ul>
            `;
        }

        content.innerHTML = html;
        dashboard.style.display = "none";
        infoSection.style.display = "block";
        window.scrollTo({ top: 0, behavior: "smooth" });
    }

    function goHome() {
        const infoSection = document.getElementById("info-section");
        const dashboard = document.getElementById("main-dashboard");

        if (infoSection) infoSection.style.display = "none";
        if (dashboard) dashboard.style.display = "grid";

        window.scrollTo({ top: 0, behavior: "smooth" });
    }

    const backHomeBtn = document.getElementById("back-home");
    const closeInfoBtn = document.getElementById("close-info");

    if (backHomeBtn) {
        backHomeBtn.addEventListener("click", goHome);
    }

    if (closeInfoBtn) {
        closeInfoBtn.addEventListener("click", goHome);
    }

    // =======================
    // LOGOUT
    // =======================
    window.logout = function () {
        window.location.href = '/logout/';
    };

    // =======================
    // GLOBAL FUNCTIONS FOR HTML
    // =======================
    window.updateLocation = updateLocation;
    window.shareLocationWhatsApp = shareLocationWhatsApp;
    window.openInfo = openInfo;
    window.toggleContactMenu = toggleContactMenu;
    window.removeContact = removeContact;
}

// =======================
// SERVICE WORKER
// =======================
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/static/sw.js')
        .then(() => console.log('SW registered'))
        .catch(err => console.log('SW registration failed:', err));
}