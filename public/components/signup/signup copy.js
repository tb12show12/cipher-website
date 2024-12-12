import { DEFAULTS } from '/admin/config.js';

export function showAuthModal(mode = 'login') {
    const modal = new SignupModal();
    document.body.insertAdjacentHTML('beforeend', modal.generateModalHTML(mode));
    
    const modalElement = document.querySelector('.signup-modal');
    const closeBtn = modalElement.querySelector('.signup-close-btn');
    
    closeBtn.addEventListener('click', () => modalElement.remove());

    if (mode === 'login') {
        modal.initializeLoginForm(modalElement);
    } else {
        modal.initializeSignupForm(modalElement);
    }
}

class SignupModal {
    constructor() {
        this.currentStep = 1;
        this.userData = {
            birthday: null,
            displayName: '',
            location: '',
            profilePic: null
        };
        this.passwordCriteria = {
            length: false,
            uppercase: false,
            number: false,
            special: false
        };
    }

    generateModalHTML() {
        return `
            <div class="signup-modal">
                <div class="signup-modal-content">
                    <div class="signup-modal-nav">
                        <button class="signup-back-btn" style="display: none;">
                            <i class="fas fa-arrow-left"></i> Back
                        </button>
                        <button class="signup-close-btn">&times;</button>
                    </div>
                    
                    <div class="signup-header-container">
                        <img src="/assets/Butterfly2.png" alt="Cipher" class="signup-butterfly-icon">
                        <div class="signup-modal-header">
                            <h2>Cipher</h2>
                            <p>Your travel memories, shared.</p>
                        </div>
                    </div>
                    
                    <div class="signup-auth-methods">
                        <button class="signup-login-btn">
                            Login
                        </button>
                        <button class="signup-register-btn">
                            Sign Up
                        </button>
                        
                        <div class="signup-divider">
                            <span>Other Options</span>
                        </div>
                        
                        <button class="signup-apple-btn">
                            <i class="fab fa-apple"></i> Continue with Apple
                        </button>
                    </div>

                    <form class="signup-auth-form" style="display: none;">
                        <!-- Form content will be added dynamically -->
                    </form>
                </div>
            </div>
        `;
    }

    showEmailSignupForm(modalElement) {
        const methods = modalElement.querySelector('.signup-auth-methods');
        const form = modalElement.querySelector('.signup-auth-form');
        const backBtn = modalElement.querySelector('.signup-back-btn');
        const header = modalElement.querySelector('.signup-modal-header h2');
        const subtitle = modalElement.querySelector('.signup-modal-header p');
        
        methods.style.display = 'none';
        backBtn.style.display = 'flex';
        form.innerHTML = this.generateEmailSignupHTML();
        form.style.display = 'block';
        header.textContent = 'Sign Up';
        subtitle.textContent = 'Create your account here.';
        
        this.initializeEmailValidation(modalElement);
    }

    generateEmailSignupHTML() {
        return `
            <div class="signup-form-step signup-email-step">
                <div class="signup-form-group">
                    <input type="email" id="signupEmail" 
                           class="signup-auth-input" 
                           placeholder="Email address" required>
                    <p class="signup-error-message" id="emailError"></p>
                </div>

                <div class="signup-form-group signup-password-group">
                    <input type="password" id="signupPassword" 
                           class="signup-auth-input" 
                           placeholder="Create password" required>
                </div>

                <div class="signup-form-group">
                    <input type="password" id="confirmPassword" 
                           class="signup-auth-input" 
                           placeholder="Confirm password" required>
                    <p class="signup-error-message" id="confirmError"></p>
                    <p class="signup-password-requirement" id="passwordRequirement">
                        Password must contain at least 8 characters, one uppercase letter, one number and one special character (!@#$%^&*(),.?":{}|<>)
                    </p>
                </div>

                <button type="button" id="createAccountBtn" 
                        class="signup-auth-btn" disabled>
                    Create Account
                </button>
            </div>
        `;
    }

    initializeEmailValidation(modalElement) {
        const emailInput = modalElement.querySelector('#signupEmail');
        const passwordInput = modalElement.querySelector('#signupPassword');
        const confirmInput = modalElement.querySelector('#confirmPassword');
        const createBtn = modalElement.querySelector('#createAccountBtn');
        const emailError = modalElement.querySelector('#emailError');

        emailInput.addEventListener('input', () => {
            // Clear existing error message when user starts typing
            emailError.textContent = '';
        });
        
        createBtn.addEventListener('click', async () => {
            // Check password match when clicking button
            const confirmError = modalElement.querySelector('#confirmError');

            emailError.textContent = '';
            confirmError.textContent = '';

            if (passwordInput.value !== confirmInput.value) {
                confirmError.textContent = 'Passwords do not match';
                confirmError.style.color = '#dc3545';
                return;
            }

            try {
                createBtn.disabled = true;
                createBtn.textContent = 'Creating Account...';

                const email = emailInput.value;
                const password = passwordInput.value;

                // Create Firebase account
                const userCredential = await firebase.auth()
                    .createUserWithEmailAndPassword(email, password);

                this.showNextStep(userCredential.user, modalElement);

            } catch (error) {
                console.error('Account creation error:', error);
                const emailError = modalElement.querySelector('#emailError');
                
                if (error.code === 'auth/email-already-in-use') {
                    emailError.textContent = 'This email is already registered, please try again';
                    emailError.style.color = '#dc3545';
                    // Clear password fields
                    passwordInput.value = '';
                    confirmInput.value = '';
                    // Reset password validation
                    const requirementElement = modalElement.querySelector('#passwordRequirement');
                    requirementElement.style.display = 'block';
                    requirementElement.className = 'password-requirement';
                    // Reset confirm password error
                    confirmError.textContent = '';
                } else {
                    emailError.textContent = 'Error creating account. Please try again.';
                }
                
                createBtn.disabled = false;
                createBtn.textContent = 'Create Account';
            }
        });

        passwordInput.addEventListener('input', () => {
            const password = passwordInput.value;
            const requirementElement = modalElement.querySelector('#passwordRequirement');
            
            this.passwordCriteria = {
                length: password.length >= 8,
                uppercase: /[A-Z]/.test(password),
                number: /[0-9]/.test(password),
                special: /[!@#$%^&*(),.?":{}|<>]/.test(password)
            };

            const isValid = Object.values(this.passwordCriteria).every(Boolean);
            requirementElement.style.display = isValid ? 'none' : 'block';

            this.validateForm(modalElement);
        });

        // Remove password match validation from input event
        confirmInput.addEventListener('input', () => {
            const confirmError = modalElement.querySelector('#confirmError');
            confirmError.textContent = ''; // Just clear any existing error message
        });
    }

    validateForm(modalElement) {
        const passwordInput = modalElement.querySelector('input[id="signupPassword"]');
        const createBtn = modalElement.querySelector('button[id="createAccountBtn"]');

        // Only check password requirements, not matching
        const isPasswordValid = Object.values(this.passwordCriteria).every(Boolean);
        createBtn.disabled = !isPasswordValid;
    }

    async showNextStep(user, modalElement) {
        const form = modalElement.querySelector('.signup-auth-form');
        const header = modalElement.querySelector('.signup-modal-header h2');
        const subtitle = modalElement.querySelector('.signup-modal-header p');

        const modalContent = document.querySelector('.signup-modal-content');
        modalContent.style.maxWidth = '500px';
        
        header.textContent = 'Finish Sign Up';
        subtitle.textContent = 'Tell us a little bit about yourself';
        
        form.innerHTML = `
            <div class="signup-form-step">
                <div class="signup-question-group">
                    <div class="signup-question-content">
                        <label class="signup-question">Enter your birthday?</label>
                        <p class="signup-hint">You must be 13 or older.</p>
                    </div>
                    <input type="date" name="birthday" class="signup-auth-input" required>
                </div>
            </div>

            <div class="signup-form-step">
                <div class="signup-question-group">
                    <div class="signup-question-content">
                        <label class="signup-question">Choose a display name</label>
                        <p class="signup-hint">This will be unique to you.</p>
                    </div>
                    <input type="text" name="displayName" class="signup-auth-input" maxlength="25" required>
                </div>
            </div>

            <div class="signup-form-step">
                <div class="signup-question-group">
                    <div class="signup-question-content">
                        <label class="signup-question">Where do you live?</label>
                        <p class="signup-hint">We only show your city and state.</p>
                    </div>
                    <input type="text" name="location" class="signup-auth-input" placeholder="City, State" maxlength="25">
                </div>
            </div>

            <div class="signup-form-step">
                <div class="signup-question-group">
                    <div class="signup-question-content">
                        <label class="signup-question">Add a profile photo</label>
                        <p class="signup-hint">Help others recognize you</p>
                    </div>
                    <div class="signup-profile-pic-upload">
                        <label for="profilePic" class="signup-profile-pic-label">
                            <img src="${DEFAULTS.defaultPPic}" alt="Profile" class="signup-preview-pic">
                            <div class="signup-upload-overlay">
                                <i class="fas fa-camera"></i>
                            </div>
                        </label>
                        <input type="file" id="profilePic" name="profilePic" accept="image/*" hidden>
                    </div>
                </div>
            </div>

            <button type="button" class="signup-auth-btn">
                Finish!
            </button>
        `;

        this.user = user;
        this.initializeProfileForm(modalElement);
    }

    initializeProfileForm(modalElement) {
        const form = modalElement.querySelector('.signup-auth-form');
        const profilePicInput = modalElement.querySelector('#profilePic');
        const previewPic = modalElement.querySelector('.signup-preview-pic');
        const submitBtn = modalElement.querySelector('.signup-auth-btn');

        profilePicInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => previewPic.src = e.target.result;
                reader.readAsDataURL(file);
            }
        });

        submitBtn.addEventListener('click', async () => {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Creating Profile...';

            try {
                // Validate age
                const birthday = new Date(form.querySelector('input[name="birthday"]').value);
                if (!this.validateAge(birthday)) {
                    throw new Error('You must be 13 or older to use Cipher');
                }

                // Validate display name
                const displayName = form.querySelector('input[name="displayName"]').value;
                const isNameUnique = await this.checkDisplayNameUnique(displayName);
                if (!isNameUnique) {
                    throw new Error('This display name is already taken');
                }

                // Create user profile in Firestore
                await this.createUserProfile(this.user, form);
                
                // Redirect to appropriate page
                window.location.href = '/pages/tripview/tripview.html';

            } catch (error) {
                console.error('Profile creation error:', error);
                submitBtn.disabled = false;
                submitBtn.textContent = 'Finish!';
                // Show error message to user
                const errorMessage = document.createElement('p');
                errorMessage.className = 'error-message';
                errorMessage.textContent = error.message;
                submitBtn.parentNode.insertBefore(errorMessage, submitBtn);
            }
        });
    }

    validateAge(birthday) {
        const age = Math.floor((new Date() - birthday) / 31557600000);
        return age >= 13;
    }

    async checkDisplayNameUnique(displayName) {
        const snapshot = await firebase.firestore()
            .collection('users')
            .where('displayName', '==', displayName)
            .get();
        return snapshot.empty;
    }

    async createUserProfile(user, form) {
        // Convert birthday string to Firebase Timestamp
        const birthdayDate = new Date(form.querySelector('input[name="birthday"]').value);
        // Set to midnight UTC on the selected day
        birthdayDate.setUTCHours(0, 0, 0, 0);

        const profileData = {
            userId: user.uid,
            displayName: form.querySelector('input[name="displayName"]').value,
            birthday: firebase.firestore.Timestamp.fromDate(birthdayDate),
            location: form.querySelector('input[name="location"]').value,
            email: user.email,
            dateJoined: firebase.firestore.FieldValue.serverTimestamp(),
            trips: [],
            friends: [],
            followedBy: [],
            bookmarks: [],
            likes: [],
            recentActivity: [],
            pPic: DEFAULTS.defaultPPic,
            bPic: DEFAULTS.defaultBPic,
            maritalStatus: null,
            hasKids: null,
            kidAges: [],
        };

        // Handle profile picture upload if selected
        const profilePicInput = form.querySelector('input[name="profilePic"]');
        if (profilePicInput.files.length > 0) {
            const file = profilePicInput.files[0];
            const storageRef = firebase.storage().ref();
            const profilePicRef = storageRef.child(`profilePics/${user.uid}`);
            await profilePicRef.put(file);
            profileData.pPic = await profilePicRef.getDownloadURL();
        } else {
            profileData.pPic = DEFAULTS.defaultPPic;
        }

        // Create the user document in Firestore
        await firebase.firestore()
            .collection('users')
            .doc(user.uid)
            .set(profileData);
    }

    showLoginForm(modalElement) {
        const methods = modalElement.querySelector('.signup-auth-methods');
        const form = modalElement.querySelector('.signup-auth-form');
        const backBtn = modalElement.querySelector('.signup-back-btn');
        const header = modalElement.querySelector('.signup-modal-header h2');
        const subtitle = modalElement.querySelector('.signup-modal-header p');
        
        methods.style.display = 'none';
        backBtn.style.display = 'flex';
        header.textContent = 'Login';
        subtitle.textContent = 'Enter e-mail and password below.';
        
        form.innerHTML = `
            <div class="signup-form-step signup-login-step">
                <div class="signup-form-group">
                    <input type="email" id="loginEmail" 
                           class="signup-auth-input full-width" 
                           placeholder="Email address" required>
                </div>

                <div class="signup-form-group">
                    <input type="password" id="loginPassword" 
                           class="signup-auth-input full-width" 
                           placeholder="Password" required>
                </div>

                <div class="signup-error-container">
                    <p class="signup-error-message" id="loginError"></p>
                </div>

                <button type="button" id="loginBtn" class="signup-auth-btn">
                    Login
                </button>
            </div>
        `;
        
        form.style.display = 'block';
        this.initializeLoginForm(modalElement);
    }

    initializeLoginForm(modalElement) {
        const loginBtn = modalElement.querySelector('#loginBtn');
        const emailInput = modalElement.querySelector('#loginEmail');
        const passwordInput = modalElement.querySelector('#loginPassword');
        const errorMessage = modalElement.querySelector('#loginError');

        loginBtn.addEventListener('click', async () => {
            // Clear any existing error message
            errorMessage.textContent = '';
            
            try {
                loginBtn.disabled = true;
                loginBtn.textContent = 'Logging in...';

                const userCredential = await firebase.auth()
                    .signInWithEmailAndPassword(emailInput.value, passwordInput.value);
                
                window.location.href = '/admin/console.html';

            } catch (error) {
                //console.error('Login error:', error);
                
                // More specific error messages
                let errorText = 'Invalid email or password';
                if (error.code === 'auth/user-not-found') {
                    errorText = 'No account found with this email';
                } else if (error.code === 'auth/wrong-password') {
                    errorText = 'Incorrect password';
                } else if (error.code === 'auth/invalid-email') {
                    errorText = 'Please enter a valid email address';
                }
                
                if (errorMessage) {
                    errorMessage.textContent = errorText;
                    errorMessage.style.color = '#dc3545';
                }
                
                loginBtn.disabled = false;
                loginBtn.textContent = 'Login';
            }
        });

        // Add enter key support
        const handleEnterKey = (e) => {
            if (e.key === 'Enter') {
                loginBtn.click();
            }
        };
        
        emailInput.addEventListener('keypress', handleEnterKey);
        passwordInput.addEventListener('keypress', handleEnterKey);
    }
}