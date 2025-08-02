# 💕 Zair - Romantic Dating Application

A beautiful, romantic dating application built with Firebase authentication, WebRTC video calling, and a stunning pink-themed UI designed for meaningful connections.

## ✨ Features

### 🔐 Authentication & Security
- **Email/Password Signup** with age verification (18+)
- **Google Sign-In** integration
- **Age Restriction** - Only 18+ users allowed
- **Secure Firebase Authentication**

### 👤 User Profile Management
- **Profile Sidebar** with slide-in animation
- **Real User Information** display (name, email, age)
- **Profile Picture** support
- **User Statistics** (connections, matches)
- **Quick Logout** functionality

### 💝 Dating Features
- **Video Calling** with WebRTC
- **Real-time Matching** with other users
- **Romantic UI** with pink/rose color scheme
- **Smooth Animations** and transitions
- **Chat Integration** during video calls
- **Connection Logging** for user stats

### 🎨 Design Features
- **Responsive Design** for mobile devices
- **Romantic Pink Theme** throughout
- **Floating Hearts Background Animation**
- **Gradient Buttons** and backgrounds
- **Smooth Slide-in Profile Sidebar**
- **Modern Glass-morphism Effects**

## 🚀 Getting Started

### Prerequisites
- A modern web browser (Chrome, Firefox, Safari, Edge)
- Firebase account for authentication
- HTTPS enabled (required for camera/microphone access)

### Setup Instructions

1. **Clone or Download** the project files
2. **Create Firebase Project**:
   - Go to [Firebase Console](https://console.firebase.google.com)
   - Create a new project
   - Enable Authentication (Email/Password and Google Sign-In)
   - Enable Realtime Database
   - Enable Storage

3. **Update Firebase Configuration**:
   - Open `auth.js` and `app.js`
   - Replace the firebaseConfig with your project's configuration

4. **Deploy to HTTPS Server**:
   - Use Firebase Hosting, Netlify, Vercel, or any HTTPS-enabled server
   - Camera and microphone require HTTPS in modern browsers

### Firebase Configuration

Your Firebase config should look like:
```javascript
const firebaseConfig = {
    apiKey: "your-api-key",
    authDomain: "your-project.firebaseapp.com",
    databaseURL: "https://your-project.firebaseio.com",
    projectId: "your-project-id",
    storageBucket: "your-project.appspot.com",
    messagingSenderId: "your-sender-id",
    appId: "your-app-id"
};
```

## 📱 Usage

### For New Users
1. **Sign Up** with email/password or Google
2. **Verify Age** (18+ required)
3. **Complete Profile** with name and age
4. **Start Video** to find matches
5. **Connect** with other users

### For Returning Users
1. **Sign In** with existing credentials
2. **View Profile** using the top-left user icon
3. **Check Stats** (connections, matches)
4. **Start Video** to find new matches

### Video Calling
- **Start Video**: Enable camera and microphone
- **Find Match**: Connect with available users
- **Chat**: Use the chat overlay during calls
- **Skip**: Move to the next match
- **Stop**: End the session

## 🎯 User Flow

```
Auth Page (auth.html) → Main App (index.html)
     ↓                        ↓
Sign Up/Sign In → Profile → Video Dating
     ↓              ↓          ↓
Age Verification → Stats → Match & Chat
```

## 🛡️ Security Features

- **Age Verification**: Strict 18+ requirement
- **Firebase Auth**: Industry-standard security
- **HTTPS Only**: Required for media access
- **User Privacy**: No personal data exposed during calls
- **Safe Matching**: Anonymous until both parties agree

## 🎨 Design Philosophy

The app embraces a **romantic aesthetic** with:
- **Soft Pink Gradients** (#ff9a9e → #fecfef)
- **Heart Animations** and floating elements
- **Gentle Curves** and rounded corners
- **Romantic Typography** (Poppins font)
- **Subtle Shadows** and depth
- **Love-themed Icons** and imagery

## 📊 Firebase Database Structure

```
users/
  └── {userId}/
      ├── displayName
      ├── email
      ├── age
      ├── photoURL
      ├── createdAt
      └── lastLogin

presence/
  └── {userId}/
      ├── online
      ├── lastSeen
      └── displayName

waitingUsers/
  └── {userId}/
      ├── timestamp
      └── displayName

connections/
  └── {userId}/
      └── {connectionId}/
          ├── partnerId
          ├── partnerName
          └── timestamp
```

## 🔧 Technical Stack

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Authentication**: Firebase Auth
- **Database**: Firebase Realtime Database
- **Storage**: Firebase Storage
- **Video**: WebRTC with STUN servers
- **UI**: Custom CSS with romantic theme
- **Icons**: Font Awesome
- **Fonts**: Google Fonts (Poppins)

## 🌟 Future Enhancements

- [ ] **Profile Picture Upload**
- [ ] **Advanced Filtering** (age, location, interests)
- [ ] **Matching Preferences**
- [ ] **Friend System**
- [ ] **Premium Features**
- [ ] **Push Notifications**
- [ ] **Dark Mode Toggle**
- [ ] **Language Support**

## 📞 Support

For issues or questions:
1. Check browser console for errors
2. Ensure HTTPS is enabled
3. Verify Firebase configuration
4. Check camera/microphone permissions

## 💝 Credits

Created with ❤️ for meaningful connections and romantic encounters. Built with modern web technologies and designed for love-seekers worldwide.

---

**Zair** - Where hearts meet technology 💕