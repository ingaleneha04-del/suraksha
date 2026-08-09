console.log("js loaded");

// Only run index.html-specific code if elements exist
if (document.querySelector('.wrapper')) {
    const wrapper = document.querySelector('.wrapper');
    const loginLink = document.querySelector('.login-link');
    const registerLink = document.querySelector('.register-link');

    // Login/Register toggle
    if (registerLink) {
        registerLink.onclick = () => {
            wrapper.classList.add('active');
        };
    }
    if (loginLink) {
        loginLink.onclick = () => {
            wrapper.classList.remove('active');
        };
    }
    // Forms submit naturally to views (no preventDefault)
}

// Only run home.html-specific code if elements exist
if (document.getElementById('map')) {
    // Global variables for home.html
    let locationInterval, map, marker, soundInterval, currentLat, currentLon, currentOscillator;
    let emergencyContacts = JSON.parse(localStorage.getItem('emergencyContacts')) || [];
    let sosInterval;

    // Get CSRF token
    function getCSRFToken() {
        return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ||
               document.cookie.split('; ').find(row => row.startsWith('csrftoken='))?.split('=')[1];
    }

    // Initialize map
    map = L.map('map').setView([0, 0], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    // Live GPS Location Tracking with Map
    function updateLocation() {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    currentLat = position.coords.latitude;
                    currentLon = position.coords.longitude;
                    document.getElementById('gps-display').textContent = `Latitude: ${currentLat}, Longitude: ${currentLon}`;
                    // Update map
                    map.setView([currentLat, currentLon], 13);
                    if (marker) map.removeLayer(marker);
                    marker = L.marker([currentLat, currentLon]).addTo(map);
                },
                (error) => {
                    document.getElementById('gps-display').textContent = 'Location access denied or unavailable.';
                }
            );
        } else {
            document.getElementById('gps-display').textContent = 'Geolocation not supported.';
        }
    }
    updateLocation();
    locationInterval = setInterval(updateLocation, 10000);

    // Share Location on WhatsApp
    function shareLocationWhatsApp() {
        if (currentLat && currentLon) {
            const message = `Emergency Location: https://maps.google.com/?q=${currentLat},${currentLon}`;
            const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
            window.open(url, '_blank');
        } else {
            alert('Location not available yet.');
        }
    }

    // Display multiple contacts
    function displayContacts() {
        const div = document.getElementById('contacts-list');
        div.innerHTML = emergencyContacts.map((c, i) => `<p>${c.name} - ${c.phone} - ${c.email} <button onclick="removeContact(${i})">Remove</button></p>`).join('');
    }
    displayContacts();

    // Add contact
    const contactForm = document.getElementById('contact-form');
    if (contactForm) {
        contactForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = document.getElementById('contact-name').value;
            const phone = document.getElementById('contact-phone').value;
            const email = document.getElementById('contact-email').value;
            emergencyContacts.push({ name, phone, email });
            localStorage.setItem('emergencyContacts', JSON.stringify(emergencyContacts));
            displayContacts();
            contactForm.reset();
        });
    }

    // Remove contact
    function removeContact(index) {
        emergencyContacts.splice(index, 1);
        localStorage.setItem('emergencyContacts', JSON.stringify(emergencyContacts));
        displayContacts();
    }

    // Emergency SOS Button with Real-Time Updates and Push
    const sosButton = document.getElementById('sos-button');
    if (sosButton) {
        sosButton.addEventListener('click', () => {
            const status = document.getElementById('sos-status');
            status.textContent = 'SOS Triggered! Sending alerts...';
            document.getElementById('stop-sos-button').style.display = 'inline-block';

            // Start repeating sound
            soundInterval = setInterval(() => {
                const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                currentOscillator = audioContext.createOscillator();
                currentOscillator.frequency.setValueAtTime(800, audioContext.currentTime);
                currentOscillator.connect(audioContext.destination);
                currentOscillator.start();
                currentOscillator.stop(audioContext.currentTime + 1);
            }, 2000);

            // Send initial SOS
            fetch('/sos-trigger/', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json', 
                    'X-CSRFToken': getCSRFToken()
                },
                body: JSON.stringify({ lat: currentLat, lon: currentLon, message: 'Emergency SOS!' })
            }).then(res => res.json()).then(data => console.log(data));

            // Send push notification
            fetch('/send-push/', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json', 
                    'X-CSRFToken': getCSRFToken()
                },
                body: JSON.stringify({ title: 'SOS Alert', body: 'Emergency triggered!' })
            });

            // Start real-time updates
            sosInterval = setInterval(() => {
                fetch('/live-location/', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json', 
                        'X-CSRFToken': getCSRFToken()
                    },
                    body: JSON.stringify({ lat: currentLat, lon: currentLon })
                });
            }, 30000);
        });
    }

    // Stop SOS
    const stopSosButton = document.getElementById('stop-sos-button');
    if (stopSosButton) {
        stopSosButton.addEventListener('click', () => {
            clearInterval(soundInterval);
            if (currentOscillator) {
                currentOscillator.stop();
                currentOscillator = null;
            }
            clearInterval(sosInterval);
            document.getElementById('sos-status').textContent = 'SOS stopped.';
            stopSosButton.style.display = 'none';
        });
    }

    // Push notification subscription
    if ('serviceWorker' in navigator && 'PushManager' in window) {
        navigator.serviceWorker.ready.then(registration => {
            registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: 'YOUR_VAPID_PUBLIC_KEY'  // Replace with your Firebase key
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

    // Report Complaint Form
    const complaintForm = document.getElementById('complaint-form');
    if (complaintForm) {
        complaintForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const subject = document.getElementById('subject').value;
            const description = document.getElementById('description').value;
            const status = document.getElementById('complaint-status');
            const complaints = JSON.parse(localStorage.getItem('complaints') || '[]');
            complaints.push({ subject, description, timestamp: new Date().toISOString() });
            localStorage.setItem('complaints', JSON.stringify(complaints));
            status.textContent = 'Complaint submitted!';
            complaintForm.reset();
        });
    }

    // Logout
    function logout() {
        alert('Logged out!');
        localStorage.clear();
        window.location.href = '/index/';
    }
}