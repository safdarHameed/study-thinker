'use client';

import { DELETE_CONFIRMATION } from '@studythinker/shared';
import { Download, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { PasswordInput } from '@/components/auth/password-input';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { api, describeError } from '@/lib/api';
import { useAuth } from '@/lib/auth/auth-provider';
import { hardNavigate } from '@/lib/navigation';

export function ProfileForm() {
  const { user, updateUser } = useAuth();
  const [name, setName] = useState(user?.displayName ?? '');
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="flex flex-col gap-2 sm:flex-row sm:items-end"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          updateUser(await api.account.update(name.trim()));
          toast.success('Saved');
        } catch (err) {
          toast.error(describeError(err).description);
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="flex-1">
        <span className="sr-only">Name</span>
        <Input
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
        />
      </label>
      <Button type="submit" disabled={busy || !name.trim() || name.trim() === user?.displayName}>
        Save
      </Button>
      <p className="text-sm text-muted-foreground sm:hidden">{user?.email}</p>
    </form>
  );
}

export function AccountData() {
  const [exporting, setExporting] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function download() {
    setExporting(true);
    try {
      const data = await api.account.export();
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
      );
      const a = document.createElement('a');
      a.href = url;
      a.download = 'studythinker-export.json';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(describeError(err).description);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" onClick={() => void download()} disabled={exporting}>
        <Download aria-hidden /> {exporting ? 'Preparing…' : 'Export'}
      </Button>
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="destructive-soft">
            <Trash2 aria-hidden /> Delete account
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogTitle>Delete your account?</DialogTitle>
          <DialogDescription>Everything is erased for good.</DialogDescription>
          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              setDeleting(true);
              setError(null);
              try {
                await api.account.remove({ password, confirmation: DELETE_CONFIRMATION });
                hardNavigate('/?account=deleted');
              } catch (err) {
                setError(describeError(err).description);
                setDeleting(false);
              }
            }}
          >
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Password</span>
              <PasswordInput
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">
                Type <strong>{DELETE_CONFIRMATION}</strong> to confirm
              </span>
              <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </label>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <DialogFooter>
              <Button
                type="submit"
                variant="destructive"
                disabled={deleting || !password || confirm !== DELETE_CONFIRMATION}
              >
                {deleting ? 'Deleting…' : 'Delete everything'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
