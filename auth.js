// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyBs_Xx7blYUpsTyXwhQPk59qtQwlt5RSqg",
    authDomain: "datting-1.firebaseapp.com",
    databaseURL: "https://datting-1-default-rtdb.firebaseio.com",
    projectId: "datting-1",
    storageBucket: "datting-1.firebasestorage.app",
    messagingSenderId: "370882374309",
    appId: "1:370882374309:web:f84b7f4badb601c26ebb4c",
    measurementId: "G-PRHCFHPYF3"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const database = firebase.database();
const storage = firebase.storage();

// Global Variables
let currentUser = null;

// DOM Elements
const loginForm = document.getElementById('loginForm');
const signupForm = document.getElementById('signupForm');
const loginFormElement = document.getElementById('loginFormElement');
const signupFormElement = document.getElementById('signupFormElement');
const loadingOverlay = document.getElementById('loadingOverlay');

// Check if user is already logged in
auth.onAuthStateChanged((user) => {
    if (user) {
        currentUser = user;
        console.log('User is logged in:', user.email);
        // Redirect to main app
        window.location.href = 'index.html';
    } else {
        console.log('No user is logged in');
    }
});

// Form Switching Functions
function showLoginForm() {
    loginForm.classList.add('active');
    signupForm.classList.remove('active');
    clearMessages();
}

function showSignupForm() {
    signupForm.classList.add('active');
    loginForm.classList.remove('active');
    clearMessages();
}

// Password Toggle
function togglePassword(inputId) {
    const input = document.getElementById(inputId);
    const icon = input.nextElementSibling;
    
    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    } else {
        input.type = 'password';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
    }
}

// Show Loading
function showLoading() {
    loadingOverlay.classList.add('active');
}

function hideLoading() {
    loadingOverlay.classList.remove('active');
}

// Show Messages
function showMessage(message, type = 'error') {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    messageDiv.textContent = message;
    
    const form = document.querySelector('.auth-form.active');
    form.insertBefore(messageDiv, form.firstChild);
    
    setTimeout(() => {
        messageDiv.remove();
    }, 5000);
}

function clearMessages() {
    document.querySelectorAll('.message').forEach(msg => msg.remove());
}

// Email/Password Login
loginFormElement.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    
    if (!email || !password) {
        showMessage('Please fill in all fields');
        return;
    }
    
    showLoading();
    
    try {
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        // Check if user profile exists
        const userRef = database.ref('users/' + user.uid);
        const snapshot = await userRef.once('value');
        
        if (!snapshot.exists()) {
            // Create basic profile if it doesn't exist
            await userRef.set({
                email: user.email,
                displayName: user.displayName || email.split('@')[0],
                photoURL: user.photoURL || null,
                createdAt: firebase.database.ServerValue.TIMESTAMP,
                lastLogin: firebase.database.ServerValue.TIMESTAMP
            });
        } else {
            // Update last login
            await userRef.update({
                lastLogin: firebase.database.ServerValue.TIMESTAMP
            });
        }
        
        showMessage('Login successful! Redirecting...', 'success');
        
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 1500);
        
    } catch (error) {
        console.error('Login error:', error);
        let errorMessage = 'Login failed';
        
        switch (error.code) {
            case 'auth/user-not-found':
                errorMessage = 'No account found with this email';
                break;
            case 'auth/wrong-password':
                errorMessage = 'Incorrect password';
                break;
            case 'auth/invalid-email':
                errorMessage = 'Invalid email format';
                break;
            case 'auth/user-disabled':
                errorMessage = 'Account has been disabled';
                break;
            default:
                errorMessage = error.message || 'Login failed';
        }
        
        showMessage(errorMessage);
    } finally {
        hideLoading();
    }
});

// Email/Password Signup
signupFormElement.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = document.getElementById('signupName').value.trim();
    const email = document.getElementById('signupEmail').value.trim();
    const age = parseInt(document.getElementById('signupAge').value);
    const password = document.getElementById('signupPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const ageVerification = document.getElementById('ageVerification').checked;
    
    // Validation
    if (!name || !email || !age || !password || !confirmPassword) {
        showMessage('Please fill in all fields');
        return;
    }
    
    if (!ageVerification) {
        showMessage('You must confirm you are 18+ years old');
        return;
    }
    
    if (age < 18) {
        showMessage('You must be 18+ to use Zair');
        return;
    }
    
    if (password.length < 6) {
        showMessage('Password must be at least 6 characters');
        return;
    }
    
    if (password !== confirmPassword) {
        showMessage('Passwords do not match');
        return;
    }
    
    showLoading();
    
    try {
        // Create user account
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        // Create user profile
        await database.ref('users/' + user.uid).set({
            displayName: name,
            email: email,
            age: age,
            photoURL: null,
            createdAt: firebase.database.ServerValue.TIMESTAMP,
            lastLogin: firebase.database.ServerValue.TIMESTAMP,
            isVerified: false,
            preferences: {
                lookingFor: 'both',
                ageRange: {
                    min: 18,
                    max: 65
                }
            }
        });
        
        showMessage('Account created successfully! Redirecting...', 'success');
        
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 1500);
        
    } catch (error) {
        console.error('Signup error:', error);
        let errorMessage = 'Registration failed';
        
        switch (error.code) {
            case 'auth/email-already-in-use':
                errorMessage = 'Email already registered';
                break;
            case 'auth/invalid-email':
                errorMessage = 'Invalid email format';
                break;
            case 'auth/operation-not-allowed':
                errorMessage = 'Email/password accounts are not enabled';
                break;
            case 'auth/weak-password':
                errorMessage = 'Password is too weak';
                break;
            default:
                errorMessage = error.message || 'Registration failed';
        }
        
        showMessage(errorMessage);
    } finally {
        hideLoading();
    }
});

// Google Sign-In
async function signInWithGoogle() {
    showLoading();
    
    try {
        const provider = new firebase.auth.GoogleAuthProvider();
        const userCredential = await auth.signInWithPopup(provider);
        const user = userCredential.user;
        
        // Check if user exists in database
        const userRef = database.ref('users/' + user.uid);
        const snapshot = await userRef.once('value');
        
        if (!snapshot.exists()) {
            // Create new user profile
            await userRef.set({
                displayName: user.displayName,
                email: user.email,
                photoURL: user.photoURL,
                age: null, // Will need to be updated
                createdAt: firebase.database.ServerValue.TIMESTAMP,
                lastLogin: firebase.database.ServerValue.TIMESTAMP,
                isVerified: user.emailVerified,
                preferences: {
                    lookingFor: 'both',
                    ageRange: {
                        min: 18,
                        max: 65
                    }
                }
            });
        } else {
            // Update last login
            await userRef.update({
                lastLogin: firebase.database.ServerValue.TIMESTAMP
            });
        }
        
        showMessage('Google sign-in successful! Redirecting...', 'success');
        
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 1500);
        
    } catch (error) {
        console.error('Google sign-in error:', error);
        let errorMessage = 'Google sign-in failed';
        
        switch (error.code) {
            case 'auth/popup-blocked':
                errorMessage = 'Popup blocked by browser';
                break;
            case 'auth/popup-closed-by-user':
                errorMessage = 'Sign-in cancelled';
                break;
            case 'auth/cancelled-popup-request':
                errorMessage = 'Sign-in cancelled';
                break;
            default:
                errorMessage = error.message || 'Google sign-in failed';
        }
        
        showMessage(errorMessage);
    } finally {
        hideLoading();
    }
}

// Password Reset Function
async function resetPassword(email) {
    if (!email) {
        showMessage('Please enter your email address');
        return;
    }
    
    showLoading();
    
    try {
        await auth.sendPasswordResetEmail(email);
        showMessage('Password reset email sent! Check your inbox.', 'success');
    } catch (error) {
        console.error('Password reset error:', error);
        showMessage('Failed to send reset email');
    } finally {
        hideLoading();
    }
}

// Auto-clear messages when switching forms
document.addEventListener('DOMContentLoaded', () => {
    // Add some interactive animations
    const inputs = document.querySelectorAll('.input-field input');
    inputs.forEach(input => {
        input.addEventListener('focus', function() {
            this.parentElement.classList.add('focused');
        });
        
        input.addEventListener('blur', function() {
            if (!this.value) {
                this.parentElement.classList.remove('focused');
            }
        });
    });
});

// Logout function (for future use)
async function logout() {
    try {
        await auth.signOut();
        window.location.href = 'auth.html';
    } catch (error) {
        console.error('Logout error:', error);
    }
}