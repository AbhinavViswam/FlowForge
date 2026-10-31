import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { ArrowLeft, User, Lock, LogOut } from 'lucide-react';
import ThemeToggle from '../components/ThemeToggle';
import Logo from '../components/Logo';
import Connections from '../components/Connections';
import { Button, Input, Field, Card } from '../components/ui';

export default function Account() {
  const { user, logout, updateProfile, updatePassword } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState(user?.name || '');
  const [dob, setDob] = useState(user?.dob ? new Date(user.dob).toISOString().split('T')[0] : '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [confirmSignout, setConfirmSignout] = useState(false);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await updateProfile({ name, dob });
      toast.success('Profile updated');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword) return;
    setSavingPassword(true);
    try {
      await updatePassword({ currentPassword, newPassword });
      toast.success('Password updated');
      setCurrentPassword('');
      setNewPassword('');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to update password');
    } finally {
      setSavingPassword(false);
    }
  };

  const handleSignout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch {
      toast.error('Failed to sign out');
    }
  };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-line bg-surface/80 backdrop-blur px-4 sm:px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1.5 px-2.5 h-8 rounded-lg text-sm text-muted hover:text-ink hover:bg-surface-2 transition-colors"
          >
            <ArrowLeft size={16} />
            <span className="hidden sm:inline">Back</span>
          </Link>
          <div className="h-5 w-px bg-line" />
          <Logo size="sm" />
        </div>
        <ThemeToggle />
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-10 flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-ink">Account settings</h1>
          <p className="text-sm text-muted mt-1">Manage your profile, password, and email connections.</p>
        </div>

        {/* Profile */}
        <Card className="p-6">
          <div className="flex items-center gap-2.5 mb-5">
            <div className="w-9 h-9 rounded-lg bg-accent-soft text-accent flex items-center justify-center">
              <User size={18} />
            </div>
            <h2 className="text-base font-semibold text-ink">Profile</h2>
          </div>
          <form onSubmit={handleUpdateProfile} className="flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Email" hint="Your email can't be changed.">
                <Input type="email" value={user?.email || ''} disabled />
              </Field>
              <Field label="Full name">
                <Input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" />
              </Field>
              <Field label="Date of birth">
                <Input type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
              </Field>
            </div>
            <div className="flex justify-end">
              <Button type="submit" loading={savingProfile}>{savingProfile ? 'Saving…' : 'Save changes'}</Button>
            </div>
          </form>
        </Card>

        {/* Password */}
        <Card className="p-6">
          <div className="flex items-center gap-2.5 mb-5">
            <div className="w-9 h-9 rounded-lg bg-accent-soft text-accent flex items-center justify-center">
              <Lock size={18} />
            </div>
            <h2 className="text-base font-semibold text-ink">Password</h2>
          </div>
          <form onSubmit={handleUpdatePassword} className="flex flex-col gap-4 max-w-md">
            <Field label="Current password">
              <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
            </Field>
            <Field label="New password" hint="At least 8 characters.">
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
            </Field>
            <div className="flex justify-start">
              <Button type="submit" variant="secondary" loading={savingPassword} disabled={!currentPassword || !newPassword}>
                {savingPassword ? 'Updating…' : 'Update password'}
              </Button>
            </div>
          </form>
        </Card>

        {/* Email connections */}
        <Connections />

        {/* Sign out */}
        <Card className="p-6 border-danger/20">
          <h2 className="text-base font-semibold text-ink mb-1">Sign out</h2>
          <p className="text-sm text-muted mb-4">End your session on this device.</p>
          {confirmSignout ? (
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm text-ink">Are you sure?</span>
              <Button variant="danger" onClick={handleSignout}>Yes, sign out</Button>
              <Button variant="ghost" onClick={() => setConfirmSignout(false)}>Cancel</Button>
            </div>
          ) : (
            <Button variant="danger" onClick={() => setConfirmSignout(true)}>
              <LogOut size={16} /> Sign out
            </Button>
          )}
        </Card>
      </main>
    </div>
  );
}
