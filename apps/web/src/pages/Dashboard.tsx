import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogOut, LayoutDashboard, Settings, Hexagon } from 'lucide-react';

export default function Dashboard() {
  const { user, logout, isLoading } = useAuth();
  const navigate = useNavigate();

  // Protect route
  React.useEffect(() => {
    if (!isLoading && !user) {
      navigate('/login');
    }
  }, [user, isLoading, navigate]);

  if (isLoading || !user) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="animate-pulse"><img src="/logo.png" className="w-12 h-12 object-contain drop-shadow-[0_0_8px_rgba(225,29,72,0.6)]" alt="Loading..." /></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface flex">
      {/* Sidebar */}
      <div className="w-64 bg-surface-container-low border-r border-outline-variant/50 flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-outline-variant/50">
          <img src="/logo.png" className="w-6 h-6 object-contain mr-2" alt="FlowForge" />
          <span className="font-headline-sm font-bold text-on-surface">FlowForge</span>
        </div>
        
        <nav className="flex-1 py-6 px-4 space-y-2">
          <button className="w-full flex items-center gap-3 px-3 py-2 rounded bg-primary/10 text-primary font-medium transition-colors">
            <LayoutDashboard size={20} />
            Workflows
          </button>
          <button className="w-full flex items-center gap-3 px-3 py-2 rounded text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors">
            <Settings size={20} />
            Settings
          </button>
        </nav>
        
        <div className="p-4 border-t border-outline-variant/50">
          <div className="text-sm text-on-surface-variant truncate mb-4 px-2">
            {user.email}
          </div>
          <button 
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded text-on-surface-variant hover:bg-error/10 hover:text-error transition-colors"
          >
            <LogOut size={20} />
            Sign out
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        <header className="h-16 bg-surface-container-low border-b border-outline-variant/50 flex items-center px-8 justify-between">
          <h1 className="text-title-lg font-bold text-on-surface">Your Workflows</h1>
          <button className="px-4 py-2 rounded bg-primary-container text-on-primary-container font-medium hover:bg-secondary-container transition-colors">
            + New Workflow
          </button>
        </header>
        
        <main className="flex-1 p-8 cyber-grid">
          <div className="max-w-4xl mx-auto">
            <div className="bg-surface-container rounded-lg border border-outline-variant/50 p-12 text-center">
              <img src="/logo.png" className="w-12 h-12 object-contain mx-auto opacity-50 mb-4 grayscale" alt="No workflows" />
              <h3 className="text-title-md font-semibold text-on-surface mb-2">No workflows yet</h3>
              <p className="text-on-surface-variant mb-6">Create your first event-driven automation pipeline.</p>
              <button className="px-6 py-2 rounded bg-primary text-on-primary font-medium hover:bg-primary/90 transition-colors">
                Create Workflow
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

