console.log('firebaseConfig.js loaded');

window.firebaseAuthReady = new Promise((resolve) => {
    async function initializeFirebase() {
        if (window.isFirebaseInitialized) {
            console.log('Firebase already initialized');
            return firebase;
        }

        try {
            const response = await fetch('/.netlify/functions/getEnv');
            const data = await response.json();
            
            const config = {
                apiKey: data.env.FIREBASE_API_KEY,
                authDomain: data.env.FIREBASE_AUTH_DOMAIN,
                projectId: data.env.FIREBASE_PROJECT_ID,
                storageBucket: data.env.FIREBASE_STORAGE_BUCKET,
                messagingSenderId: data.env.FIREBASE_MESSAGING_SENDER_ID,
                appId: data.env.FIREBASE_APP_ID
            };

            firebase.initializeApp(config);
            window.isFirebaseInitialized = true;
            console.log('Firebase initialized successfully');

            // Add auth state observer
            firebase.auth().onAuthStateChanged((user) => {
                const currentPath = window.location.pathname;
                const isLoginPage = currentPath === '/admin/' || currentPath === '/admin/index.html';
                
                console.log('Auth State Changed:', {
                    user: user?.email,
                    currentPath,
                    isLoginPage
                });

                // Resolve the promise when we first get the auth state
                resolve(user);

                if (!user && !isLoginPage && 
                    (currentPath.includes('/admin/console.html') || 
                     currentPath.includes('/pages/tripview'))) {
                    window.location.href = '/admin/index.html';
                }
            });

            return firebase;
        } catch (error) {
            console.error('Error initializing Firebase:', error);
            throw error;
        }
    }

    initializeFirebase();
});

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

// Update the sign in function
async function handleEmailSignIn() {
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    
    if (!emailInput || !passwordInput) {
        showStatus('Error: Form inputs not found', 'error');
        return;
    }
    
    try {
        console.log('Starting email sign in...');
        showStatus('Signing in...', 'info');
        const userCredential = await firebase.auth().signInWithEmailAndPassword(emailInput.value, passwordInput.value);
        console.log('Sign in successful:', userCredential.user.email);
        showStatus('Sign in successful!', 'success');
        
        // Force redirect after successful login
        window.location.replace('/admin/console.html');
    } catch (error) {
        console.error('Email sign-in error:', error);
        let errorMessage = 'Sign in failed';
        if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
            errorMessage = 'Invalid email or password';
        }
        showStatus(errorMessage, 'error');
    }
}


/*
async function initializeFirebase() {
    console.log('initializeFirebase function called');

    // Check if Firebase is already initialized
    if (firebase.apps.length) {
        console.log('Firebase already initialized');
        return firebase;
    }

    try {
        
        //console.log('Fetching environment variables...');
        const response = await fetch('/.netlify/functions/getEnv');
        const data = await response.json();
        //console.log('Environment variables received:', data);
        console.log('Environment configuration loaded');
        
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
} */

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
    
    const response = await fetch('/.netlify/functions/getEnv');
    const data = await response.json();

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