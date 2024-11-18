console.log('firebaseConfig.js loaded');

// Utility functions first
function showStatus(message, type = 'info') {
    const statusDiv = document.getElementById('authStatus');
    if (statusDiv) {
        statusDiv.textContent = message;
        statusDiv.className = `status-message ${type}`;
        statusDiv.style.display = 'block';
    } else {
        console.error('Status div not found');
    }
}

async function initializeFirebase() {
    console.log('initializeFirebase function called');

    // Check if Firebase is already initialized
    if (firebase.apps.length) {
        console.log('Firebase already initialized');
        return firebase;
    }

    try {
        
        console.log('Fetching environment variables...');
        const response = await fetch('/.netlify/functions/getEnv');
        const data = await response.json();
        console.log('Environment variables received:', data);
        
        const config = {
            apiKey: data.env.FIREBASE_API_KEY,
            authDomain: data.env.FIREBASE_AUTH_DOMAIN,
            projectId: data.env.FIREBASE_PROJECT_ID,
            storageBucket: data.env.FIREBASE_STORAGE_BUCKET,
            messagingSenderId: data.env.FIREBASE_MESSAGING_SENDER_ID,
            appId: data.env.FIREBASE_APP_ID
        };

        console.log('Initializing Firebase...');
        firebase.initializeApp(config);
        console.log('Firebase initialized successfully');

        // Add auth state observer
        await new Promise((resolve) => {
            const unsubscribe = firebase.auth().onAuthStateChanged((user) => {
                if (user) {
                    console.log('User is signed in:', user.email);
                    sessionStorage.setItem('isAuthenticated', 'true');
                    sessionStorage.setItem('userId', user.uid);
                } else {
                    console.log('User is signed out');
                    sessionStorage.removeItem('isAuthenticated');
                    sessionStorage.removeItem('userId');
                }
                unsubscribe(); // Unsubscribe after first auth state change
                resolve();
            });
        });
        return firebase;
        
    } catch (error) {
        console.error('Error initializing Firebase:', error);
        showStatus('Error initializing application', 'error');
        throw error;

    }
}

// Just show/hide the email form
function handleEmailAuth() {
    const emailForm = document.getElementById('emailAuthForm');
    if (emailForm) {
        if (emailForm.style.display === 'none') {
            emailForm.style.display = 'flex';
            document.body.style.overflow = 'hidden'; // Prevent background scrolling
        } else {
            document.getElementById('email').value = '';
            document.getElementById('password').value = '';
            emailForm.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
    }
}

// Add click outside to close
document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('emailAuthForm');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                handleEmailAuth();
            }
        });
    }
});

// Add this function to show the choice dialog
function showTripChoiceDialog() {
    const dialog = document.createElement('div');
    dialog.className = 'trip-choice-dialog';
    dialog.innerHTML = `
        <div class="dialog-content">
            <h2>What would you like to do?</h2>
            <button id="createTrip" class="choice-button">Create New Trip</button>
            <button id="editTrip" class="choice-button">Edit Existing Trip</button>
        </div>
    `;
    document.body.appendChild(dialog);

    dialog.querySelector('#createTrip').addEventListener('click', () => {
        window.location.href = '/admin/newtrip.html';
    });

    dialog.querySelector('#editTrip').addEventListener('click', () => {
        window.location.href = '/admin/edittrip.html';
    });
}

// Update the handleEmailSignIn function
async function handleEmailSignIn() {
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    
    if (!emailInput || !passwordInput) {
        showStatus('Error: Form inputs not found', 'error');
        return;
    }
    
    try {
        showStatus('Signing in...', 'info');
        await firebase.auth().signInWithEmailAndPassword(emailInput.value, passwordInput.value);
        window.location.href = '/admin/console.html';  // Changed this line
    } catch (error) {
        console.error('Email sign-in error:', error);
        let errorMessage = 'Sign in failed';
        if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
            errorMessage = 'Invalid email or password';
        }
        showStatus(errorMessage, 'error');
    }
}

async function handleAppleSignIn() {
    try {
        showStatus('Signing in...', 'info');
        const provider = new firebase.auth.OAuthProvider('apple.com');
        provider.addScope('email');
        provider.addScope('name');
        
        const result = await firebase.auth().signInWithPopup(provider);
        console.log('Apple sign-in successful:', result.user.email);
        showStatus('Sign in successful!', 'success');
        window.location.href = '/admin/console.html';  // Changed this line
    } catch (error) {
        console.error('Apple sign-in error:', error);
        let errorMessage = 'Sign in failed';
        if (error.code === 'auth/popup-closed-by-user') {
            errorMessage = 'Sign in cancelled';
        }
        showStatus(errorMessage, 'error');
    }
}

// Revised admin auth handler to log in with admin creds
async function handleAdminAuth() {
    const password = document.getElementById('adminPassword').value;
    
    console.log('Fetching admin env...');
    const response = await fetch('/.netlify/functions/getEnv');
    const data = await response.json();
    console.log('Environment variables received:', data);

    if (password === data.env.ANON_PASSWORD){
        try {
            showStatus('Signing in...', 'info');
            await firebase.auth().signInWithEmailAndPassword('anon@cipher-app.com', password);
            showStatus('Sign in successful!', 'success');
            window.location.href = '/admin/console.html';  // Changed this line
        } catch (error) {
            console.error('Email sign-in error:', error);
            let errorMessage = 'Sign in failed';
            if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
                errorMessage = 'Invalid email or password';
            }
            showStatus(errorMessage, 'error');
        }
    } else{
        showStatus('Authentication failed: invalid admin password', 'error');
    }
}