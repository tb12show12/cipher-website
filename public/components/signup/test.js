class SignupModal {
    constructor() {
        this.currentStep = 1;
        this.userData = {
            birthday: null,
            displayName: '',
            location: '',
            profilePic: null,
            maritalStatus: '',
            hasChildren: false,
            childrenAges: []
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
                <div class="modal-content">
                    <div class="modal-nav">
                        <button class="back-to-methods" style="display: none;">
                            <i class="fas fa-arrow-left"></i> Back
                        </button>
                        <button class="close-btn">&times;</button>
                    </div>
                    
                    <div class="header-container">
                        <img src="/assets/Butterfly2.png" alt="Cipher" class="butterfly-icon">
                        <div class="modal-header">
                            <h2>Cipher</h2>
                            <p>Your travel memories, shared.</p>
                        </div>
                    </div>
                    
                    <div class="signup-methods">
                        <button class="email-signup-btn">
                            <i class="fas fa-envelope"></i> Sign up with Email
                        </button>
                        <button class="apple-signup-btn">
                            <i class="fab fa-apple"></i> Sign up with Apple
                        </button>
                    </div>

                    <form class="signup-form" style="display: none;">
                        <!-- Form content will be added by showEmailSignupForm -->
                    </form>
                </div>
            </div>
        `;
    }

    showEmailSignupForm() {
        const form = document.querySelector('.signup-form');
        const methods = document.querySelector('.signup-methods');
        const backBtn = document.querySelector('.back-to-methods');
        const header = document.querySelector('.modal-header h2');
        const subtitle = document.querySelector('.modal-header p');
        
        methods.style.display = 'none';
        backBtn.style.display = 'flex';
        form.innerHTML = this.generateEmailSignupHTML();
        form.style.display = 'block';
        header.textContent = 'Sign Up';
        subtitle.textContent = 'Create your account here.';
        
        this.initializeEmailValidation();
    }

    generateEmailSignupHTML() {
        return `
            <div class="form-step email-signup-step">
                <div class="form-group">
                    <input type="email" id="signupEmail" 
                           class="auth-input" 
                           placeholder="Email address" required>
                    <p class="error-message" id="emailError"></p>
                </div>

                <div class="form-group password-group">
                    <input type="password" id="signupPassword" 
                           class="auth-input" 
                           placeholder="Create password" required>
                </div>

                <div class="form-group">
                    <input type="password" id="confirmPassword" 
                           class="auth-input" 
                           placeholder="Confirm password" required>
                    <p class="error-message" id="confirmError"></p>
                    <p class="password-requirement" id="passwordRequirement">
                        Password must contain at least 8 characters, one uppercase letter, one number and one special character (!@#$%^&*(),.?":{}|<>)
                    </p>
                </div>

                <button type="button" id="createAccountBtn" 
                        class="create-account-btn">
                    Create Account
                </button>
            </div>
        `;
    }

    initializeEmailValidation() {
        const emailInput = document.getElementById('signupEmail');
        const passwordInput = document.getElementById('signupPassword');
        const confirmInput = document.getElementById('confirmPassword');
        const createBtn = document.getElementById('createAccountBtn');
        const backBtn = document.querySelector('.back-to-methods');
        const header = document.querySelector('.modal-header h2');
        const subtitle = document.querySelector('.modal-header p');
        
        
        backBtn.addEventListener('click', () => {
            document.querySelector('.signup-methods').style.display = 'flex';
            document.querySelector('.signup-form').style.display = 'none';
            backBtn.style.display = 'none';  // Hide back button
            header.textContent = 'Cipher';
            subtitle.textContent = 'Your travel memories, shared.';
        });

        passwordInput.addEventListener('input', () => {
            const password = passwordInput.value;
            const requirementElement = document.getElementById('passwordRequirement');
            
            this.passwordCriteria = {
                length: password.length >= 8,
                uppercase: /[A-Z]/.test(password),
                number: /[0-9]/.test(password),
                special: /[!@#$%^&*(),.?":{}|<>]/.test(password)
            };

            const isValid = Object.values(this.passwordCriteria).every(Boolean);
            requirementElement.className = isValid ? 'password-requirement valid' : 'password-requirement';

            this.validateForm();
        });

        confirmInput.addEventListener('input', () => {
            const confirmError = document.getElementById('confirmError');
            if (confirmInput.value && confirmInput.value !== passwordInput.value) {
                confirmError.textContent = 'Passwords do not match';
            } else {
                confirmError.textContent = '';
            }
            this.validateForm();
        });

        createBtn.addEventListener('click', () => {
            const isValid = Object.values(this.passwordCriteria).every(Boolean);
            if (!isValid) {
                const requirementElement = document.getElementById('passwordRequirement');
                requirementElement.classList.add('invalid');
                return;
            }
            
            console.log('Account would be created here');
            // For testing, show the next step
            this.showNextStep();
        });
    }

    validateForm() {
        const passwordInput = document.getElementById('signupPassword');
        const confirmInput = document.getElementById('confirmPassword');
        const createBtn = document.getElementById('createAccountBtn');

        const isPasswordValid = Object.values(this.passwordCriteria).every(Boolean);
        const doPasswordsMatch = passwordInput.value === confirmInput.value && confirmInput.value;

        createBtn.disabled = !(isPasswordValid && doPasswordsMatch);
    }

    showNextStep() {
        const form = document.querySelector('.signup-form');
        const header = document.querySelector('.modal-header h2');
        const subtitle = document.querySelector('.modal-header p');
        
        header.textContent = 'Finish Sign Up';
        subtitle.textContent = 'Tell us a little bit about yourself';
        
        form.innerHTML = `
            <div class="form-step">
                <div class="question-group">
                    <div class="question-content">
                        <label class="question">Enter your birthday?</label>
                        <p class="hint">You must be 13 or older.</p>
                    </div>
                    <input type="date" name="birthday" class="auth-input" required>
                </div>
            </div>

            <div class="form-step">
                <div class="question-group">
                    <div class="question-content">
                        <label class="question">Choose a display name</label>
                        <p class="hint">This will be unique to you.</p>
                    </div>
                    <input type="text" name="displayName" class="auth-input" maxlength="25" required>
                </div>
            </div>

            <div class="form-step">
                <div class="question-group">
                    <div class="question-content">
                        <label class="question">Where do you live?</label>
                        <p class="hint">We only show your city and state.</p>
                    </div>
                    <input type="text" name="location" class="auth-input" placeholder="City, State" maxlength="25">
                </div>
            </div>

            <div class="form-step">
                <div class="question-group">
                    <div class="question-content">
                        <label class="question">Add a profile photo</label>
                        <p class="hint">Help others recognize you</p>
                    </div>
                    <div class="profile-pic-upload">
                        <label for="profilePic" class="profile-pic-label">
                            <img src="/assets/defaultProfilePic.png" alt="Profile" class="preview-pic">
                            <div class="upload-overlay">
                                <i class="fas fa-camera"></i>
                            </div>
                        </label>
                        <input type="file" id="profilePic" name="profilePic" accept="image/*" hidden>
                    </div>
                </div>
            </div>

            <button type="button" class="create-account-btn">
                Finish!
            </button>
        `;

        this.initializeProfileForm();
    }

    initializeProfileForm() {
        const profilePicInput = document.getElementById('profilePic');
        const previewPic = document.querySelector('.preview-pic');

        profilePicInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => previewPic.src = e.target.result;
                reader.readAsDataURL(file);
            }
        });
    }
} 