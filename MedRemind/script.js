// DOM Elements
const medicineForm = document.getElementById('medicine-form');
const remindersList = document.getElementById('reminders-list');
const emptyState = document.getElementById('empty-state');

// Store reminders in local storage
let reminders = JSON.parse(localStorage.getItem('medReminders')) || [];

// Audio context for reminders
let reminderSound;
let audioContext;

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    // Initialize AOS
    AOS.init({
        duration: 800,
        easing: 'ease-in-out'
    });
    
    // Load saved reminders
    loadReminders();
    
    // Add event listeners
    medicineForm.addEventListener('submit', addReminder);
    
    // Request notification permission
    requestNotificationPermission();
    
    // Initialize audio
    initializeAudio();
});

// Initialize audio context and load sound
function initializeAudio() {
    // Create audio element for reminder sound
    reminderSound = new Audio();
    reminderSound.src = 'https://cdn.pixabay.com/download/audio/2021/08/04/audio_0625c1539c.mp3?filename=notification-sound-7062.mp3';
    reminderSound.preload = 'auto';
    
    // Test if Web Audio API is available
    try {
        window.AudioContext = window.AudioContext || window.webkitAudioContext;
        audioContext = new AudioContext();
    } catch (e) {
        console.warn('Web Audio API is not supported in this browser');
    }
    
    // Add volume control button to header
    const header = document.querySelector('header');
    const volumeControl = document.createElement('button');
    volumeControl.className = 'volume-control';
    volumeControl.innerHTML = '<i class="fas fa-volume-up"></i>';
    volumeControl.title = 'Test Sound';
    volumeControl.addEventListener('click', testSound);
    header.appendChild(volumeControl);
    
    // Add volume control styles
    const style = document.createElement('style');
    style.textContent = `
        .volume-control {
            position: absolute;
            top: 20px;
            right: 20px;
            background: rgb(0, 0, 0);
            border: none;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            cursor: pointer;
            transition: all 0.3s ease;
        }
        
        .volume-control:hover {
            background: rgba(255, 255, 255, 0.3);
        }
        
        header {
            position: relative;
        }
    `;
    document.head.appendChild(style);
}

// Test the reminder sound
function testSound() {
    playReminderSound();
    showNotification('Testing reminder sound', 'info');
}

// Play reminder sound
function playReminderSound() {
    // Stop any currently playing sound
    reminderSound.pause();
    reminderSound.currentTime = 0;
    
    // Play the sound
    reminderSound.play().catch(error => {
        console.error('Error playing sound:', error);
    });
    
    // Vibrate device if supported (mobile)
    if ('vibrate' in navigator) {
        navigator.vibrate([200, 100, 200]);
    }
}

// Register service worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
            .then(registration => {
                console.log('ServiceWorker registration successful with scope: ', registration.scope);
            })
            .catch(error => {
                console.log('ServiceWorker registration failed: ', error);
            });
    });
}

// Load reminders from local storage
function loadReminders() {
    if (reminders.length > 0) {
        emptyState.style.display = 'none';
        remindersList.innerHTML = '';
        
        // Sort reminders by time
        reminders.sort((a, b) => {
            return a.time.localeCompare(b.time);
        });
        
        reminders.forEach((reminder, index) => {
            createReminderElement(reminder, index);
            
            // Schedule notification for each reminder
            scheduleNotification(reminder);
        });
    } else {
        emptyState.style.display = 'flex';
    }
}

// Create a new reminder
function addReminder(e) {
    e.preventDefault();

    const medicineName = document.getElementById('medicine-name').value.trim();
    const dosage = document.getElementById('dosage').value.trim();
    const time = document.getElementById('time').value;
    const frequency = document.getElementById('frequency').value;
    const notes = document.getElementById('notes').value.trim();

    if (medicineName && dosage && time) {
        const reminder = {
            id: Date.now(),
            name: medicineName,
            dosage: dosage,
            time: time,
            frequency: frequency,
            notes: notes,
            created: new Date().toISOString(),
            lastTaken: null
        };

        // Add to reminders array
        reminders.push(reminder);
        
        // Save to local storage
        saveReminders();
        
        // Create UI element
        createReminderElement(reminder, reminders.length - 1);
        
        // Clear the form
        medicineForm.reset();
        
        // Hide empty state
        emptyState.style.display = 'none';
        
        // Set the reminder notification
        scheduleNotification(reminder);
        
        // Show success message
        showNotification('Reminder added successfully', 'success');
    } else {
        showNotification('Please fill out all required fields', 'error');
    }
}

// Create reminder element in the UI
function createReminderElement(reminder, index) {
    const li = document.createElement('li');
    li.className = 'reminder-card fade-in';
    li.dataset.index = index;
    
    // Format time for display
    const formattedTime = formatTime(reminder.time);
    
    // Format frequency for display
    const formattedFrequency = formatFrequency(reminder.frequency);
    
    // Calculate next dose time
    const nextDose = calculateNextDoseTime(reminder);
    const timeUntilNext = getTimeUntilNextDose(nextDose);
    
    li.innerHTML = `
        <div class="reminder-header">
            <div class="reminder-title">${reminder.name}</div>
            <div class="reminder-actions">
                <button class="take-btn" data-index="${index}" title="Mark as Taken">
                    <i class="fas fa-check"></i>
                </button>
                <button class="edit-btn" data-index="${index}" title="Edit">
                    <i class="fas fa-pen"></i>
                </button>
                <button class="delete-btn" data-index="${index}" title="Delete">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
        <div class="reminder-details">
            <div class="reminder-detail">
                <i class="fas fa-pills"></i>
                <span>${reminder.dosage}</span>
            </div>
            <div class="reminder-detail">
                <i class="fas fa-clock"></i>
                <span>${formattedTime}</span>
            </div>
            <div class="reminder-detail">
                <i class="fas fa-calendar-alt"></i>
                <span>${formattedFrequency}</span>
            </div>
            <div class="reminder-detail next-dose">
                <i class="fas fa-hourglass-half"></i>
                <span>${timeUntilNext}</span>
            </div>
        </div>
        ${reminder.notes ? `<div class="reminder-notes">${reminder.notes}</div>` : ''}
        ${reminder.lastTaken ? `<div class="last-taken">Last taken: ${formatLastTaken(reminder.lastTaken)}</div>` : ''}
    `;
    
    // Add to the list
    remindersList.appendChild(li);
    
    // Add event listeners to buttons
    li.querySelector('.delete-btn').addEventListener('click', () => deleteReminder(index));
    li.querySelector('.edit-btn').addEventListener('click', () => editReminder(index));
    li.querySelector('.take-btn').addEventListener('click', () => markAsTaken(index));
}

// Calculate the next dose time based on frequency
function calculateNextDoseTime(reminder) {
    const now = new Date();
    let nextDose = new Date(now.toDateString() + ' ' + reminder.time);
    
    // If the time has already passed today and it's not a twice-daily reminder
    if (nextDose < now && reminder.frequency !== 'twice-daily') {
        nextDose.setDate(nextDose.getDate() + 1);
    } else if (nextDose < now && reminder.frequency === 'twice-daily') {
        // For twice-daily, calculate the second dose of the day
        const [hours, minutes] = reminder.time.split(':');
        const secondDoseHour = (parseInt(hours) + 12) % 24;
        const secondDoseTime = `${secondDoseHour.toString().padStart(2, '0')}:${minutes}`;
        nextDose = new Date(now.toDateString() + ' ' + secondDoseTime);
        
        // If second dose has also passed, schedule for tomorrow
        if (nextDose < now) {
            nextDose = new Date(now.toDateString() + ' ' + reminder.time);
            nextDose.setDate(nextDose.getDate() + 1);
        }
    }
    
    return nextDose;
}

// Get formatted time until next dose
function getTimeUntilNextDose(nextDose) {
    const now = new Date();
    const diffMs = nextDose - now;
    
    if (diffMs <= 0) {
        return "Due now";
    }
    
    const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (diffHrs > 0) {
        return `Next dose in ${diffHrs}h ${diffMins}m`;
    } else {
        return `Next dose in ${diffMins}m`;
    }
}

// Format last taken time
function formatLastTaken(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
    
    if (diffHrs < 24) {
        // Today - show time only
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
        // Not today - show date and time
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
}

// Mark medication as taken
function markAsTaken(index) {
    const reminder = reminders[index];
    reminder.lastTaken = new Date().toISOString();
    
    // Update in storage
    saveReminders();
    
    // Update UI
    loadReminders();
    
    showNotification(`${reminder.name} marked as taken`, 'success');
}

// Delete a reminder
function deleteReminder(index) {
    if (confirm('Are you sure you want to delete this reminder?')) {
        // Cancel any scheduled notifications
        cancelScheduledNotification(reminders[index]);
        
        // Remove the UI element with animation
        const reminderElement = document.querySelector(`li[data-index="${index}"]`);
        reminderElement.classList.remove('fade-in');
        reminderElement.classList.add('fade-out');
        
        setTimeout(() => {
            // Remove from array
            reminders.splice(index, 1);
            
            // Save to local storage
            saveReminders();
            
            // Reload reminders to update indices
            loadReminders();
            
            // Show empty state if no reminders
            if (reminders.length === 0) {
                emptyState.style.display = 'flex';
            }
            
            showNotification('Reminder deleted', 'success');
        }, 400);
    }
}

// Edit a reminder
function editReminder(index) {
    const reminder = reminders[index];
    
    // Cancel any scheduled notifications for this reminder
    cancelScheduledNotification(reminder);
    
    // Fill the form with reminder data
    document.getElementById('medicine-name').value = reminder.name;
    document.getElementById('dosage').value = reminder.dosage;
    document.getElementById('time').value = reminder.time;
    document.getElementById('frequency').value = reminder.frequency;
    document.getElementById('notes').value = reminder.notes || '';
    
    // Scroll to form
    medicineForm.scrollIntoView({ behavior: 'smooth' });
    
    // Change button text
    const submitBtn = medicineForm.querySelector('button[type="submit"]');
    submitBtn.innerHTML = '<i class="fas fa-save"></i> Update Reminder';
    
    // Remove previous event listener
    const oldSubmitEvent = medicineForm.onsubmit;
    medicineForm.onsubmit = null;
    
    // Add new event listener for update
    medicineForm.addEventListener('submit', function updateHandler(e) {
        e.preventDefault();
        
        reminder.name = document.getElementById('medicine-name').value.trim();
        reminder.dosage = document.getElementById('dosage').value.trim();
        reminder.time = document.getElementById('time').value;
        reminder.frequency = document.getElementById('frequency').value;
        reminder.notes = document.getElementById('notes').value.trim();
        
        // Save to local storage
        saveReminders();
        
        // Reload reminders
        loadReminders();
        
        // Reset form
        medicineForm.reset();
        
        // Reset button text
        submitBtn.innerHTML = '<i class="fas fa-plus-circle"></i> Add Reminder';
        
        // Reset form submit event
        medicineForm.removeEventListener('submit', updateHandler);
        medicineForm.addEventListener('submit', addReminder);
        
        showNotification('Reminder updated successfully', 'success');
    });
}

// Save reminders to local storage
function saveReminders() {
    localStorage.setItem('medReminders', JSON.stringify(reminders));
}

// Cancel scheduled notification
function cancelScheduledNotification(reminder) {
    if (reminder.timeoutId) {
        clearTimeout(reminder.timeoutId);
    }
}

// Schedule notification
function scheduleNotification(reminder) {
    // Try to use notification triggers if available
    if ('Notification' in window && 'serviceWorker' in navigator && 'showTrigger' in Notification.prototype) {
        scheduleNotificationWithTrigger(reminder);
    } else {
        scheduleNotificationWithTimeout(reminder);
    }
}

// Schedule notification with trigger (more reliable, but not widely supported)
function scheduleNotificationWithTrigger(reminder) {
    const now = new Date();
    let reminderTime = new Date(now.toDateString() + ' ' + reminder.time);
    
    // If time has already passed today, schedule for tomorrow
    if (reminderTime < now) {
        reminderTime.setDate(reminderTime.getDate() + 1);
    }
    
    if (Notification.permission === 'granted') {
        navigator.serviceWorker.ready.then(registration => {
            registration.showNotification('MedRemind', {
                body: `Time to take ${reminder.name} - ${reminder.dosage}`,
                icon: 'favicon.ico',
                badge: 'favicon.ico',
                tag: `med-reminder-${reminder.id}`,
                showTrigger: new TimestampTrigger(reminderTime.getTime()),
                actions: [
                    { action: 'take', title: 'Take Now' },
                    { action: 'snooze', title: 'Snooze' }
                ],
                data: {
                    reminderId: reminder.id
                }
            });
        });
    } else if (Notification.permission !== 'denied') {
        requestNotificationPermission();
    }
}

// Schedule notification with timeout (traditional method)
function scheduleNotificationWithTimeout(reminder) {
    const now = new Date();
    let reminderTime = new Date(now.toDateString() + ' ' + reminder.time);
    
    // If time has already passed today, schedule for tomorrow
    if (reminderTime < now) {
        reminderTime.setDate(reminderTime.getDate() + 1);
    }
    
    const timeDifference = reminderTime - now;
    
    if (timeDifference > 0) {
        // Store the timeout ID so we can cancel it if needed
        const timeoutId = setTimeout(() => {
            if (Notification.permission === 'granted') {
                playReminderSound();
                
                const notification = new Notification('MedRemind', {
                    body: `Time to take ${reminder.name} - ${reminder.dosage}`,
                    icon: 'favicon.ico',
                    badge: 'favicon.ico', // For mobile devices
                    tag: `med-reminder-${reminder.id}`, // Unique identifier
                    requireInteraction: true, // Keep notification until user interacts with it
                    actions: [
                        { action: 'take', title: 'Take Now' },
                        { action: 'snooze', title: 'Snooze' }
                    ],
                    data: {
                        reminderId: reminder.id
                    }
                });
                
                // Handle notification click
                notification.onclick = function() {
                    window.focus();
                    
                    // Find the reminder index
                    const reminderIndex = reminders.findIndex(r => r.id === reminder.id);
                    if (reminderIndex !== -1) {
                        markAsTaken(reminderIndex);
                    }
                    
                    this.close();
                };
                
            } else if (Notification.permission !== 'denied') {
                // Try requesting permission again
                requestNotificationPermission();
                alert(`Reminder: Time to take ${reminder.name} - ${reminder.dosage}`);
                playReminderSound();
            } else {
                alert(`Reminder: Time to take ${reminder.name} - ${reminder.dosage}`);
                playReminderSound();
            }
            
            // If daily or twice-daily, schedule for next occurrence
            if (reminder.frequency === 'daily') {
                // Schedule for tomorrow
                const nextReminder = {...reminder};
                scheduleNotification(nextReminder);
            } else if (reminder.frequency === 'twice-daily') {
                // Schedule for 12 hours later
                const nextReminder = {...reminder};
                const [hours, minutes] = reminder.time.split(':');
                const nextHour = (parseInt(hours) + 12) % 24;
                nextReminder.time = `${nextHour.toString().padStart(2, '0')}:${minutes}`;
                scheduleNotification(nextReminder);
            }
        }, timeDifference);
        
        // Store timeout ID with the reminder for potential cancellation
        reminder.timeoutId = timeoutId;
    }
}

// Request notification permission
function requestNotificationPermission() {
    if ('Notification' in window) {
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                console.log('Notification permission granted');
            } else {
                console.log('Notification permission denied');
                showNotification('Please enable notifications for reminders to work properly', 'info');
            }
        });
    } else {
        showNotification('Your browser does not support notifications', 'error');
    }
}

// Format time for display (12-hour format)
function formatTime(timeString) {
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const formattedHour = hour % 12 || 12;
    return `${formattedHour}:${minutes} ${ampm}`;
}

// Format frequency for display
function formatFrequency(frequency) {
    switch (frequency) {
        case 'once':
            return 'One time';
        case 'daily':
            return 'Daily';
        case 'twice-daily':
            return 'Twice daily';
        case 'custom':
            return 'Custom schedule';
        default:
            return frequency;
    }
}

// Show notification message
function showNotification(message, type) {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'info' ? 'fa-info-circle' : 'fa-exclamation-circle'}"></i>
            <span>${message}</span>
        </div>
    `;
    
    // Add to body
    document.body.appendChild(notification);
    
    // Show notification
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);
    
    // Remove after 3 seconds
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 3000);
}

// Set up periodic checks for upcoming reminders
function setupPeriodicChecks() {
    // Check every minute
    setInterval(() => {
        updateReminderTimes();
    }, 60000);
    
    // Initial check
    updateReminderTimes();
}

// Update the display of upcoming reminder times
function updateReminderTimes() {
    reminders.forEach((reminder, index) => {
        const nextDose = calculateNextDoseTime(reminder);
        const timeUntilNext = getTimeUntilNextDose(nextDose);
        
        const reminderElement = document.querySelector(`li[data-index="${index}"] .next-dose span`);
        if (reminderElement) {
            reminderElement.textContent = timeUntilNext;
            
            // Highlight if due soon
            if (timeUntilNext === "Due now") {
                reminderElement.parentElement.classList.add('due-now');
            } else {
                reminderElement.parentElement.classList.remove('due-now');
            }
        }
    });
}

// Add notification styles to the document
const notificationStyles = document.createElement('style');
notificationStyles.textContent = `
    .notification {
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        border-radius: 8px;
        background: white;
        box-shadow: 0 3px 10px rgba(0, 0, 0, 0.1);
        transform: translateX(120%);
        transition: transform 0.3s ease;
        z-index: 1000;
        max-width: 300px;
    }
    
    .notification.show {
        transform: translateX(0);
    }
    
    .notification.success {
        border-left: 4px solid #28a745;
    }
    
    .notification.error {
        border-left: 4px solid #dc3545;
    }
    
    .notification.info {
        border-left: 4px solid #17a2b8;
    }
    
    .notification-content {
        display: flex;
        align-items: center;
        gap: 10px;
    }
    
    .notification i {
        font-size: 1.2rem;
    }
    
    .notification.success i {
        color: #28a745;
    }
    
    .notification.error i {
        color: #dc3545;
    }
    
    .notification.info i {
        color: #17a2b8;
    }
    
    .take-btn {
        color: var(--success-color);
    }
    
    .take-btn:hover {
        background-color: rgba(40, 167, 69, 0.1);
    }
    
    .last-taken {
        font-size: 0.8rem;
        color: var(--light-text);
        margin-top: 5px;
        font-style: italic;
    }
    
    .next-dose {
        font-weight: 500;
    }
    
    .due-now {
        color: var(--danger-color) !important;
        font-weight: 600;
        animation: pulse 1.5s infinite;
    }
    
    @keyframes pulse {
        0% {
            opacity: 1;
        }
        50% {
            opacity: 0.6;
        }
        100% {
            opacity: 1;
        }
    }
`;
document.head.appendChild(notificationStyles);

// Start periodic checks
setupPeriodicChecks();

// Handle service worker messages
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', event => {
        // Handle notification actions
        if (event.data && event.data.action) {
            const reminderId = event.data.reminderId;
            const action = event.data.action;
            
            // Find the reminder
            const reminderIndex = reminders.findIndex(r => r.id === reminderId);
            if (reminderIndex !== -1) {
                if (action === 'take') {
                    markAsTaken(reminderIndex);
                } else if (action === 'snooze') {
                    // Snooze the reminder for 10 minutes
                    const reminderToSnooze = reminders[reminderIndex];
                    setTimeout(() => {
                        playReminderSound();
                        showNotification(`Reminder: Take ${reminderToSnooze.name} - ${reminderToSnooze.dosage}`, 'info');
                    }, 10 * 60 * 1000);
                }
            }
        }
    });
}

// Export reminders to file
function exportReminders() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(reminders));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "medreminders.json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    document.body.removeChild(downloadAnchor);
}

// Import reminders from file
function importReminders(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(event) {
        try {
            const importedReminders = JSON.parse(event.target.result);
            if (Array.isArray(importedReminders)) {
                reminders = importedReminders;
                saveReminders();
                loadReminders();
                showNotification('Reminders imported successfully', 'success');
            } else {
                throw new Error('Invalid format');
            }
        } catch (error) {
            showNotification('Failed to import reminders. Invalid file format.', 'error');
        }
    };
    reader.readAsText(file);
}
// Service worker for MedRemind

const CACHE_NAME = 'medremind-cache-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/favicon.ico',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/aos/2.3.4/aos.css',
  'https://cdnjs.cloudflare.com/ajax/libs/aos/2.3.4/aos.js'
];

// Install event - cache assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// Fetch event - respond with cached assets
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - return response
        if (response) {
          return response;
        }
        return fetch(event.request).then(
          response => {
            // Check if we received a valid response
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Clone the response
            const responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });

            return response;
          }
        );
      })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Notification click event
self.addEventListener('notificationclick', event => {
  event.notification.close();
  
  const reminderId = event.notification.data?.reminderId;
  const action = event.action;
  
  if (reminderId) {
    const message = {
      reminderId: reminderId,
      action: action || 'default'
    };
    
    // Send message to main thread
    self.clients.matchAll().then(clients => {
      clients.forEach(client => {
        client.postMessage(message);
      });
    });
  }
  
  // Focus or open the app
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(clients => {
      if (clients.length > 0) {
        clients[0].focus();
      } else {
        self.clients.openWindow('/');
      }
    })
  );
});

// Push notification event
self.addEventListener('push', event => {
  if (event.data) {
    const data = event.data.json();
    
    event.waitUntil(
      self.registration.showNotification('MedRemind', {
        body: data.body || 'Time to take your medication',
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        requireInteraction: true,
        actions: [
          { action: 'take', title: 'Take Now' },
          { action: 'snooze', title: 'Snooze' }
        ],
        data: data
      })
    );
  }
});