import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from 'av-toastx';
import ThemeToggle from '../components/ThemeToggle';

export default function Account() {
  const { user, logout, updateProfile, updatePassword } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [name, setName] = useState(user?.name || '');
  const [dob, setDob] = useState(user?.dob ? new Date(user.dob).toISOString().split('T')[0] : '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [showSignoutConfirm, setShowSignoutConfirm] = useState(false);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdatingProfile(true);
    try {
      await updateProfile({ name, dob });
      toast.success('Profile updated successfully');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to update profile');
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword) return;
    setIsUpdatingPassword(true);
    try {
      await updatePassword({ currentPassword, newPassword });
      toast.success('Password updated successfully');
      setCurrentPassword('');
      setNewPassword('');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to update password');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleSignout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (err) {
      toast.error('Failed to sign out');
    }
  };

  return (
    <div className="min-h-screen bg-base-100 text-base-content/70 flex flex-col font-sans">
      {/* Header */}
      <header className="flex justify-between items-center w-full px-6 h-14 border-b border-base-300 bg-base-100 z-40 shrink-0">
        <div className="flex items-center gap-4">
          <Link 
            to="/dashboard" 
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-white/[0.03] hover:bg-white/[0.06] text-base-content/60 hover:text-base-content transition-all text-xs font-medium border border-base-300"
            title="Back to Dashboard"
          >
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            <span>Back</span>
          </Link>
          <div className="flex items-center gap-4">
            <ThemeToggle />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-base-content tracking-wider uppercase">Account Settings</span>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-8 flex justify-center">
        <div className="w-full max-w-2xl space-y-8">
          
          {/* Profile Details Section */}
          <section className="p-6 rounded-xl border border-base-300 bg-base-100">
            <h2 className="text-lg font-semibold text-base-content mb-6 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">person</span>
              Profile Details
            </h2>
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-base-content/60 mb-1">Email Address (Read-only)</label>
                  <input 
                    type="email" 
                    value={user?.email || ''} 
                    disabled 
                    className="w-full bg-white/[0.02] border border-base-300 rounded-md px-3 py-2 text-sm text-base-content/50 cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-base-content/60 mb-1">Full Name</label>
                  <input 
                    type="text" 
                    value={name} 
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. John Doe"
                    className="w-full bg-white/[0.04] border border-base-300 rounded-md px-3 py-2 text-sm text-base-content focus:border-[#e11d48] focus:outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-base-content/60 mb-1">Date of Birth</label>
                  <input 
                    type="date" 
                    value={dob} 
                    onChange={(e) => setDob(e.target.value)}
                    className="w-full bg-white/[0.04] border border-base-300 rounded-md px-3 py-2 text-sm text-base-content focus:border-[#e11d48] focus:outline-none transition-colors"
                  />
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <button 
                  type="submit" 
                  disabled={isUpdatingProfile}
                  className="px-4 py-2 rounded-md bg-primary hover:bg-primary-focus text-base-content text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUpdatingProfile ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </form>
          </section>

          {/* Password Section */}
          <section className="p-6 rounded-xl border border-base-300 bg-base-100">
            <h2 className="text-lg font-semibold text-base-content mb-6 flex items-center gap-2">
              <span className="material-symbols-outlined text-amber-400">lock</span>
              Change Password
            </h2>
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div className="space-y-4 max-w-md">
                <div>
                  <label className="block text-xs font-medium text-base-content/60 mb-1">Current Password</label>
                  <input 
                    type="password" 
                    value={currentPassword} 
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    className="w-full bg-white/[0.04] border border-base-300 rounded-md px-3 py-2 text-sm text-base-content focus:border-amber-400 focus:outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-base-content/60 mb-1">New Password</label>
                  <input 
                    type="password" 
                    value={newPassword} 
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    className="w-full bg-white/[0.04] border border-base-300 rounded-md px-3 py-2 text-sm text-base-content focus:border-amber-400 focus:outline-none transition-colors"
                  />
                </div>
              </div>
              <div className="flex justify-start pt-2">
                <button 
                  type="submit" 
                  disabled={isUpdatingPassword || !currentPassword || !newPassword}
                  className="px-4 py-2 rounded-md bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30 text-sm font-medium transition-all disabled:opacity-50"
                >
                  {isUpdatingPassword ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </section>

          {/* Danger Zone Section */}
          <section className="p-6 rounded-xl border border-rose-500/20 bg-rose-500/[0.02]">
            <h2 className="text-lg font-semibold text-rose-400 mb-2 flex items-center gap-2">
              <span className="material-symbols-outlined">warning</span>
              Danger Zone
            </h2>
            <p className="text-sm text-base-content/60 mb-6">Proceeding here will end your current session.</p>
            
            {showSignoutConfirm ? (
              <div className="p-4 rounded-md border border-rose-500/30 bg-rose-500/10 flex flex-col gap-3">
                <p className="text-sm text-base-content">Are you sure you want to sign out?</p>
                <div className="flex gap-3">
                  <button 
                    onClick={handleSignout}
                    className="px-4 py-1.5 rounded bg-rose-500 hover:bg-rose-600 text-base-content text-sm font-medium transition-colors"
                  >
                    Yes, sign out
                  </button>
                  <button 
                    onClick={() => setShowSignoutConfirm(false)}
                    className="px-4 py-1.5 rounded border border-base-300 text-base-content/70 hover:bg-white/[0.05] text-sm font-medium transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button 
                onClick={() => setShowSignoutConfirm(true)}
                className="px-4 py-2 rounded-md border border-rose-500/50 text-rose-400 hover:bg-rose-500/10 text-sm font-medium transition-all flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px]">logout</span>
                Sign Out
              </button>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

