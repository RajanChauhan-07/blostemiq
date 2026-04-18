'use client';

import { useState } from 'react';
import { Mail, Shield, Trash2, Plus, UserPlus, CheckCircle2 } from 'lucide-react';

export default function SettingsTeamPage() {
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('viewer');
  const [members, setMembers] = useState([
    { id: 1, email: 'satya@blostemiq.com', role: 'admin', status: 'active' },
    { id: 2, email: 'raj@blostemiq.com', role: 'analyst', status: 'pending' }
  ]);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;
    setLoading(true);
    
    // Simulate API call
    await new Promise(r => setTimeout(r, 800));
    
    setMembers([...members, { id: Date.now(), email: inviteEmail, role: inviteRole, status: 'pending' }]);
    setInviteEmail('');
    setSent(true);
    setLoading(false);
    
    setTimeout(() => setSent(false), 3000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold mb-1">Team & Permissions</h1>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Manage who has access to your workspace and their roles.
        </p>
      </div>

      {/* Invite Section */}
      <div className="glass rounded-2xl p-6 border border-white/[0.05]">
        <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
          <UserPlus size={18} className="text-[var(--accent)]" />
          Invite Members
        </h2>
        
        <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input 
              type="email" 
              required
              placeholder="Email address"
              className="input-dark w-full pl-10 pr-3 py-2.5 rounded-xl text-sm"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
            />
          </div>
          
          <div className="relative sm:w-48">
            <select
              className="input-dark w-full px-3 py-2.5 appearance-none rounded-xl text-sm"
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
            >
              <option value="admin">Admin (Full Access)</option>
              <option value="analyst">Analyst (Edit Models)</option>
              <option value="viewer">Viewer (Read Only)</option>
            </select>
            <Shield size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
          </div>
          
          <button 
            type="submit" 
            disabled={loading || sent}
            className={`btn-primary px-6 py-2.5 rounded-xl text-sm font-semibold transition-all ${sent ? 'bg-green-500/20 text-green-400' : ''}`}
          >
            {loading ? 'Sending...' : sent ? <span className="flex items-center gap-2"><CheckCircle2 size={16}/> Sent</span> : 'Send Invite'}
          </button>
        </form>
      </div>

      {/* Members List */}
      <div className="glass rounded-2xl border border-white/[0.05] overflow-hidden">
        <div className="p-6 border-b border-white/[0.05]">
          <h2 className="text-lg font-semibold">Active Members</h2>
        </div>
        
        <div className="divide-y divide-white/[0.05]">
          {members.map(member => (
            <div key={member.id} className="p-4 sm:px-6 flex items-center justify-between hover:bg-white/[0.01] transition-colors">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm" 
                  style={{ background: 'var(--surface)', color: 'var(--accent)' }}>
                  {member.email.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-medium text-sm flex items-center gap-2">
                    {member.email}
                    {member.status === 'pending' && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-500 border border-yellow-500/20">Pending</span>
                    )}
                  </p>
                  <p className="text-xs capitalize flex items-center gap-1 mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    <Shield size={12} /> {member.role}
                  </p>
                </div>
              </div>
              
              <button className="p-2 text-[var(--text-muted)] hover:text-red-400 hover:bg-white/[0.05] rounded-lg transition-all">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
