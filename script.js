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

        // DOM elements (update for new structure)
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

        // Video functions
        async function startVideo() {
            try {
                updateStatus('Starting camera...', 'searching');
                
                // Enhanced media constraints for better cross-device compatibility
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

                // Ensure video track is properly initialized
                const videoTrack = localStream.getVideoTracks()[0];
                if (videoTrack) {
                    console.log('Video track settings:', videoTrack.getSettings());
                }

                localVideo.srcObject = localStream;
                localVideo.style.display = 'block';
                videoPlaceholder.textContent = '📹 Camera ready - Find a stranger to chat';
                
                isVideoStarted = true;
                startBtn.disabled = true;
                connectBtn.disabled = false;
                stopBtn.disabled = false;
                micBtn.disabled = false;
                videoBtn.disabled = false;
                
                // Set initial states
                micBtn.classList.add('active');
                videoBtn.classList.add('active');

                updateStatus('Camera ready - Click "Find Stranger" to connect', 'connected');
                addMessage('Camera started successfully!');
                
                // Update user presence
                updateUserPresence(true);
                
            } catch (error) {
                console.error('Error starting video:', error);
                
                // Provide specific error messages
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
            
            // Reset button states
            micBtn.classList.remove('active', 'muted');
            videoBtn.classList.remove('active', 'video-off');
            
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

        // WebRTC functions
        async function createPeerConnection() {
            try {
                peerConnection = new RTCPeerConnection(servers);

                // Add local stream with better error handling and track negotiation
                if (localStream) {
                    console.log('Adding local tracks to peer connection:', {
                        videoTracks: localStream.getVideoTracks().length,
                        audioTracks: localStream.getAudioTracks().length
                    });
                    
                    localStream.getTracks().forEach(track => {
                        try {
                            const sender = peerConnection.addTrack(track, localStream);
                            console.log('Added track:', track.kind, 'track ID:', track.id);
                        } catch (trackError) {
                            console.error('Error adding track:', trackError);
                        }
                    });
                } else {
                    console.warn('No local stream available when creating peer connection');
                }

                // Handle remote stream with enhanced logging
                peerConnection.ontrack = event => {
                    console.log('Remote stream received:', event.streams);
                    console.log('Remote tracks:', event.track ? event.track.kind : 'No track info');
                    
                    if (event.streams && event.streams[0]) {
                        remoteVideo.srcObject = event.streams[0];
                        remoteVideo.style.display = 'block';
                        videoPlaceholder.style.display = 'none';
                        
                        // Ensure video plays and is visible
                        remoteVideo.play().catch(e => {
                            console.error('Error playing remote video:', e);
                            addMessage('⚠️ Could not play remote video');
                        });
                        
                        // Check if remote stream has video tracks
                        const remoteStream = event.streams[0];
                        const videoTracks = remoteStream.getVideoTracks();
                        const audioTracks = remoteStream.getAudioTracks();
                        
                        console.log('Remote stream details:', {
                            videoTracks: videoTracks.length,
                            audioTracks: audioTracks.length,
                            videoTrackSettings: videoTracks.length > 0 ? videoTracks[0].getSettings() : null
                        });
                        
                        if (videoTracks.length > 0) {
                            addMessage('📹 Video connection established!');
                        } else {
                            addMessage('🔊 Audio only - no video received');
                        }
                    }
                };

                // Enhanced ICE candidate handling with diagnostics
                peerConnection.onicecandidate = event => {
                    if (event.candidate && currentPartnerId) {
                        console.log('Sending ICE candidate to:', currentPartnerId);
                        console.log('ICE candidate type:', event.candidate.type);
                        console.log('ICE candidate protocol:', event.candidate.protocol);
                        console.log('ICE candidate address:', event.candidate.address);
                        database.ref(`calls/${currentPartnerId}/candidates`).push(event.candidate.toJSON())
                            .catch(err => console.error('Error sending candidate:', err));
                    }
                };

                // Enhanced connection state monitoring
                peerConnection.onconnectionstatechange = () => {
                    console.log('Connection state:', peerConnection.connectionState);
                    switch (peerConnection.connectionState) {
                        case 'connected':
                            addMessage('🎉 Peer connection established successfully!');
                            break;
                        case 'connecting':
                            addMessage('🔗 Establishing connection...');
                            break;
                        case 'failed':
                            addMessage('❌ Connection failed. This might be due to network restrictions or firewall settings. Try using mobile data.');
                            console.error('Connection failed - check TURN server configuration');
                            break;
                        case 'disconnected':
                            addMessage('⚠️ Connection disconnected');
                            break;
                        case 'closed':
                            addMessage('🔌 Connection closed');
                            break;
                    }
                };

                peerConnection.oniceconnectionstatechange = () => {
                    console.log('ICE connection state:', peerConnection.iceConnectionState);
                    switch (peerConnection.iceConnectionState) {
                        case 'connected':
                            addMessage('🔄 ICE negotiation completed');
                            break;
                        case 'checking':
                            addMessage('🔍 Checking network connection...');
                            break;
                        case 'failed':
                            addMessage('❌ Network connection failed. Please check your internet connection or try using mobile data.');
                            console.error('ICE connection failed - TURN servers may be needed');
                            // Attempt to restart ICE
                            if (peerConnection.restartIce) {
                                peerConnection.restartIce();
                            }
                            break;
                        case 'disconnected':
                            addMessage('⚠️ Network connection lost');
                            break;
                        case 'closed':
                            addMessage('🔌 ICE connection closed');
                            break;
                        case 'completed':
                            console.log('ICE negotiation completed');
                            break;
                    }
                };

                // Handle ICE gathering state changes
                peerConnection.onicegatheringstatechange = () => {
                    console.log('ICE gathering state:', peerConnection.iceGatheringState);
                    if (peerConnection.iceGatheringState === 'complete') {
                        console.log('ICE gathering complete');
                    }
                };

                // Handle signaling state changes
                peerConnection.onsignalingstatechange = () => {
                    console.log('Signaling state:', peerConnection.signalingState);
                };

                // Handle negotiation needed
                peerConnection.onnegotiationneeded = () => {
                    console.log('Negotiation needed');
                };

                return peerConnection;
            } catch (error) {
                console.error('Error creating peer connection:', error);
                addMessage('Error establishing connection. Please check your camera permissions and internet connection.');
                throw error;
            }
        }

        async function findStranger() {
            if (!isVideoStarted) return;
            
            waitingForPartner = true;
            updateStatus('Looking for strangers...', 'searching');
            connectBtn.disabled = true;
            skipBtn.disabled = true;
            addMessage('🔍 Searching for a stranger to chat with...');

            // Set connection timeout (30 seconds)
            const connectionTimeout = setTimeout(() => {
                if (waitingForPartner) {
                    addMessage('⏰ Connection timeout. Please try again.');
                    resetConnection();
                }
            }, 30000);

            try {
                // Clean up any existing connections first
                await cleanupExistingConnections();
                
                // Look for available users
                const snapshot = await database.ref('waitingUsers').once('value');
                const waitingUsers = snapshot.val();
                
                if (waitingUsers) {
                    const availableUsers = Object.keys(waitingUsers).filter(id => 
                        id !== currentUserId && !isUserBlocked(id)
                    );
                    
                    if (availableUsers.length > 0) {
                        // Found someone waiting
                        const partnerId = availableUsers[0];
                        currentPartnerId = partnerId;
                        
                        // Remove both users from waiting list
                        await database.ref(`waitingUsers/${currentUserId}`).remove();
                        await database.ref(`waitingUsers/${partnerId}`).remove();
                        
                        // Start call as initiator
                        await initiateCall(partnerId);
                        clearTimeout(connectionTimeout);
                        return;
                    }
                }
                
                // No one waiting, add ourselves to waiting list
                await database.ref(`waitingUsers/${currentUserId}`).set({
                    timestamp: Date.now(),
                    status: 'waiting'
                });
                
                // Listen for someone to connect with us
                const callRef = database.ref(`calls/${currentUserId}`);
                const callListener = callRef.on('value', async (snapshot) => {
                    const callData = snapshot.val();
                    if (callData && callData.offer && !peerConnection && !isUserBlocked(callData.from)) {
                        currentPartnerId = callData.from;
                        await answerCall(callData);
                        callRef.off('value', callListener);
                        clearTimeout(connectionTimeout);
                    }
                });
                
                // Store listener reference for cleanup
                window.currentCallListener = callListener;
                
            } catch (error) {
                console.error('Error finding stranger:', error);
                clearTimeout(connectionTimeout);
                updateStatus('Error connecting. Try again.', 'disconnected');
                connectBtn.disabled = false;
                waitingForPartner = false;
            }
        }

        async function cleanupExistingConnections() {
            try {
                // Remove from waiting users
                await database.ref(`waitingUsers/${currentUserId}`).remove();
                
                // Remove from calls
                await database.ref(`calls/${currentUserId}`).remove();
                
                // Clean up any existing listeners
                if (window.currentCallListener) {
                    database.ref(`calls/${currentUserId}`).off('value', window.currentCallListener);
                    window.currentCallListener = null;
                }
            } catch (error) {
                console.error('Error cleaning up connections:', error);
            }
        }

        async function initiateCall(partnerId) {
            try {
                await createPeerConnection();
                
                // Ensure local stream is ready
                if (!localStream) {
                    throw new Error('Local stream not available');
                }
                
                // Create offer with proper constraints for video negotiation
                const offer = await peerConnection.createOffer({
                    offerToReceiveAudio: true,
                    offerToReceiveVideo: true
                });
                
                await peerConnection.setLocalDescription(offer);
                
                // Send offer to partner with track information
                await database.ref(`calls/${partnerId}`).set({
                    offer: offer,
                    from: currentUserId,
                    timestamp: Date.now(),
                    hasVideo: localStream.getVideoTracks().length > 0,
                    hasAudio: localStream.getAudioTracks().length > 0,
                    videoEnabled: videoBtn.classList.contains('active'),
                    audioEnabled: micBtn.classList.contains('active')
                });
                
                console.log('Offer sent to:', partnerId, 'with video:', localStream.getVideoTracks().length > 0);
                
                // Listen for answer with timeout handling
                const answerRef = database.ref(`calls/${currentUserId}/answer`);
                const answerListener = answerRef.on('value', async (snapshot) => {
                    const answer = snapshot.val();
                    if (answer && peerConnection.signalingState === 'have-local-offer') {
                        try {
                            await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
                            answerRef.off('value', answerListener);
                            console.log('Answer received and processed');
                            onConnectionEstablished();
            
            // Force video track renegotiation after connection
            setTimeout(() => {
                renegotiateVideoTracks();
            }, 2000);
                        } catch (error) {
                            console.error('Error processing answer:', error);
                            resetConnection();
                        }
                    }
                });
                
                // Listen for ICE candidates
                listenForCandidates(currentUserId);
                
            } catch (error) {
                console.error('Error initiating call:', error);
                addMessage('Error starting video call. Please try again.');
                resetConnection();
            }
        }

        async function answerCall(callData) {
            try {
                await createPeerConnection();
                
                // Validate incoming offer
                if (!callData.offer) {
                    throw new Error('Invalid offer received');
                }
                
                await peerConnection.setRemoteDescription(new RTCSessionDescription(callData.offer));
                
                // Create answer with proper constraints
                const answer = await peerConnection.createAnswer({
                    offerToReceiveAudio: true,
                    offerToReceiveVideo: true
                });
                await peerConnection.setLocalDescription(answer);
                
                // Send answer back
                await database.ref(`calls/${callData.from}/answer`).set(answer);
                
                console.log('Answer sent to:', callData.from);
                
                // Listen for ICE candidates
                listenForCandidates(currentUserId);
                
                // Remove from waiting list
                await database.ref(`waitingUsers/${currentUserId}`).remove();
                
                onConnectionEstablished();
                
            } catch (error) {
                console.error('Error answering call:', error);
                addMessage('Error accepting video call. Please try again.');
                resetConnection();
            }
        }

        function listenForCandidates(userId) {
            const candidatesRef = database.ref(`calls/${userId}/candidates`);
            candidatesRef.on('child_added', async (snapshot) => {
                const candidate = snapshot.val();
                if (peerConnection && candidate) {
                    try {
                        console.log('Received ICE candidate:', candidate);
                        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
                        console.log('ICE candidate added successfully');
                    } catch (error) {
                        console.error('Error adding ICE candidate:', error);
                        // Don't show user-facing error for ICE candidate issues
                    }
                }
            });
            
            // Also listen for connection cleanup
            candidatesRef.on('child_removed', () => {
                console.log('ICE candidates cleaned up');
            });
        }

        function onConnectionEstablished() {
            updateStatus('Connected with stranger! 🎥', 'connected');
            addMessage('🎉 Connected! Video and audio should now be working!');
            connectBtn.disabled = true;
            skipBtn.disabled = false;
            waitingForPartner = false;
            
            // Force remote video to show and play
            setTimeout(() => {
                if (remoteVideo.srcObject) {
                    const remoteStream = remoteVideo.srcObject;
                    const videoTracks = remoteStream.getVideoTracks();
                    const audioTracks = remoteStream.getAudioTracks();
                    
                    console.log('Remote stream details:', {
                        videoTracks: videoTracks.length,
                        audioTracks: audioTracks.length,
                        videoSettings: videoTracks.length > 0 ? videoTracks[0].getSettings() : null
                    });
                    
                    // Ensure video is visible and playing
                    remoteVideo.style.display = 'block';
                    remoteVideo.play().catch(e => {
                        console.error('Error auto-playing remote video:', e);
                        // Try to force play
                        remoteVideo.muted = true;
                        remoteVideo.play();
                    });
                    
                    if (videoTracks.length > 0) {
                        addMessage('📹 Video connection established!');
                    } else {
                        addMessage('🔊 Audio only - no video received');
                        // Try to force video track negotiation
                        setTimeout(() => {
                            if (localStream && localStream.getVideoTracks().length > 0) {
                                const videoTrack = localStream.getVideoTracks()[0];
                                const sender = peerConnection.getSenders().find(s => 
                                    s.track && s.track.kind === 'video'
                                );
                                if (sender) {
                                    sender.replaceTrack(videoTrack).catch(console.error);
                                }
                            }
                        }, 3000);
                    }
                    
                    if (audioTracks.length === 0) {
                        addMessage('⚠️ No audio received - check microphone permissions');
                    }
                } else {
                    console.warn('No remote stream available in onConnectionEstablished');
                    addMessage('🔗 Connected but waiting for video...');
                }
            }, 1000);
            
            // Show user actions button
            toggleUserActions(true);
            
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
            addMessage('👋 Stranger disconnected');
            toggleUserActions(false);
            resetConnection();
        }

        async function resetConnection() {
            try {
                // Clean up existing listeners
                if (window.currentCallListener) {
                    database.ref(`calls/${currentUserId}`).off('value', window.currentCallListener);
                    window.currentCallListener = null;
                }
                
                // Close peer connection
                if (peerConnection) {
                    console.log('Closing peer connection...');
                    peerConnection.close();
                    peerConnection = null;
                }

                // Reset video elements
                remoteVideo.srcObject = null;
                remoteVideo.style.display = 'none';
                videoPlaceholder.style.display = 'block';
                videoPlaceholder.textContent = isVideoStarted ? '📹 Find a stranger to chat' : '📹 Click "Start Video" to begin';

                // Cleanup Firebase
                await cleanupFirebaseConnections();
                
                // Reset state variables
                currentPartnerId = null;
                waitingForPartner = false;
                
                // Hide user actions button
                toggleUserActions(false);
                
                updateStatus(
                    isVideoStarted ? 'Ready to find stranger' : 'Start video first', 
                    isVideoStarted ? 'connected' : 'disconnected'
                );
                connectBtn.disabled = !isVideoStarted;
                skipBtn.disabled = true;
                
                console.log('Connection reset complete');
                
            } catch (error) {
                console.error('Error during connection reset:', error);
            }
        }

        async function cleanupFirebaseConnections() {
            try {
                // Remove from waiting users
                await database.ref(`waitingUsers/${currentUserId}`).remove();
                
                // Remove from calls
                await database.ref(`calls/${currentUserId}`).remove();
                
                // Remove candidates
                await database.ref(`calls/${currentUserId}/candidates`).remove();
                
                // Clean up partner listeners
                if (currentPartnerId) {
                    database.ref(`calls/${currentPartnerId}`).off();
                }
                
                console.log('Firebase connections cleaned up');
            } catch (error) {
                console.error('Error cleaning up Firebase:', error);
            }
        }

        async function skipUser() {
            addMessage('⏭️ Skipped to find new stranger');
            resetConnection();
            
            // Small delay before finding new stranger
            setTimeout(() => {
                if (isVideoStarted) {
                    findStranger();
                }
            }, 1000);
        }

        // Chat functions
        function sendMessage() {
            const message = messageInput.value.trim();
            if (message && currentPartnerId) {
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
            } else if (message && !currentPartnerId) {
                addMessage('⚠️ Connect with someone first to send messages');
                messageInput.value = '';
            }
        }

        function listenForMessages() {
            if (currentPartnerId) {
                const messagesRef = database.ref(`messages/${currentUserId}`);
                messagesRef.on('child_added', (snapshot) => {
                    const messageData = snapshot.val();
                    if (messageData && messageData.from === currentPartnerId) {
                        const messageDiv = document.createElement('div');
                        messageDiv.className = 'message received';
                        messageDiv.textContent = messageData.text;
                        chatMessages.appendChild(messageDiv);
                        chatMessages.scrollTop = chatMessages.scrollHeight;
                        
                        // Remove the message after displaying
                        snapshot.ref.remove();
                        // If chat overlay is not open, show badge
                        if (!chatOverlay.classList.contains('open')) {
                            unreadCount++;
                            chatBadge.textContent = unreadCount;
                            chatBadge.style.display = 'flex';
                        }
                    }
                });
            }
        }

        // User presence and count
        function updateUserPresence(online) {
            if (online) {
                database.ref(`users/${currentUserId}`).set({
                    online: true,
                    timestamp: Date.now()
                });
                
                // Remove presence on disconnect
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

        // User action listeners
        document.getElementById('actionBtn').addEventListener('click', openUserActions);

        // Cleanup on page unload
        window.addEventListener('beforeunload', () => {
            stopVideo();
            database.ref(`waitingUsers/${currentUserId}`).remove();
            database.ref(`users/${currentUserId}`).remove();
        });

        // Initialize user count tracking
        updateUserCount();

        // User action functions
        function toggleUserActions(show) {
            const userActions = document.getElementById('userActions');
            if (show) {
                userActions.style.display = 'block';
            } else {
                userActions.style.display = 'none';
            }
        }

        function openUserActions() {
            document.getElementById('reportModal').style.display = 'flex';
        }

        function closeReportModal() {
            document.getElementById('reportModal').style.display = 'none';
            // Clear radio selections
            const radios = document.querySelectorAll('input[name="reportReason"]');
            radios.forEach(radio => radio.checked = false);
        }

        function blockUser() {
            if (!currentPartnerId) return;
            
            // Add to blocked users list
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

            // Send to Google Sheets
            sendReportToGoogleSheets(reportData);
            
            // Also block the user
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

        // Close modal when clicking outside
        document.getElementById('reportModal').addEventListener('click', function(e) {
            if (e.target === this) {
                closeReportModal();
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
        chatIconWrapper.addEventListener('click', openChat);
        closeChatBtn.addEventListener('click', closeChat);

        // Hide user count (mobile focus)
        document.querySelectorAll('.user-count').forEach(el => el.style.display = 'none');