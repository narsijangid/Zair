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

// Global variables
let currentUser = null;
let userProfile = null;
let localStream = null;
let remoteStream = null;
let peerConnection = null;
let currentUserId = null;
let currentPartnerId = null;
let isVideoStarted = false;
let isMuted = false;
let waitingForPartner = false;

// WebRTC configuration with enhanced STUN and TURN servers
const servers = {
    iceServers: [
        // Google STUN servers
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' },
        
        // Additional STUN servers
        { urls: 'stun:stun01.sipphone.com' },
        { urls: 'stun:stun.ekiga.net' },
        { urls: 'stun:stun.fwdnet.net' },
        { urls: 'stun:stun.ideasip.com' },
        { urls: 'stun:stun.iptel.org' },
        { urls: 'stun:stun.rixtelecom.se' },
        { urls: 'stun:stun.schlund.de' },
        
        // TURN servers for NAT traversal
        { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
        { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
        { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
        
        // Additional TURN servers
        { urls: 'turn:numb.viagenie.ca', username: 'webrtc@live.com', credential: 'muazkh' },
        { urls: 'turn:turn.bistri.com:80', username: 'homeo', credential: 'homeo' },
        { urls: 'turn:turn.anyfirewall.com:443?transport=tcp', username: 'webrtc', credential: 'webrtc' }
    ],
    iceCandidatePoolSize: 10
};

// DOM Elements - will be initialized in DOMContentLoaded
let chatOverlay, chatIconWrapper, chatBadge, localVideo, remoteVideo, videoPlaceholder, status, chatMessages, messageInput;
let startBtn, connectBtn, skipBtn, stopBtn, micBtn, videoBtn;
let profileSidebar, sidebarOverlay, profileImage, profileName, profileEmail, profileAge, connectionsCount, matchesCount;
let actionMenuBtn;

// Check authentication state
auth.onAuthStateChanged(async (user) => {
    if (user) {
        currentUser = user;
        currentUserId = user.uid;
        await loadUserProfile();
        updateProfileDisplay();
        updateUserCount(); // Initialize user count tracking
        console.log('User authenticated:', user.email);
    } else {
        // Redirect to login page
        window.location.href = 'auth.html';
    }
});

// Load user profile from database
async function loadUserProfile() {
    try {
        const userRef = database.ref('users/' + currentUserId);
        const snapshot = await userRef.once('value');
        userProfile = snapshot.val() || {};
        
        // Update profile display
        if (profileImage && userProfile.photoURL) {
            profileImage.src = userProfile.photoURL;
        }
        
        if (profileName) profileName.textContent = userProfile.displayName || 'User';
        if (profileEmail) profileEmail.textContent = currentUser.email;
        if (profileAge) profileAge.textContent = userProfile.age ? `${userProfile.age} years` : 'Age not set';
        
        // Load stats
        loadUserStats();
        
    } catch (error) {
        console.error('Error loading user profile:', error);
    }
}

// Load user statistics
async function loadUserStats() {
    try {
        const connectionsRef = database.ref('connections/' + currentUserId);
        const matchesRef = database.ref('matches/' + currentUserId);
        
        const [connectionsSnapshot, matchesSnapshot] = await Promise.all([
            connectionsRef.once('value'),
            matchesRef.once('value')
        ]);
        
        const connections = connectionsSnapshot.val() || {};
        const matches = matchesSnapshot.val() || {};
        
        connectionsCount.textContent = Object.keys(connections).length;
        matchesCount.textContent = Object.keys(matches).length;
        
    } catch (error) {
        console.error('Error loading user stats:', error);
    }
}

// Update profile display
function updateProfileDisplay() {
    // Update any profile-related elements
    const appTitle = document.querySelector('.app-title');
    if (appTitle) {
        appTitle.textContent = 'Zair';
    }
}

// Helper functions
function addMessage(message, type = 'system') {
    if (!chatMessages) return;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message ' + type;
    messageDiv.textContent = message;
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function updateStatus(message, className) {
    if (!status) return;
    status.textContent = message;
    status.className = 'status ' + className;
}

// Profile Sidebar Functions
function toggleProfileSidebar() {
    profileSidebar.classList.toggle('active');
    sidebarOverlay.classList.toggle('active');
}

function editProfile() {
    // Populate current profile data
    const editUsername = document.getElementById('editUsername');
    const editAge = document.getElementById('editAge');
    const previewImage = document.getElementById('previewImage');
    
    editUsername.value = userProfile.displayName || '';
    editAge.value = userProfile.age || '';
    
    // Use local data URL for placeholder to avoid external dependencies
    const defaultAvatar = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTUwIiBoZWlnaHQ9IjE1MCIgdmlld0JveD0iMCAwIDE1MCAxNTAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxjaXJjbGUgY3g9Ijc1IiBjeT0iNzUiIHI9Ijc1IiBmaWxsPSIjRkY2QjgxIi8+Cjx0ZXh0IHg9Ijc1IiB5PSI4NSIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjUwIiBmaWxsPSJ3aGl0ZSIgdGV4dC1hbmNob3I9Im1pZGRsZSI+8J2TkDwvdGV4dD4KPC9zdmc+';
    previewImage.src = userProfile.photoURL || defaultAvatar;
    
    // Show modal
    document.getElementById('editProfileModal').style.display = 'flex';
}

function closeEditProfileModal() {
    document.getElementById('editProfileModal').style.display = 'none';
    document.getElementById('editProfileForm').reset();
}

// Handle profile image upload preview
document.getElementById('profileImageUpload').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
        // Validate file size (max 2MB)
        if (file.size > 2 * 1024 * 1024) {
            alert('File size too large. Please select an image under 2MB.');
            return;
        }
        
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('previewImage').src = e.target.result;
        };
        reader.readAsDataURL(file);
    } else if (file) {
        alert('Please select a valid image file.');
    }
});

// Handle profile form submission
document.getElementById('editProfileForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const saveBtn = document.getElementById('saveProfileBtn');
    const loading = document.getElementById('profileLoading');
    const username = document.getElementById('editUsername').value.trim();
    const age = document.getElementById('editAge').value;
    const imageFile = document.getElementById('profileImageUpload').files[0];
    
    if (!username) {
        alert('Please enter a username');
        return;
    }
    
    if (age && (age < 18 || age > 100)) {
        alert('Please enter a valid age between 18 and 100');
        return;
    }
    
    try {
            // Show loading state
            saveBtn.disabled = true;
            loading.style.display = 'block';
            
            // Hide any previous error messages
            const errorMsg = document.getElementById('errorMessage');
            if (errorMsg) errorMsg.remove();
            
            let photoURL = userProfile.photoURL;
        
        // Upload image if provided
        if (imageFile) {
            try {
                // Create a sanitized filename
                const safeFilename = imageFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');
                const timestamp = Date.now();
                const storageRef = storage.ref(`profile-images/${currentUserId}/${timestamp}_${safeFilename}`);
                
                // Upload with metadata
                const metadata = {
                    contentType: imageFile.type,
                    customMetadata: {
                        'uploadedBy': currentUserId,
                        'originalName': imageFile.name
                    }
                };
                
                const snapshot = await storageRef.put(imageFile, metadata);
                photoURL = await snapshot.ref.getDownloadURL();
                
            } catch (storageError) {
                console.error('Storage upload error:', storageError);
                // If storage fails, continue without image update
                if (storageError.code === 'storage/unauthorized') {
                    alert('Storage permission denied. Please check Firebase Storage rules.');
                } else if (storageError.code === 'storage/cors') {
                    alert('CORS error. Please check Firebase Storage CORS configuration.');
                } else {
                    alert('Failed to upload image. Please try again.');
                }
                throw storageError; // Re-throw to stop the update
            }
        }
        
        try {
            // Update user profile
            const updates = {
                displayName: username,
                age: age ? parseInt(age) : null,
                photoURL: photoURL,
                updatedAt: firebase.database.ServerValue.TIMESTAMP
            };
            
            // Update in Firebase Database
            await database.ref('users/' + currentUserId).update(updates);
            
            // Update Firebase Auth profile
            await currentUser.updateProfile({
                displayName: username,
                photoURL: photoURL
            });
            
            // Update local profile
            userProfile = { ...userProfile, ...updates };
            
            // Update UI
            updateProfileDisplay();
            
            // Close modal
            closeEditProfileModal();
            
            alert('Profile updated successfully!');
            
        } catch (firestoreError) {
            console.error('Firestore update error:', firestoreError);
            
            // If firestore update fails, revert the image upload if it happened
            if (imageFile && photoURL !== userProfile.photoURL) {
                try {
                    // Delete the uploaded image
                    const oldStorageRef = storage.refFromURL(photoURL);
                    await oldStorageRef.delete();
                } catch (deleteError) {
                    console.warn('Could not delete uploaded image:', deleteError);
                }
            }
            
            if (firestoreError.code === 'permission-denied') {
                alert('Permission denied. Please check Firestore security rules.');
            } else {
                alert('Failed to update profile. Please check your connection and try again.');
            }
            
            throw firestoreError;
        }
        
    } catch (error) {
        console.error('Error updating profile:', error);
        
        // Create error message element if it doesn't exist
        let errorDiv = document.getElementById('errorMessage');
        if (!errorDiv) {
            errorDiv = document.createElement('div');
            errorDiv.id = 'errorMessage';
            errorDiv.style.cssText = 'color: #ff4757; margin-top: 10px; padding: 10px; background: #ffe0e0; border-radius: 5px;';
            document.querySelector('.form-actions').appendChild(errorDiv);
        }
        
        if (error.code === 'storage/unauthorized') {
            errorDiv.textContent = 'Storage permission denied. Please contact support.';
        } else if (error.code === 'storage/cors') {
            errorDiv.textContent = 'Network configuration issue. Profile updated without image.';
            // Allow profile update without image
            try {
                const updates = {
                    displayName: username,
                    age: age ? parseInt(age) : null,
                    updatedAt: firebase.database.ServerValue.TIMESTAMP
                };
                
                await database.ref('users/' + currentUserId).update(updates);
                await currentUser.updateProfile({ displayName: username });
                
                userProfile = { ...userProfile, ...updates };
                updateProfileDisplay();
                closeEditProfileModal();
                
                alert('Profile updated (image upload failed due to network configuration).');
                return;
            } catch (fallbackError) {
                errorDiv.textContent = 'Failed to update profile. Please try again.';
            }
        } else if (error.code === 'storage/network-request-failed') {
            errorDiv.textContent = 'Network error. Please check your connection.';
        } else {
            errorDiv.textContent = 'Failed to update profile. Please try again.';
        }
        
    } finally {
        saveBtn.disabled = false;
        loading.style.display = 'none';
    }
});

// Update profile display
function updateProfileDisplay() {
    if (profileImage && userProfile.photoURL) {
        profileImage.src = userProfile.photoURL;
    } else if (profileImage) {
        // Use a reliable placeholder if no photo URL
        profileImage.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxjaXJjbGUgY3g9IjUwIiBjeT0iNTAiIHI9IjUwIiBmaWxsPSIjRkY2QjgxIi8+Cjx0ZXh0IHg9IjUwIiB5PSI1NSIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjQwIiBmaWxsPSJ3aGl0ZSIgdGV4dC1hbmNob3I9Im1pZGRsZSI+8J2TkDwvdGV4dD4KPC9zdmc+';
    }
    if (profileName) {
        profileName.textContent = userProfile.displayName || 'User';
    }
    if (profileEmail) {
        profileEmail.textContent = currentUser.email;
    }
    if (profileAge) {
        profileAge.textContent = userProfile.age ? `${userProfile.age} years` : 'Age not set';
    }
}

async function logout() {
    try {
        // Clean up any active connections
        if (currentPartnerId) {
            await database.ref(`calls/${currentUserId}`).remove();
            await database.ref(`calls/${currentPartnerId}`).remove();
        }
        
        // Stop video if running
        if (isVideoStarted) {
            await stopVideo();
        }
        
        // Sign out
        await auth.signOut();
        window.location.href = 'auth.html';
        
    } catch (error) {
        console.error('Logout error:', error);
    }
}

// Video functions (updated with user info)
async function startVideo() {
    try {
        updateStatus('Starting camera...', 'searching');
        
        localStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true
        });

        localVideo.srcObject = localStream;
        localVideo.style.display = 'block';
        videoPlaceholder.textContent = '📹 Camera ready - Find a match';
        
        isVideoStarted = true;
        startBtn.disabled = true;
        connectBtn.disabled = false;
        stopBtn.disabled = false;
        micBtn.disabled = false;
                videoBtn.disabled = false;

        updateStatus('Camera ready - Click "Find Match" to connect', 'connected');
        addMessage(`Welcome ${userProfile.displayName || 'User'}! Ready to find your match?`);
        
        // Update user presence
        updateUserPresence(true);
        
    } catch (error) {
        console.error('Error starting video:', error);
        updateStatus('Camera access denied or unavailable', 'disconnected');
        addMessage('Error: Could not access camera/microphone');
    }
}

async function stopVideo() {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }

    localVideo.srcObject = null;
    remoteVideo.srcObject = null;
    localVideo.style.display = 'none';
    remoteVideo.style.display = 'none';
    videoPlaceholder.textContent = '📹 Click "Start Video" to begin';

    // Cleanup Firebase presence
    if (currentPartnerId) {
        database.ref(`calls/${currentUserId}`).remove();
        database.ref(`calls/${currentPartnerId}`).remove();
    }
    
    updateUserPresence(false);
    
    // Reset UI
    isVideoStarted = false;
    currentPartnerId = null;
    waitingForPartner = false;
    
    startBtn.disabled = false;
    connectBtn.disabled = true;
    skipBtn.disabled = true;
    stopBtn.disabled = true;
    micBtn.disabled = true;
                videoBtn.disabled = true;
    
    updateStatus('Disconnected', 'disconnected');
    addMessage('Video stopped');
}

function toggleMic() {
    if (localStream) {
        const audioTrack = localStream.getAudioTracks()[0];
        if (audioTrack) {
            audioTrack.enabled = !audioTrack.enabled;
            isMuted = !audioTrack.enabled;
            
            if (isMuted) {
                micBtn.classList.remove('active');
                micBtn.classList.add('muted');
                micBtn.innerHTML = '<i class="fas fa-microphone-slash"></i>';
            } else {
                micBtn.classList.remove('muted');
                micBtn.classList.add('active');
                micBtn.innerHTML = '<i class="fas fa-microphone"></i>';
            }
            
            addMessage(isMuted ? 'Microphone muted' : 'Microphone unmuted');
        }
    }
}

function toggleVideo() {
    if (localStream) {
        const videoTrack = localStream.getVideoTracks()[0];
        if (videoTrack) {
            videoTrack.enabled = !videoTrack.enabled;
            
            if (videoTrack.enabled) {
                videoBtn.classList.remove('video-off');
                videoBtn.classList.add('active');
                videoBtn.innerHTML = '<i class="fas fa-video"></i>';
            } else {
                videoBtn.classList.remove('active');
                videoBtn.classList.add('video-off');
                videoBtn.innerHTML = '<i class="fas fa-video-slash"></i>';
            }
            
            addMessage(videoTrack.enabled ? 'Camera turned on' : 'Camera turned off');
        }
    }
}

// Update user presence in database
function updateUserPresence(isOnline) {
    if (currentUserId) {
        const presenceRef = database.ref('presence/' + currentUserId);
        if (isOnline) {
            presenceRef.set({
                online: true,
                lastSeen: firebase.database.ServerValue.TIMESTAMP,
                userId: currentUserId,
                displayName: userProfile.displayName || 'User',
                photoURL: userProfile.photoURL || null
            });
        } else {
            presenceRef.remove();
        }
    }
}

// Update user count
function updateUserCount() {
    database.ref('users').on('value', (snapshot) => {
        const users = snapshot.val();
        const count = users ? Object.keys(users).length : 0;
        const userCountElement = document.getElementById('userCount');
        if (userCountElement) {
            userCountElement.textContent = `👥 ${count} online`;
        }
    });
}

// WebRTC functions (updated for dating app)
async function createPeerConnection() {
    peerConnection = new RTCPeerConnection(servers);

    // Add local stream
    if (localStream) {
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });
    }

    // Handle remote stream
    peerConnection.ontrack = event => {
        if (event.streams && event.streams[0]) {
            remoteVideo.srcObject = event.streams[0];
            remoteVideo.style.display = 'block';
            videoPlaceholder.style.display = 'none';
            
            // Show partner info
            if (currentPartnerId) {
                loadPartnerInfo(currentPartnerId);
            }
        }
    };

    // Handle ICE candidates
    peerConnection.onicecandidate = event => {
        if (event.candidate && currentPartnerId) {
            database.ref(`calls/${currentPartnerId}/candidates`).push(event.candidate.toJSON());
        }
    };

    return peerConnection;
}

// Load partner information
async function loadPartnerInfo(partnerId) {
    try {
        const userRef = database.ref('users/' + partnerId);
        const snapshot = await userRef.once('value');
        const partnerData = snapshot.val();
        
        if (partnerData) {
            const partnerName = partnerData.displayName || 'Anonymous';
            const partnerAge = partnerData.age ? `, ${partnerData.age}` : '';
            
            updateStatus(`Connected with ${partnerName}${partnerAge}`, 'connected');
            addMessage(`You're now chatting with ${partnerName}${partnerAge}`);
            
            // Log connection
            await logConnection(partnerId, partnerName);
        }
    } catch (error) {
        console.error('Error loading partner info:', error);
    }
}

// Log connection for stats
async function logConnection(partnerId, partnerName) {
    try {
        const connectionRef = database.ref('connections/' + currentUserId).push();
        await connectionRef.set({
            partnerId: partnerId,
            partnerName: partnerName,
            timestamp: firebase.database.ServerValue.TIMESTAMP,
            type: 'video'
        });
        
        // Update stats
        loadUserStats();
    } catch (error) {
        console.error('Error logging connection:', error);
    }
}

// Find a match (updated from findStranger)
async function findStranger() {
    if (!isVideoStarted) return;
    
    waitingForPartner = true;
    updateStatus('Looking for your perfect match... 💕', 'searching');
    connectBtn.disabled = true;
    skipBtn.disabled = true;
    addMessage('🔍 Searching for someone special...');

    try {
        // Look for available users
        const snapshot = await database.ref('waitingUsers').once('value');
        const waitingUsers = snapshot.val();
        
        if (waitingUsers) {
            const availableUsers = Object.keys(waitingUsers).filter(id => id !== currentUserId);
            
            if (availableUsers.length > 0) {
                // Found someone waiting
                const partnerId = availableUsers[0];
                currentPartnerId = partnerId;
                
                // Remove both users from waiting list
                await database.ref(`waitingUsers/${currentUserId}`).remove();
                await database.ref(`waitingUsers/${partnerId}`).remove();
                
                // Start call as initiator
                await initiateCall(partnerId);
                return;
            }
        }
        
        // No one waiting, add ourselves to waiting list
        await database.ref(`waitingUsers/${currentUserId}`).set({
            timestamp: Date.now(),
            status: 'waiting',
            displayName: userProfile.displayName || 'Anonymous'
        });
        
        // Listen for someone to connect with us
        const callRef = database.ref(`calls/${currentUserId}`);
        callRef.on('value', async (snapshot) => {
            const callData = snapshot.val();
            if (callData && callData.offer && !peerConnection) {
                currentPartnerId = callData.from;
                await answerCall(callData);
                callRef.off();
            }
        });
        
    } catch (error) {
        console.error('Error finding stranger:', error);
        updateStatus('Error connecting. Try again.', 'disconnected');
        connectBtn.disabled = false;
        waitingForPartner = false;
    }
}

// Skip user (updated)
async function skipUser() {
    addMessage('⏭️ Looking for a new match...');
    resetConnection();
    
    // Small delay before finding new match
    setTimeout(() => {
        if (isVideoStarted) {
            findStranger();
        }
    }, 1000);
}

// Generate user ID for calls
function generateUserId() {
    return 'user_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
}

function updateStatus(message, className) {
    status.textContent = message;
    status.className = 'status ' + className;
}

function addMessage(message, type = 'system') {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message ' + type;
    messageDiv.textContent = message;
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Chat functions
function sendMessage() {
    if (!messageInput || !chatMessages) return;
    
    const message = messageInput.value.trim();
    if (message && currentPartnerId) {
        // Add to our chat
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message sent';
        messageDiv.textContent = message;
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        
        // Send to partner via the calls system
        database.ref(`calls/${currentPartnerId}/messages`).push({
            text: message,
            sender: currentUserId,
            timestamp: Date.now(),
            displayName: userProfile.displayName || 'Anonymous'
        });
        
        messageInput.value = '';
        
        // Show notification badge if chat is closed
        if (chatOverlay && !chatOverlay.classList.contains('open') && chatBadge) {
            chatBadge.style.display = 'block';
        }
    } else if (message && !currentPartnerId) {
        addMessage('⚠️ Connect with someone first to send messages');
        messageInput.value = '';
    }
}

// Listen for chat messages from partner
function listenForMessages() {
    if (!currentPartnerId) return;
    
    database.ref(`calls/${currentUserId}/messages`).on('child_added', (snapshot) => {
        const message = snapshot.val();
        if (message && message.sender === currentPartnerId) {
            addMessage(message.text, 'received');
            
            // Show notification badge if chat is closed
            if (chatOverlay && !chatOverlay.classList.contains('open') && chatBadge) {
                chatBadge.style.display = 'block';
            }
        }
    });
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing elements and adding event listeners...');
    
    // Initialize DOM Elements
    chatOverlay = document.getElementById('chatOverlay');
    chatIconWrapper = document.getElementById('chatIconWrapper');
    chatBadge = document.getElementById('chatBadge');
    localVideo = document.getElementById('localVideo');
    remoteVideo = document.getElementById('remoteVideo');
    videoPlaceholder = document.getElementById('videoPlaceholder');
    status = document.getElementById('status');
    chatMessages = document.getElementById('chatMessages');
    messageInput = document.getElementById('messageInput');
    
    // Initialize Buttons
    startBtn = document.getElementById('startBtn');
    connectBtn = document.getElementById('connectBtn');
    skipBtn = document.getElementById('skipBtn');
    stopBtn = document.getElementById('stopBtn');
    micBtn = document.getElementById('micBtn');
    videoBtn = document.getElementById('videoBtn');
    
    // Initialize Profile Elements
    profileSidebar = document.getElementById('profileSidebar');
    sidebarOverlay = document.getElementById('sidebarOverlay');
    profileImage = document.getElementById('profileImage');
    profileName = document.getElementById('profileName');
    profileEmail = document.getElementById('profileEmail');
    profileAge = document.getElementById('profileAge');
    connectionsCount = document.getElementById('connectionsCount');
    matchesCount = document.getElementById('matchesCount');
    actionMenuBtn = document.getElementById('actionMenuBtn');
    
    console.log('Elements initialized:', {
        chatIconWrapper: !!chatIconWrapper,
        chatOverlay: !!chatOverlay,
        closeChatBtn: !!document.getElementById('closeChatBtn')
    });
    
    // Chat overlay listeners
    if (chatIconWrapper) {
        chatIconWrapper.addEventListener('click', () => {
            console.log('Chat icon clicked');
            chatOverlay.classList.add('open');
            chatBadge.style.display = 'none';
        });
    }
    
    const closeBtn = document.getElementById('closeChatBtn');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            console.log('Close chat clicked');
            chatOverlay.classList.remove('open');
        });
    }
    
    // Message input
    if (messageInput) {
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
    }
    
    // Prevent context menu on profile image
    if (profileImage) {
        profileImage.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });
    }
    
    // Action menu button
    if (actionMenuBtn) {
        actionMenuBtn.addEventListener('click', openReportModal);
    }
    
    // Close modals when clicking outside
    window.onclick = function(event) {
        const editModal = document.getElementById('editProfileModal');
        const reportModal = document.getElementById('reportModal');
        
        if (event.target === editModal) {
            closeEditProfileModal();
        }
        if (event.target === reportModal) {
            closeReportModal();
        }
    };
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (currentUserId) {
        updateUserPresence(false);
        database.ref(`waitingUsers/${currentUserId}`).remove();
        if (currentPartnerId) {
            database.ref(`calls/${currentUserId}`).remove();
            database.ref(`calls/${currentPartnerId}`).remove();
        }
    }
});

// Periodic cleanup of old waiting users and calls
setInterval(() => {
    const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
    
    database.ref('waitingUsers').once('value', (snapshot) => {
        const users = snapshot.val();
        if (users) {
            Object.keys(users).forEach(userId => {
                if (users[userId].timestamp < fiveMinutesAgo) {
                    database.ref(`waitingUsers/${userId}`).remove();
                }
            });
        }
    });
    
    database.ref('calls').once('value', (snapshot) => {
        const calls = snapshot.val();
        if (calls) {
            Object.keys(calls).forEach(userId => {
                const callData = calls[userId];
                if (callData.timestamp && callData.timestamp < fiveMinutesAgo) {
                    database.ref(`calls/${userId}`).remove();
                }
            });
        }
    });
}, 30000); // Run every 30 seconds

// Add missing functions from script.js
async function initiateCall(partnerId) {
    try {
        await createPeerConnection();
        
        // Create offer
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        
        // Send offer to partner
        await database.ref(`calls/${partnerId}`).set({
            offer: offer,
            from: currentUserId,
            timestamp: Date.now()
        });
        
        // Listen for answer
        const answerRef = database.ref(`calls/${currentUserId}/answer`);
        answerRef.on('value', async (snapshot) => {
            const answer = snapshot.val();
            if (answer && peerConnection.signalingState === 'have-local-offer') {
                await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
                answerRef.off();
            }
        });
        
        // Listen for ICE candidates
        listenForCandidates(currentUserId);
        
        onConnectionEstablished();
        
    } catch (error) {
        console.error('Error initiating call:', error);
        resetConnection();
    }
}

async function answerCall(callData) {
    try {
        await createPeerConnection();
        await peerConnection.setRemoteDescription(new RTCSessionDescription(callData.offer));
        
        // Create answer
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        
        // Send answer
        await database.ref(`calls/${callData.from}/answer`).set(answer);
        
        // Listen for ICE candidates
        listenForCandidates(currentUserId);
        
        // Remove from waiting list
        await database.ref(`waitingUsers/${currentUserId}`).remove();
        
        onConnectionEstablished();
        
    } catch (error) {
        console.error('Error answering call:', error);
        resetConnection();
    }
}

function listenForCandidates(userId) {
    const candidatesRef = database.ref(`calls/${userId}/candidates`);
    candidatesRef.on('child_added', async (snapshot) => {
        const candidate = snapshot.val();
        if (peerConnection && candidate) {
            try {
                await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (error) {
                console.error('Error adding ICE candidate:', error);
            }
        }
    });
}

function onConnectionEstablished() {
    if (!currentPartnerId) return;
    
    console.log('Fetching partner data for ID:', currentPartnerId);
    
    // Try multiple possible data locations
    const tryGetName = async () => {
        try {
            // Try users collection first
            const userSnapshot = await database.ref(`users/${currentPartnerId}`).once('value');
            const userData = userSnapshot.val();
            console.log('Users collection data:', userData);
            
            if (userData) {
                if (userData.displayName) return userData.displayName;
                if (userData.name) return userData.name;
                if (userData.email) return userData.email.split('@')[0];
            }
            
            // Try presence system
            const presenceSnapshot = await database.ref(`presence/${currentPartnerId}`).once('value');
            const presenceData = presenceSnapshot.val();
            console.log('Presence data:', presenceData);
            
            if (presenceData && presenceData.displayName) {
                return presenceData.displayName;
            }
            
            // Try waiting users
            const waitingSnapshot = await database.ref(`waitingUsers/${currentPartnerId}`).once('value');
            const waitingData = waitingSnapshot.val();
            console.log('Waiting users data:', waitingData);
            
            if (waitingData && waitingData.displayName) {
                return waitingData.displayName;
            }
            
            return 'Someone Special';
        } catch (error) {
            console.error('Error in tryGetName:', error);
            return 'Someone Special';
        }
    };
    
    tryGetName().then(partnerName => {
        console.log('Final partner name:', partnerName);
        updateStatus(`Connected with ${partnerName}! 🎉`, 'connected');
        addMessage(`🎉 Connected with ${partnerName}! Say hi to your new friend!`);
        
        // Show action menu button
        if (actionMenuBtn) {
            actionMenuBtn.style.display = 'flex';
        }
    }).catch(error => {
        console.error('Error getting partner name:', error);
        updateStatus('Connected with Someone Special! 🎉', 'connected');
        addMessage('🎉 Connected! Say hi to your new friend!');
        
        // Show action menu button
        if (actionMenuBtn) {
            actionMenuBtn.style.display = 'flex';
        }
    });

    connectBtn.disabled = true;
    skipBtn.disabled = false;
    waitingForPartner = false;
    
    // Listen for chat messages
    listenForMessages();
    
    // Listen for disconnection
    if (currentPartnerId) {
        database.ref(`calls/${currentPartnerId}`).on('value', (snapshot) => {
            if (!snapshot.exists()) {
                handlePartnerDisconnect();
            }
        });
    }
}

function handlePartnerDisconnect() {
    if (currentPartnerId) {
        const tryGetName = async () => {
            try {
                const userSnapshot = await database.ref(`users/${currentPartnerId}`).once('value');
                const userData = userSnapshot.val();
                
                if (userData) {
                    if (userData.displayName) return userData.displayName;
                    if (userData.name) return userData.name;
                    if (userData.email) return userData.email.split('@')[0];
                }
                
                const presenceSnapshot = await database.ref(`presence/${currentPartnerId}`).once('value');
                const presenceData = presenceSnapshot.val();
                
                if (presenceData && presenceData.displayName) {
                    return presenceData.displayName;
                }
                
                return 'Your match';
            } catch (error) {
                console.error('Error getting partner name for disconnect:', error);
                return 'Your match';
            }
        };
        
        tryGetName().then(partnerName => {
            addMessage(`👋 ${partnerName} disconnected`);
        }).catch(error => {
            console.error('Error in disconnect name fetch:', error);
            addMessage('👋 Your match disconnected');
        });
    } else {
        addMessage('👋 Your match disconnected');
    }
    resetConnection();
}

function resetConnection() {
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    
    remoteVideo.srcObject = null;
    remoteVideo.style.display = 'none';
    videoPlaceholder.style.display = 'block';
    videoPlaceholder.textContent = isVideoStarted ? '📹 Find a match to chat' : '📹 Click "Start Video" to begin';
    
    if (currentPartnerId) {
        database.ref(`calls/${currentUserId}`).remove();
        database.ref(`calls/${currentPartnerId}`).off();
    }
    
    currentPartnerId = null;
    waitingForPartner = false;
    
    // Hide action menu button
    if (actionMenuBtn) {
        actionMenuBtn.style.display = 'none';
    }
    
    updateStatus(isVideoStarted ? 'Ready to find match' : 'Start video first', isVideoStarted ? 'connected' : 'disconnected');
    connectBtn.disabled = !isVideoStarted;
    skipBtn.disabled = true;
}

// Report and Block Functions
function openReportModal() {
    const modal = document.getElementById('reportModal');
    if (modal) {
        modal.style.display = 'flex';
    }
}

function closeReportModal() {
    const modal = document.getElementById('reportModal');
    if (modal) {
        modal.style.display = 'none';
        // Clear selected radio buttons
        const radios = document.querySelectorAll('input[name="reportReason"]');
        radios.forEach(radio => radio.checked = false);
    }
}

async function blockUser() {
    if (!currentPartnerId) return;
    
    try {
        // Add to blocked users list
        await database.ref(`blockedUsers/${currentUserId}/${currentPartnerId}`).set({
            timestamp: Date.now(),
            reason: 'manual_block'
        });
        
        addMessage('User blocked successfully');
        closeReportModal();
        
        // Disconnect from the user
        skipUser();
        
    } catch (error) {
        console.error('Error blocking user:', error);
        addMessage('Error blocking user');
    }
}

async function reportAndBlockUser() {
    if (!currentPartnerId) return;
    
    const selectedReason = document.querySelector('input[name="reportReason"]:checked');
    if (!selectedReason) {
        alert('Please select a reason for reporting');
        return;
    }
    
    const reason = selectedReason.value;
    
    try {
        // Get partner details
        const partnerSnapshot = await database.ref(`users/${currentPartnerId}`).once('value');
        const partnerData = partnerSnapshot.val() || {};
        
        // Prepare report data
        const reportData = {
            reporterId: currentUserId,
            reporterName: userProfile.displayName || currentUser.email,
            reporterEmail: currentUser.email,
            reportedUserId: currentPartnerId,
            reportedUserName: partnerData.displayName || 'Unknown',
            reportedUserEmail: partnerData.email || 'Unknown',
            reason: reason,
            timestamp: Date.now(),
            additionalInfo: {
                platform: 'Zair',
                userAgent: navigator.userAgent,
                timestamp: new Date().toISOString()
            }
        };
        
        // Send to Google Sheets
        await sendReportToGoogleSheets(reportData);
        
        // Also block the user
        await blockUser();
        
        addMessage('User reported and blocked successfully');
        closeReportModal();
        
    } catch (error) {
        console.error('Error reporting user:', error);
        addMessage('Error reporting user');
    }
}

async function sendReportToGoogleSheets(reportData) {
    try {
        const GOOGLE_SHEETS_URL = 'https://script.google.com/macros/s/AKfycbwSQFIerPV0q2gSext23kcTwF8HgOn_sc75Pk7tTMo/exec';
        
        const response = await fetch(GOOGLE_SHEETS_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(reportData)
        });
        
        console.log('Report sent to Google Sheets:', reportData);
        return true;
        
    } catch (error) {
        console.error('Error sending to Google Sheets:', error);
        // Still allow the report to be processed locally even if Google Sheets fails
        return false;
    }
}

function skipUser() {
    if (currentPartnerId) {
        // Clean up current connection
        database.ref(`calls/${currentUserId}`).remove();
        database.ref(`calls/${currentPartnerId}`).remove();
        
        if (peerConnection) {
            peerConnection.close();
            peerConnection = null;
        }
        
        remoteVideo.srcObject = null;
        remoteVideo.style.display = 'none';
        videoPlaceholder.style.display = 'block';
        videoPlaceholder.textContent = '📹 Finding new match...';
        
        currentPartnerId = null;
        
        // Find new partner
        setTimeout(() => {
            findStranger();
        }, 1000);
    }
}