import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';

type Role = 'public' | 'official' | 'researcher' | 'admin';

const AuthPanel: React.FC = () => {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [role, setRole] = useState<Role>('public');
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const u = data.user;
      setUserEmail(u?.email ?? null);
      const r = (u?.user_metadata?.role as Role) || 'public';
      setRole(r);
    }).catch(() => setUserEmail(null));
  }, []);

  const sendMagicLink = async () => {
    if (!email) return;
    setStatus('sending');
    try {
      const { error } = await supabase.auth.signInWithOtp({ email });
      if (error) throw error;
      setStatus('sent');
    } catch (e) {
      console.error(e);
      setStatus('error');
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUserEmail(null);
    setRole('public');
  };

  const updateRole = async (newRole: Role) => {
    setRole(newRole);
    // Note: In production, restrict this to admins only. For demo, allow client-side set.
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      await supabase.auth.updateUser({ data: { role: newRole } });
    }
  };

  return (
    <div className="flex items-center gap-3">
      {userEmail ? (
        <>
          <div className="text-xs text-muted-foreground hidden md:block">{userEmail}</div>
          <select
            value={role}
            onChange={(e) => updateRole(e.target.value as Role)}
            className="text-xs border rounded-md px-2 py-1 bg-background"
          >
            <option value="public">public</option>
            <option value="official">official</option>
            <option value="researcher">researcher</option>
            <option value="admin">admin</option>
          </select>
          <Button variant="outline" onClick={signOut} className="text-xs">Sign out</Button>
        </>
      ) : (
        <div className="flex items-center gap-2">
          <input
            type="email"
            placeholder="you@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="px-2 py-1 text-xs border rounded-md bg-background"
          />
          <Button onClick={sendMagicLink} className="text-xs" disabled={status==='sending' || !email}>
            {status==='sending' ? 'Sending…' : status==='sent' ? 'Sent!' : 'Send link'}
          </Button>
        </div>
      )}
    </div>
  );
};

export default AuthPanel;


