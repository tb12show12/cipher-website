import { DEFAULTS } from '/utils/config.js';

export function showAuthModal(mode = 'login') {
    const modal = new SignupModal();
    document.body.insertAdjacentHTML('beforeend', modal.generateModalHTML(mode));
    
    const modalElement = document.querySelector('.signup-modal');
    const closeBtn = modalElement.querySelector('.signup-close-btn');
    
    closeBtn.addEventListener('click', () => modalElement.remove());

    if (mode === 'login') {
        modal.initializeLoginForm(modalElement);
    } else {
        modal.initializeEmailValidation(modalElement);
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

    generateModalHTML(mode) {
        return `
            <div class="signup-modal">
                <div class="signup-modal-content">
                    <div class="signup-modal-nav">
                        <button class="signup-close-btn">&times;</button>
                    </div>
                    
                    <div class="signup-header-container">
                        <img src="/assets/Butterfly2.png" alt="Cipher" class="signup-butterfly-icon">
                        <div class="signup-modal-header">
                            <h2>${mode === 'login' ? 'Login' : 'Sign Up'}</h2>
                            <p>${mode === 'login' ? 'Enter e-mail and password below.' : 'Create your account here.'}</p>
                        </div>
                    </div>
                    
                    <form class="signup-auth-form">
                        ${mode === 'login' ? this.generateLoginHTML() : this.generateSignupHTML()}
                    </form>
                </div>
            </div>
        `;
    }

    generateLoginHTML() {
        return `
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

                <a href="#" id="forgotPasswordLink" class="signup-forgot-password">Forgot Password?</a>
            </div>
        `;
    }

    generateSignupHTML() {
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
                        Password must contain at least 8 characters, one uppercase letter, 
                        one number and one special character (!@#$%^&*(),.?":{}|<>)
                    </p>
                </div>

                <button type="button" id="createAccountBtn" 
                        class="signup-auth-btn" disabled>
                    Next
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
            emailError.textContent = '';
        });
        
        createBtn.addEventListener('click', async () => {
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

                const userCredential = await firebase.auth()
                    .createUserWithEmailAndPassword(emailInput.value, passwordInput.value);

                this.showNextStep(userCredential.user, modalElement);

            } catch (error) {
                console.error('Account creation error:', error);
                const emailError = modalElement.querySelector('#emailError');
                
                if (error.code === 'auth/email-already-in-use') {
                    emailError.textContent = 'This email is already registered, please try again';
                    emailError.style.color = '#dc3545';
                    passwordInput.value = '';
                    confirmInput.value = '';
                    const requirementElement = modalElement.querySelector('#passwordRequirement');
                    requirementElement.style.display = 'block';
                    requirementElement.className = 'signup-password-requirement';
                    confirmError.textContent = '';
                } else {
                    emailError.textContent = 'Error creating account. Please try again.';
                }
                
                createBtn.disabled = false;
                createBtn.textContent = 'Next';
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

        confirmInput.addEventListener('input', () => {
            const confirmError = modalElement.querySelector('#confirmError');
            confirmError.textContent = '';
        });
    }

    validateForm(modalElement) {
        const createBtn = modalElement.querySelector('button[id="createAccountBtn"]');
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

            form.querySelectorAll('.error-message').forEach(error => {
                error.remove();
            });

            try {
                const birthday = new Date(form.querySelector('input[name="birthday"]').value);
                if (!this.validateAge(birthday)) {
                    throw new Error('You must be 13 or older to use Cipher');
                }

                const displayName = form.querySelector('input[name="displayName"]').value;
                const isNameUnique = await this.checkDisplayNameUnique(displayName);
                if (!isNameUnique) {
                    throw new Error('This display name is already taken');
                }

                await this.createUserProfile(this.user, form);
                window.location.href = '/pages/navigate/navigate.html';

            } catch (error) {
                console.error('Profile creation error:', error);
                submitBtn.disabled = false;
                submitBtn.textContent = 'Finish!';
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
        console.log('Create user profile function called', user);
        const birthdayDate = new Date(form.querySelector('input[name="birthday"]').value);
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

        const profilePicInput = form.querySelector('input[name="profilePic"]');
        if (profilePicInput.files.length > 0) {
            const file = profilePicInput.files[0];
            const storageRef = firebase.storage().ref();
            const profilePicRef = storageRef.child(`profilePics/${user.uid}`);
            await profilePicRef.put(file);
            profileData.pPic = await profilePicRef.getDownloadURL();
        }

        await firebase.firestore()
            .collection('users')
            .doc(user.uid)
            .set(profileData);
    }

    initializeLoginForm(modalElement) {
        const loginBtn = modalElement.querySelector('#loginBtn');
        const emailInput = modalElement.querySelector('#loginEmail');
        const passwordInput = modalElement.querySelector('#loginPassword');
        const errorMessage = modalElement.querySelector('#loginError');
        const forgotPasswordLink = modalElement.querySelector('#forgotPasswordLink');

        loginBtn.addEventListener('click', async () => {
            errorMessage.textContent = '';
            
            try {
                loginBtn.disabled = true;
                loginBtn.textContent = 'Logging in...';

                const userCredential = await firebase.auth()
                    .signInWithEmailAndPassword(emailInput.value, passwordInput.value);
                
                window.location.href = '/pages/navigate/navigate.html';

            } catch (error) {
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

        const handleEnterKey = (e) => {
            if (e.key === 'Enter') {
                loginBtn.click();
            }
        };
        
        emailInput.addEventListener('keypress', handleEnterKey);
        passwordInput.addEventListener('keypress', handleEnterKey);
        forgotPasswordLink.addEventListener('click', (e) => {
            e.preventDefault();
            modalElement.remove();
            this.showForgotPasswordModal();
        });
    }

    async showUserInfoStep(user) {
        console.log('🎨 Starting to show user info step');
        const modalHTML = `
        <div class="signup-modal">
            <div class="signup-modal-content" style="max-width: 500px;">
                <div class="signup-modal-nav">
                    <button class="signup-close-btn" id="signupCloseBtn">&times;</button>
                </div>
                <div class="signup-header-container">
                    <img src="/assets/Butterfly2.png" alt="Cipher" class="signup-butterfly-icon">
                    <div class="signup-modal-header">
                        <h2>Finish Sign Up</h2>
                        <p>Tell us a little about yourself</p>
                    </div>
                </div>
                <form class="signup-auth-form">
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

                    <button type="button" id="completeSignupBtn" class="signup-auth-btn">
                        Finish!
                    </button>
                </form>
            </div>
        </div>
    `;
    
        // Add modal to page
        const modalWrapper = document.createElement('div');
        modalWrapper.innerHTML = modalHTML;
        document.body.appendChild(modalWrapper.firstElementChild);
        console.log('🎭 Modal added to DOM');
    
        const modalElement = document.querySelector('.signup-modal');
        console.log('🔍 Modal element found:', modalElement);

        const profilePicInput = modalElement.querySelector('#profilePic');
        const previewPic = modalElement.querySelector('.signup-preview-pic');

        profilePicInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => previewPic.src = e.target.result;
                reader.readAsDataURL(file);
            }
        });
                
        const closeBtn = modalElement.querySelector('#signupCloseBtn');
        console.log('Found close button:', closeBtn);
        
        if (closeBtn) {
            closeBtn.addEventListener('click', async () => {
                console.log('Close button clicked!');
                try {
                    await firebase.auth().signOut();
                    console.log('User signed out successfully');
                    window.location.href = '/';
                } catch (error) {
                    console.error('Error signing out:', error);
                }
            });
        } else {
            console.error('Could not find close button!');
        }

        // Get form elements and setup finish button
        const completeBtn = modalElement.querySelector('#completeSignupBtn');
        const form = modalElement.querySelector('.signup-auth-form');

        completeBtn.addEventListener('click', async () => {
            try {
                // Clear any existing error messages
                modalElement.querySelectorAll('.error-message').forEach(error => {
                    error.remove();
                });

                const birthday = new Date(form.querySelector('input[name="birthday"]').value);
                if (!this.validateAge(birthday)) {
                    throw new Error('You must be 13 or older to use Cipher');
                }

                const displayName = form.querySelector('input[name="displayName"]').value;
                if (!displayName) {
                    throw new Error('Display name cannot be empty');
                }

                const isNameUnique = await this.checkDisplayNameUnique(displayName);
                if (!isNameUnique) {
                    throw new Error('This display name is already taken');
                }

                await this.createUserProfile(user, form);
                window.location.href = '/pages/navigate/navigate.html';

            } catch (error) {
                console.error('Profile creation error:', error);
                completeBtn.disabled = false;
                completeBtn.textContent = 'Finish!';
                const errorMessage = document.createElement('p');
                errorMessage.className = 'error-message';
                errorMessage.textContent = error.message;
                completeBtn.parentNode.insertBefore(errorMessage, completeBtn);
            }
        });
    }

    showForgotPasswordModal() {
        const modalHTML = `
            <div class="signup-modal">
                <div class="signup-modal-content" style="max-width: 400px;">
                    <div class="signup-modal-nav">
                        <button class="signup-close-btn">&times;</button>
                    </div>
                    
                    <div class="signup-header-container">
                        <img src="/assets/Butterfly2.png" alt="Cipher" class="signup-butterfly-icon">
                        <div class="signup-modal-header">
                            <h2>Reset Password</h2>
                            <p>Enter your email to receive a password reset link</p>
                        </div>
                    </div>
    
                    <form class="signup-auth-form">
                        <input type="email" id="resetEmail" class="signup-auth-input" placeholder="Email" required>
                        <p id="resetError" class="signup-error-message"></p>
                        <button type="button" id="sendResetBtn" class="signup-auth-btn">
                            Send Reset Link
                        </button>
                    </form>
                </div>
            </div>
        `;
    
        // Remove any existing modals
        const existingModal = document.querySelector('.signup-modal');
        if (existingModal) {
            existingModal.remove();
        }
    
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    
        const modalElement = document.querySelector('.signup-modal');
        const closeBtn = modalElement.querySelector('.signup-close-btn');
        const resetBtn = modalElement.querySelector('#sendResetBtn');
        const emailInput = modalElement.querySelector('#resetEmail');
        const errorMessage = modalElement.querySelector('#resetError');
    
        closeBtn.addEventListener('click', () => modalElement.remove());
        modalElement.addEventListener('click', (e) => {
            if (e.target === modalElement) modalElement.remove();
        });
    
        resetBtn.addEventListener('click', async () => {
            errorMessage.textContent = '';
            const email = emailInput.value;
    
            try {
                resetBtn.disabled = true;
                resetBtn.textContent = 'Sending...';
    
                await firebase.auth().sendPasswordResetEmail(email);
                
                // Show success message
                errorMessage.textContent = 'Reset link sent! You will receive a password reset e-mail if you have an active Cipher account.';
                errorMessage.style.color = '#2E7D32';
                
                // Remove modal after delay
                setTimeout(() => {
                    modalElement.remove();
                }, 3000);
    
            } catch (error) {
                let errorText = 'Failed to send reset link';
                if (error.code === 'auth/user-not-found') {
                    errorText = 'No account found with this email';
                } else if (error.code === 'auth/invalid-email') {
                    errorText = 'Please enter a valid email address';
                }
                
                errorMessage.textContent = errorText;
                errorMessage.style.color = '#dc3545';
                resetBtn.disabled = false;
                resetBtn.textContent = 'Send Reset Link';
            }
        });
    }

    


}

export default SignupModal;