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
        const database = firebase.database();

        // Global variables
        let localStream = null;
        let remoteStream = null;
        let peerConnection = null;
        let currentUserId = generateUserId();
        let currentPartnerId = null;
        let isVideoStarted = false;
        let isMuted = false;
        let connectionState = 'disconnected'; // 'disconnected', 'waiting', 'connecting', 'connected'

        // WebRTC configuration with enhanced STUN/TURN servers
        const servers = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' },
                { urls: 'stun:stun3.l.google.com:19302' },
                { urls: 'stun:stun4.l.google.com:19302' }
            ]
        };

        // DOM elements
        const chatOverlay = document.getElementById('chatOverlay');
        const chatIconWrapper = document.getElementById('chatIconWrapper');
        const chatBadge = document.getElementById('chatBadge');
        const closeChatBtn = document.getElementById('closeChatBtn');
        const localVideo = document.getElementById('localVideo');
        const remoteVideo = document.getElementById('remoteVideo');
        const videoPlaceholder = document.getElementById('videoPlaceholder');
        const status = document.getElementById('status');
        const chatMessages = document.getElementById('chatMessages');
        const messageInput = document.getElementById('messageInput');
        const userCount = document.getElementById('userCount');

        // Buttons
        const startBtn = document.getElementById('startBtn');
        const connectBtn = document.getElementById('connectBtn');
        const skipBtn = document.getElementById('skipBtn');
        const stopBtn = document.getElementById('stopBtn');
        const micBtn = document.getElementById('micBtn');
        const videoBtn = document.getElementById('videoBtn');

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

        // Enhanced connection state management
        function setConnectionState(newState) {
            connectionState = newState;
            console.log('Connection state:', newState);
            
            switch(newState) {
                case 'waiting':
                    updateStatus('Waiting for a stranger...', 'searching');
                    break;
                case 'connecting':
                    updateStatus('Connecting...', 'searching');
                    break;
                case 'connected':
                    updateStatus('Connected! 🎥', 'connected');
                    break;
                case 'disconnected':
                    updateStatus('Ready to find stranger', isVideoStarted ? 'connected' : 'disconnected');
                    break;
            }
        }

        // Video functions
        async function startVideo() {
            try {
                updateStatus('Starting camera...', 'searching');
                
                const constraints = {
                    video: {
                        width: { ideal: 1280, max: 1920 },
                        height: { ideal: 720, max: 1080 },
                        facingMode: 'user',
                        frameRate: { ideal: 30, max: 60 }
                    },
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true,
                        sampleRate: 44100
                    }
                };

                localStream = await navigator.mediaDevices.getUserMedia(constraints);
                
                localVideo.srcObject = localStream;
                localVideo.style.display = 'block';
                videoPlaceholder.textContent = '📹 Camera ready - Find a stranger to chat';
                
                isVideoStarted = true;
                startBtn.disabled = true;
                connectBtn.disabled = false;
                stopBtn.disabled = false;
                micBtn.disabled = false;
                videoBtn.disabled = false;
                
                micBtn.classList.add('active');
                videoBtn.classList.add('active');

                updateStatus('Camera ready - Click "Find Stranger" to connect', 'connected');
                addMessage('Camera started successfully!');
                
                updateUserPresence(true);
                
            } catch (error) {
                console.error('Error starting video:', error);
                let errorMessage = 'Camera access denied or unavailable';
                if (error.name === 'NotAllowedError') {
                    errorMessage = 'Camera access denied. Please allow camera permissions.';
                } else if (error.name === 'NotFoundError') {
                    errorMessage = 'No camera/microphone found. Please check your devices.';
                } else if (error.name === 'NotReadableError') {
                    errorMessage = 'Camera is already in use by another application.';
                }
                updateStatus(errorMessage, 'disconnected');
                addMessage('Error: ' + errorMessage);
            }
        }

        async function stopVideo() {
            // Clean up connection first
            await cleanupConnection();
            
            if (localStream) {
                localStream.getTracks().forEach(track => track.stop());
                localStream = null;
            }
            
            localVideo.srcObject = null;
            remoteVideo.srcObject = null;
            localVideo.style.display = 'none';
            remoteVideo.style.display = 'none';
            videoPlaceholder.textContent = '📹 Click "Start Video" to begin';
            
            updateUserPresence(false);
            
            isVideoStarted = false;
            setConnectionState('disconnected');
            
            startBtn.disabled = false;
            connectBtn.disabled = true;
            skipBtn.disabled = true;
            stopBtn.disabled = true;
            micBtn.disabled = true;
            videoBtn.disabled = true;
            
            micBtn.classList.remove('active', 'muted');
            videoBtn.classList.remove('active', 'video-off');
            
            addMessage('Video stopped');
        }

        // New robust connection algorithm
        async function findStranger() {
            if (!isVideoStarted || connectionState !== 'disconnected') return;
            
            setConnectionState('waiting');
            connectBtn.disabled = true;
            skipBtn.disabled = true;
            addMessage('🔍 Searching for a stranger...');

            try {
                // Use Firebase transactions for atomic matching
                const matchResult = await findAndLockPartner();
                
                if (matchResult.success) {
                    currentPartnerId = matchResult.partnerId;
                    await establishConnection(currentPartnerId, matchResult.isInitiator);
                } else {
                    // No partner found, add to waiting queue
                    await addToWaitingQueue();
                }
                
            } catch (error) {
                console.error('Error finding stranger:', error);
                addMessage('Connection error. Please try again.');
                await resetConnection();
            }
        }

        async function findAndLockPartner() {
            const waitingRef = database.ref('waitingUsers');
            
            return new Promise((resolve) => {
                waitingRef.transaction((waitingUsers) => {
                    if (!waitingUsers) {
                        return null; // No waiting users
                    }
                    
                    const availableUsers = Object.keys(waitingUsers).filter(id => 
                        id !== currentUserId && !isUserBlocked(id)
                    );
                    
                    if (availableUsers.length === 0) {
                        return null; // No available users
                    }
                    
                    // Find the oldest waiting user
                    let oldestUser = null;
                    let oldestTime = Infinity;
                    
                    availableUsers.forEach(userId => {
                        if (waitingUsers[userId].timestamp < oldestTime) {
                            oldestTime = waitingUsers[userId].timestamp;
                            oldestUser = userId;
                        }
                    });
                    
                    if (oldestUser) {
                        // Create a room for these two users
                        const roomId = generateRoomId(currentUserId, oldestUser);
                        
                        // Remove both users from waiting
                        delete waitingUsers[currentUserId];
                        delete waitingUsers[oldestUser];
                        
                        // Create room entry
                        database.ref(`rooms/${roomId}`).set({
                            user1: currentUserId,
                            user2: oldestUser,
                            createdAt: Date.now(),
                            status: 'connecting'
                        });
                        
                        resolve({
                            success: true,
                            partnerId: oldestUser,
                            roomId: roomId,
                            isInitiator: true
                        });
                        
                        return waitingUsers;
                    }
                    
                    return waitingUsers;
                }, (error, committed, snapshot) => {
                    if (error || !committed) {
                        resolve({ success: false });
                    }
                });
            });
        }

        async function addToWaitingQueue() {
            await database.ref(`waitingUsers/${currentUserId}`).set({
                timestamp: Date.now(),
                status: 'waiting'
            });
            
            // Listen for someone to connect with us
            listenForIncomingConnection();
        }

        async function listenForIncomingConnection() {
            const roomRef = database.ref('rooms').orderByChild('user2').equalTo(currentUserId).limitToLast(1);
            
            roomRef.on('child_added', async (snapshot) => {
                const roomData = snapshot.val();
                if (roomData && roomData.user2 === currentUserId && roomData.status === 'connecting') {
                    currentPartnerId = roomData.user1;
                    const roomId = snapshot.key;
                    
                    // Remove from waiting
                    await database.ref(`waitingUsers/${currentUserId}`).remove();
                    
                    // Start connection as responder
                    await establishConnection(currentPartnerId, false);
                    
                    // Clean up room reference
                    roomRef.off();
                }
            });
        }

        async function establishConnection(partnerId, isInitiator) {
            setConnectionState('connecting');
            
            try {
                await createPeerConnection(isInitiator);
                
                if (isInitiator) {
                    await createOffer(partnerId);
                } else {
                    await waitForOffer(partnerId);
                }
                
            } catch (error) {
                console.error('Error establishing connection:', error);
                throw error;
            }
        }

        // Enhanced WebRTC connection
        async function createPeerConnection(isInitiator) {
            try {
                peerConnection = new RTCPeerConnection(servers);
                
                // Add local stream with all tracks
                if (localStream) {
                    localStream.getTracks().forEach(track => {
                        peerConnection.addTrack(track, localStream);
                    });
                }

                // Handle remote stream
                peerConnection.ontrack = event => {
                    console.log('Remote stream received:', event.streams);
                    if (event.streams && event.streams[0]) {
                        remoteStream = event.streams[0];
                        remoteVideo.srcObject = remoteStream;
                        remoteVideo.style.display = 'block';
                        videoPlaceholder.style.display = 'none';
                        
                        setConnectionState('connected');
                        addMessage('🎉 Connection established!');
                    }
                };

                // Enhanced ICE handling
                peerConnection.onicecandidate = event => {
                    if (event.candidate && currentPartnerId) {
                        database.ref(`iceCandidates/${currentPartnerId}/${currentUserId}`).push({
                            candidate: event.candidate.toJSON(),
                            timestamp: Date.now()
                        });
                    }
                };

                // Connection state monitoring
                peerConnection.onconnectionstatechange = () => {
                    console.log('Connection state:', peerConnection.connectionState);
                    
                    switch(peerConnection.connectionState) {
                        case 'connected':
                            setConnectionState('connected');
                            onConnectionSuccess();
                            break;
                        case 'failed':
                        case 'disconnected':
                        case 'closed':
                            handleConnectionFailure();
                            break;
                    }
                };

                peerConnection.oniceconnectionstatechange = () => {
                    console.log('ICE state:', peerConnection.iceConnectionState);
                    
                    if (peerConnection.iceConnectionState === 'failed') {
                        // Attempt ICE restart
                        if (peerConnection.restartIce) {
                            peerConnection.restartIce();
                        }
                    }
                };

                return peerConnection;
            } catch (error) {
                console.error('Error creating peer connection:', error);
                throw error;
            }
        }

        async function createOffer(partnerId) {
            const offer = await peerConnection.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: true
            });
            
            await peerConnection.setLocalDescription(offer);
            
            // Store offer in database
            await database.ref(`offers/${partnerId}`).set({
                offer: offer,
                from: currentUserId,
                timestamp: Date.now()
            });
            
            // Listen for answer
            listenForAnswer(partnerId);
            
            // Listen for ICE candidates
            listenForIceCandidates(partnerId);
        }

        async function waitForOffer(partnerId) {
            const offerRef = database.ref(`offers/${currentUserId}`);
            
            offerRef.on('value', async (snapshot) => {
                const offerData = snapshot.val();
                if (offerData && offerData.from === partnerId) {
                    await peerConnection.setRemoteDescription(new RTCSessionDescription(offerData.offer));
                    
                    const answer = await peerConnection.createAnswer({
                        offerToReceiveAudio: true,
                        offerToReceiveVideo: true
                    });
                    
                    await peerConnection.setLocalDescription(answer);
                    
                    // Send answer
                    await database.ref(`answers/${partnerId}`).set({
                        answer: answer,
                        from: currentUserId,
                        timestamp: Date.now()
                    });
                    
                    // Clean up offer
                    snapshot.ref.remove();
                    
                    // Listen for ICE candidates
                    listenForIceCandidates(partnerId);
                }
            });
        }

        async function listenForAnswer(partnerId) {
            const answerRef = database.ref(`answers/${currentUserId}`);
            
            answerRef.on('value', async (snapshot) => {
                const answerData = snapshot.val();
                if (answerData && answerData.from === partnerId) {
                    await peerConnection.setRemoteDescription(new RTCSessionDescription(answerData.answer));
                    
                    // Clean up answer
                    snapshot.ref.remove();
                }
            });
        }

        function listenForIceCandidates(partnerId) {
            const iceRef = database.ref(`iceCandidates/${currentUserId}/${partnerId}`);
            
            iceRef.on('child_added', async (snapshot) => {
                const candidateData = snapshot.val();
                if (candidateData && peerConnection) {
                    try {
                        await peerConnection.addIceCandidate(new RTCIceCandidate(candidateData.candidate));
                    } catch (error) {
                        console.error('Error adding ICE candidate:', error);
                    }
                }
            });
        }

        async function onConnectionSuccess() {
            skipBtn.disabled = false;
            
            // Start chat functionality
            listenForMessages();
            
            // Monitor partner disconnection
            if (currentPartnerId) {
                database.ref(`users/${currentPartnerId}`).on('value', (snapshot) => {
                    if (!snapshot.exists()) {
                        handlePartnerDisconnect();
                    }
                });
            }
        }

        async function cleanupConnection() {
            if (peerConnection) {
                peerConnection.close();
                peerConnection = null;
            }
            
            if (currentPartnerId) {
                // Clean up all database entries
                await Promise.all([
                    database.ref(`waitingUsers/${currentUserId}`).remove(),
                    database.ref(`offers/${currentUserId}`).remove(),
                    database.ref(`answers/${currentUserId}`).remove(),
                    database.ref(`iceCandidates/${currentUserId}`).remove(),
                    database.ref(`iceCandidates/${currentPartnerId}/${currentUserId}`).remove(),
                    database.ref(`messages/${currentUserId}`).remove()
                ]);
            }
            
            remoteStream = null;
            remoteVideo.srcObject = null;
            remoteVideo.style.display = 'none';
            videoPlaceholder.style.display = 'block';
            
            currentPartnerId = null;
            setConnectionState('disconnected');
            
            connectBtn.disabled = !isVideoStarted;
            skipBtn.disabled = true;
        }

        async function resetConnection() {
            await cleanupConnection();
        }

        async function skipUser() {
            if (connectionState === 'connected') {
                addMessage('⏭️ Looking for new stranger...');
                await resetConnection();
                
                // Brief delay before searching again
                setTimeout(() => {
                    if (isVideoStarted) {
                        findStranger();
                    }
                }, 1000);
            }
        }

        function handlePartnerDisconnect() {
            addMessage('👋 Stranger disconnected');
            resetConnection();
        }

        // Utility functions
        function generateRoomId(user1, user2) {
            // Create consistent room ID regardless of order
            return user1 < user2 ? `${user1}_${user2}` : `${user2}_${user1}`;
        }

        // Chat functions (enhanced)
        function sendMessage() {
            const message = messageInput.value.trim();
            if (!message) return;
            
            if (!currentPartnerId) {
                addMessage('⚠️ Connect with someone first to send messages');
                messageInput.value = '';
                return;
            }
            
            // Add to our chat
            const messageDiv = document.createElement('div');
            messageDiv.className = 'message sent';
            messageDiv.textContent = message;
            chatMessages.appendChild(messageDiv);
            chatMessages.scrollTop = chatMessages.scrollHeight;
            
            // Send to partner
            database.ref(`messages/${currentPartnerId}/${Date.now()}`).set({
                text: message,
                from: currentUserId,
                timestamp: Date.now()
            });
            
            messageInput.value = '';
        }

        function listenForMessages() {
            if (!currentPartnerId) return;
            
            const messagesRef = database.ref(`messages/${currentUserId}`);
            messagesRef.on('child_added', (snapshot) => {
                const messageData = snapshot.val();
                if (messageData && messageData.from === currentPartnerId) {
                    const messageDiv = document.createElement('div');
                    messageDiv.className = 'message received';
                    messageDiv.textContent = messageData.text;
                    chatMessages.appendChild(messageDiv);
                    chatMessages.scrollTop = chatMessages.scrollHeight;
                    
                    // Update unread badge
                    if (!chatOverlay.classList.contains('open')) {
                        updateChatBadge();
                    }
                    
                    // Remove message after displaying
                    snapshot.ref.remove();
                }
            });
        }

        function updateChatBadge() {
            const badge = document.getElementById('chatBadge');
            const currentCount = parseInt(badge.textContent) || 0;
            badge.textContent = currentCount + 1;
            badge.style.display = 'flex';
        }

        // User presence and count
        function updateUserPresence(online) {
            if (online) {
                database.ref(`users/${currentUserId}`).set({
                    online: true,
                    timestamp: Date.now(),
                    connectionState: connectionState
                });
                
                database.ref(`users/${currentUserId}`).onDisconnect().remove();
            } else {
                database.ref(`users/${currentUserId}`).remove();
            }
        }

        function updateUserCount() {
            database.ref('users').on('value', (snapshot) => {
                const users = snapshot.val();
                const count = users ? Object.keys(users).length : 0;
                userCount.textContent = `👥 ${count} online`;
            });
        }

        // Event listeners
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });

        // Audio/Video controls
        function toggleMic() {
            if (localStream) {
                const audioTrack = localStream.getAudioTracks()[0];
                if (audioTrack) {
                    audioTrack.enabled = !audioTrack.enabled;
                    isMuted = !audioTrack.enabled;
                    
                    micBtn.classList.toggle('muted', isMuted);
                    micBtn.classList.toggle('active', !isMuted);
                    
                    addMessage(isMuted ? 'Microphone muted' : 'Microphone unmuted');
                }
            }
        }

        function toggleVideo() {
            if (localStream) {
                const videoTrack = localStream.getVideoTracks()[0];
                if (videoTrack) {
                    videoTrack.enabled = !videoTrack.enabled;
                    
                    videoBtn.classList.toggle('video-off', !videoTrack.enabled);
                    videoBtn.classList.toggle('active', videoTrack.enabled);
                    
                    addMessage(videoTrack.enabled ? 'Camera turned on' : 'Camera turned off');
                }
            }
        }

        // User action functions
        function toggleUserActions(show) {
            const userActions = document.getElementById('userActions');
            if (userActions) {
                userActions.style.display = show ? 'block' : 'none';
            }
        }

        function openUserActions() {
            document.getElementById('reportModal').style.display = 'flex';
        }

        function closeReportModal() {
            document.getElementById('reportModal').style.display = 'none';
            const radios = document.querySelectorAll('input[name="reportReason"]');
            radios.forEach(radio => radio.checked = false);
        }

        function blockUser() {
            if (!currentPartnerId) return;
            
            let blockedUsers = JSON.parse(localStorage.getItem('blockedUsers') || '[]');
            if (!blockedUsers.includes(currentPartnerId)) {
                blockedUsers.push(currentPartnerId);
                localStorage.setItem('blockedUsers', JSON.stringify(blockedUsers));
            }
            
            closeReportModal();
            skipUser();
            addMessage('User blocked successfully');
        }

        function reportAndBlockUser() {
            if (!currentPartnerId) return;
            
            const selectedReason = document.querySelector('input[name="reportReason"]:checked');
            if (!selectedReason) {
                alert('Please select a reason for reporting');
                return;
            }

            const reportData = {
                reporterId: currentUserId,
                reportedUserId: currentPartnerId,
                reason: selectedReason.value,
                timestamp: new Date().toISOString(),
                platform: 'Zair'
            };

            sendReportToGoogleSheets(reportData);
            blockUser();
        }

        function sendReportToGoogleSheets(reportData) {
            const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwSQFIerPV0q2gSext23kcTwF8HgOn_sc75Pk7tTMo/exec';
            
            fetch(GOOGLE_SCRIPT_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(reportData)
            })
            .then(() => {
                console.log('Report sent successfully');
                addMessage('Report submitted successfully');
            })
            .catch(error => {
                console.error('Error sending report:', error);
                addMessage('Report saved locally, will sync later');
            });
        }

        function isUserBlocked(userId) {
            const blockedUsers = JSON.parse(localStorage.getItem('blockedUsers') || '[]');
            return blockedUsers.includes(userId);
        }

        // Chat overlay logic
        let unreadCount = 0;
        function openChat() {
            chatOverlay.classList.add('open');
            unreadCount = 0;
            chatBadge.style.display = 'none';
        }

        function closeChat() {
            chatOverlay.classList.remove('open');
        }

        // Event listeners
        chatIconWrapper?.addEventListener('click', openChat);
        closeChatBtn?.addEventListener('click', closeChat);

        // Cleanup on page unload
        window.addEventListener('beforeunload', async () => {
            await stopVideo();
            await cleanupConnection();
        });

        // Periodic cleanup
        setInterval(() => {
            const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
            
            // Clean up old waiting users
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
            
            // Clean up old rooms
            database.ref('rooms').once('value', (snapshot) => {
                const rooms = snapshot.val();
                if (rooms) {
                    Object.keys(rooms).forEach(roomId => {
                        if (rooms[roomId].createdAt < fiveMinutesAgo) {
                            database.ref(`rooms/${roomId}`).remove();
                        }
                    });
                }
            });
            
            // Clean up old offers/answers
            ['offers', 'answers'].forEach(type => {
                database.ref(type).once('value', (snapshot) => {
                    const data = snapshot.val();
                    if (data) {
                        Object.keys(data).forEach(key => {
                            if (data[key].timestamp < fiveMinutesAgo) {
                                database.ref(`${type}/${key}`).remove();
                            }
                        });
                    }
                });
            });
            
        }, 30000);

        // Initialize
        updateUserCount();

        // Modal event listeners
        document.getElementById('reportModal')?.addEventListener('click', function(e) {
            if (e.target === this) {
                closeReportModal();
            }
        });

        // Button event listeners
        startBtn?.addEventListener('click', startVideo);
        connectBtn?.addEventListener('click', findStranger);
        skipBtn?.addEventListener('click', skipUser);
        stopBtn?.addEventListener('click', stopVideo);
        micBtn?.addEventListener('click', toggleMic);
        videoBtn?.addEventListener('click', toggleVideo);
        document.getElementById('actionBtn')?.addEventListener('click', openUserActions);