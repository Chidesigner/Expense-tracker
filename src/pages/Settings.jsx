import { useState } from 'react';
import { auth, db } from '../firebase';
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { collection, query, where, getDocs, deleteDoc } from 'firebase/firestore';

function Settings() {
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setMessage('');

    if (newPassword.length < 6) {
      setMessage('Password must be at least 6 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage('Passwords do not match');
      return;
    }

    try {
      const user = auth.currentUser;
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      
      // Re-authenticate user
      await reauthenticateWithCredential(user, credential);
      
      // Update password
      await updatePassword(user, newPassword);
      
      setMessage('Password updated successfully!');
      setShowPasswordForm(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      if (error.code === 'auth/wrong-password') {
        setMessage('Current password is incorrect');
      } else if (error.code === 'auth/weak-password') {
        setMessage('New password is too weak');
      } else {
        setMessage('Error updating password. Please try again.');
      }
    }
  };

  const handleDeleteAllData = async () => {
    const confirmed = window.confirm(
      'Are you sure you want to delete ALL your expenses? This cannot be undone!'
    );
    
    if (!confirmed) return;

    const doubleConfirm = window.confirm(
      'This will permanently delete all your data. Are you absolutely sure?'
    );
    
    if (!doubleConfirm) return;

    try {
      const user = auth.currentUser;
      const q = query(collection(db, 'expenses'), where('userId', '==', user.uid));
      const snapshot = await getDocs(q);
      
      const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
      
      alert('All expenses deleted successfully');
    } catch (error) {
      alert('Error deleting data. Please try again.');
    }
  };

  return (
    <div className="page">
      <h2>Settings</h2>

      <div className="settings-section">
        <h3>Account Information</h3>
        <div className="info-grid">
          <div className="info-item">
            <label>Email</label>
            <p>{auth.currentUser?.email || 'Loading...'}</p>
          </div>
        </div>
      </div>

      <div className="settings-section">
        <h3>Security</h3>
        
        {!showPasswordForm ? (
          <button 
            onClick={() => setShowPasswordForm(true)} 
            className="secondary-btn"
          >
            Change Password
          </button>
        ) : (
          <form onSubmit={handlePasswordChange} className="password-form">
            <h4>Change Password</h4>
            
            {message && <div className="message">{message}</div>}
            
            <input
              type="password"
              placeholder="Current Password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
            
            <input
              type="password"
              placeholder="New Password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
            
            <input
              type="password"
              placeholder="Confirm New Password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
            
            <div className="form-buttons">
              <button type="submit">Update Password</button>
              <button 
                type="button" 
                onClick={() => {
                  setShowPasswordForm(false);
                  setMessage('');
                  setCurrentPassword('');
                  setNewPassword('');
                  setConfirmPassword('');
                }}
                className="cancel-btn"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>

      <div className="settings-section">
        <h3>Data Management</h3>
        <p className="warning-text">
          ⚠️ Danger Zone: These actions cannot be undone
        </p>
        
        <button 
          onClick={handleDeleteAllData} 
          className="danger-btn"
        >
          Delete All Expenses
        </button>
      </div>

      <div className="settings-section">
        <h3>About Fintrax</h3>
        <p>Version 1.0.0</p>
        <p>Secure expense tracking with advanced security features</p>
        <ul className="security-features">
          <li>✓ Input sanitization protection</li>
          <li>✓ Rate limiting on login attempts</li>
          <li>✓ Password strength validation</li>
          <li>✓ Encrypted data storage (Firebase)</li>
          <li>✓ Secure authentication</li>
        </ul>
      </div>
    </div>
  );
}

export default Settings;