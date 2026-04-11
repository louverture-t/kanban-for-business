// Variant C – Web Design Guidelines (Accessibility-First)
// Patterns: semantic HTML landmarks, explicit ARIA labels, high-contrast focus rings,
// sr-only helper text, role="status" live region for mutation feedback

import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@apollo/client/react';
import { useAuth } from '@client/hooks/use-auth';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@client/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@client/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@client/components/ui/select';
import { Button } from '@client/components/ui/button';
import { Input } from '@client/components/ui/input';
import { Badge } from '@client/components/ui/badge';
import { Label } from '@client/components/ui/label';
import {
  ADMIN_USERS_QUERY,
  ADMIN_INVITATIONS_QUERY,
  UPDATE_USER_MUTATION,
  CREATE_INVITATION_MUTATION,
  ADD_PROJECT_MEMBER_MUTATION,
  REMOVE_PROJECT_MEMBER_MUTATION,
} from '@client/graphql/admin-operations';
import { PROJECTS_QUERY, PROJECT_MEMBERS_QUERY } from '@client/graphql/operations';

// ─── Types ─────────────────────────────────────────────────

interface IUserRow {
  _id: string;
  username: string;
  email: string;
  role: 'superadmin' | 'manager' | 'user';
  active: boolean;
  createdAt: string;
}

interface IInvitationRow {
  _id: string;
  email: string;
  token: string;
  role: string;
  projectId?: string;
  status: 'pending' | 'accepted' | 'expired';
  expiresAt: string;
  createdAt: string;
}

interface IProjectMember {
  _id: string;
  userId: string;
  user: { _id: string; username: string };
}

interface IProject {
  _id: string;
  name: string;
}

// ─── Status badge — explicit color classes for contrast ───

const STATUS_CLASSES: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  accepted: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  expired: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
};

function InviteStatusBadge({ status }: { status: string }) {
  const cls = STATUS_CLASSES[status] ?? 'bg-muted text-muted-foreground';
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}
      aria-label={`Status: ${status}`}
    >
      {status}
    </span>
  );
}

// ─── AdminPage ─────────────────────────────────────────────

type UserRole = 'user' | 'manager' | 'superadmin';

interface IPendingRoleChange {
  userId: string;
  username: string;
  currentRole: UserRole;
  newRole: UserRole;
}

function formatCreatedAt(value: string | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString();
}

export function AdminPage() {
  const { user, loading: authLoading } = useAuth();
  const currentUserId = user?._id ?? '';

  // Live region feedback
  const [announcement, setAnnouncement] = useState('');

  // Pending role-change (opens confirmation dialog)
  const [pendingRoleChange, setPendingRoleChange] = useState<IPendingRoleChange | null>(null);

  // ── Users ──
  const {
    data: usersData,
    error: usersError,
    refetch: refetchUsers,
  } = useQuery<{ adminUsers: IUserRow[] }>(
    ADMIN_USERS_QUERY,
    { skip: authLoading || !user },
  );
  const users = useMemo<IUserRow[]>(() => usersData?.adminUsers ?? [], [usersData]);

  const [updateUser] = useMutation(UPDATE_USER_MUTATION, {
    onCompleted: () => {
      refetchUsers();
      setAnnouncement('User updated successfully.');
    },
  });

  function handleRoleSelect(u: IUserRow, nextRole: string) {
    if (nextRole === u.role) return;
    setPendingRoleChange({
      userId: u._id,
      username: u.username,
      currentRole: u.role,
      newRole: nextRole as UserRole,
    });
  }

  function confirmRoleChange() {
    if (!pendingRoleChange) return;
    updateUser({
      variables: { id: pendingRoleChange.userId, role: pendingRoleChange.newRole },
    });
    setPendingRoleChange(null);
  }

  function cancelRoleChange() {
    setPendingRoleChange(null);
  }

  // ── Invitations ──
  const {
    data: invData,
    error: invitationsError,
    refetch: refetchInvitations,
  } = useQuery<{ adminInvitations: IInvitationRow[] }>(
    ADMIN_INVITATIONS_QUERY,
    { skip: authLoading || !user },
  );
  const invitations = useMemo<IInvitationRow[]>(() => invData?.adminInvitations ?? [], [invData]);

  const [invEmail, setInvEmail] = useState('');
  const [invRole, setInvRole] = useState('user');
  const [invProjectId, setInvProjectId] = useState('');
  const [invError, setInvError] = useState('');

  const [createInvitation, { loading: creating }] = useMutation(CREATE_INVITATION_MUTATION, {
    onCompleted: () => {
      setInvEmail('');
      setInvRole('user');
      setInvProjectId('');
      setAnnouncement('Invitation created. Copy the URL to share it.');
      refetchInvitations();
    },
    onError: (e) => setInvError(e.message),
  });

  function handleCreateInvite() {
    if (!invEmail.trim()) return;
    setInvError('');
    createInvitation({
      variables: {
        email: invEmail.trim(),
        role: invRole,
        projectId: invProjectId || undefined,
      },
    });
  }

  function copyInviteUrl(token: string) {
    navigator.clipboard.writeText(`${window.location.origin}/register?token=${token}`);
    setAnnouncement('Invite URL copied to clipboard.');
  }

  // ── Membership ──
  const { data: projectsData } = useQuery<{ projects: IProject[] }>(PROJECTS_QUERY);
  const projects = useMemo<IProject[]>(() => projectsData?.projects ?? [], [projectsData]);

  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [addUserId, setAddUserId] = useState('');

  const { data: membersData, refetch: refetchMembers } = useQuery<{ projectMembers: IProjectMember[] }>(PROJECT_MEMBERS_QUERY, {
    variables: { projectId: selectedProjectId },
    skip: !selectedProjectId,
  });
  const members = useMemo<IProjectMember[]>(() => membersData?.projectMembers ?? [], [membersData]);

  const memberIds = useMemo(() => new Set(members.map((m) => m.userId)), [members]);
  const nonMembers = useMemo(() => users.filter((u) => !memberIds.has(u._id)), [users, memberIds]);

  const [memberError, setMemberError] = useState('');
  const [addMember, { loading: addingMember }] = useMutation(ADD_PROJECT_MEMBER_MUTATION, {
    onCompleted: () => {
      setAddUserId('');
      setMemberError('');
      setAnnouncement('Member added to project.');
      refetchMembers();
    },
    onError: (e) => setMemberError(e.message),
  });
  const [removeMember] = useMutation(REMOVE_PROJECT_MEMBER_MUTATION, {
    onCompleted: () => {
      setAnnouncement('Member removed from project.');
      refetchMembers();
    },
  });

  // ── Render ──
  return (
    <main aria-labelledby="admin-heading" className="mx-auto max-w-5xl space-y-6 p-4 sm:p-8">
      {/* Screen-reader live region for mutation feedback */}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </div>

      {/* Role-change confirmation dialog (controlled) */}
      <AlertDialog
        open={pendingRoleChange !== null}
        onOpenChange={(open) => { if (!open) cancelRoleChange(); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingRoleChange
                ? `Change role for ${pendingRoleChange.username}?`
                : 'Change role?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingRoleChange
                ? `This will change ${pendingRoleChange.username}'s role from ${pendingRoleChange.currentRole} to ${pendingRoleChange.newRole}. Their permissions will update immediately.`
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelRoleChange}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRoleChange}>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div>
        <h1 id="admin-heading" className="text-2xl font-bold tracking-tight text-foreground">
          Admin Panel
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage users, invitations, and project membership.
        </p>
      </div>

      <Tabs defaultValue="users">
        <TabsList aria-label="Admin sections">
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="invitations">Invitations</TabsTrigger>
          <TabsTrigger value="membership">Membership</TabsTrigger>
        </TabsList>

        {/* ─── Tab 1: Users ─── */}
        <TabsContent value="users" className="mt-4">
          <section aria-label="User management">
            {usersError && (
              <div
                role="alert"
                className="mb-3 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive"
              >
                Failed to load users: {usersError.message}
              </div>
            )}
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[560px] text-sm" aria-label="Users">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th scope="col" className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Username</th>
                    <th scope="col" className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Email</th>
                    <th scope="col" className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Role</th>
                    <th scope="col" className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Created</th>
                    <th scope="col" className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</th>
                    <th scope="col" className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => {
                    const isSelf = u._id === currentUserId;
                    return (
                      <tr key={u._id} className="border-b border-border last:border-0">
                        <td className="px-3 py-2 font-medium text-foreground">{u.username}</td>
                        <td className="px-3 py-2 text-muted-foreground">{u.email}</td>
                        <td className="px-3 py-2">
                          <Select
                            value={u.role}
                            onValueChange={(v) => handleRoleSelect(u, v)}
                          >
                            <SelectTrigger
                              className="h-8 w-32 focus-visible:ring-2 focus-visible:ring-ring"
                              aria-label={`Role for ${u.username}`}
                              disabled={isSelf}
                              title={isSelf ? 'Cannot change your own role' : undefined}
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="user">User</SelectItem>
                              <SelectItem value="manager">Manager</SelectItem>
                              <SelectItem value="superadmin">Superadmin</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {formatCreatedAt(u.createdAt)}
                        </td>
                        <td className="px-3 py-2">
                          <Badge variant={u.active ? 'default' : 'secondary'}>
                            {u.active ? 'Active' : 'Inactive'}
                          </Badge>
                        </td>
                        <td className="px-3 py-2">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                size="sm"
                                variant={u.active ? 'destructive' : 'outline'}
                                disabled={isSelf}
                                aria-label={`${u.active ? 'Deactivate' : 'Activate'} ${u.username}`}
                                title={isSelf ? 'Cannot change your own account status' : undefined}
                              >
                                {u.active ? 'Deactivate' : 'Activate'}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  {u.active ? 'Deactivate' : 'Activate'} {u.username}?
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  {u.active
                                    ? 'This user will lose access until reactivated.'
                                    : 'This user will regain full access.'}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => updateUser({ variables: { id: u._id, active: !u.active } })}
                                >
                                  Confirm
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </td>
                      </tr>
                    );
                  })}
                  {users.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-3 py-8 text-center text-sm text-muted-foreground">
                        No users found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </TabsContent>

        {/* ─── Tab 2: Invitations ─── */}
        <TabsContent value="invitations" className="mt-4 space-y-4">
          <section aria-label="Invitation management">
            {invitationsError && (
              <div
                role="alert"
                className="mb-3 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive"
              >
                Failed to load invitations: {invitationsError.message}
              </div>
            )}
            <fieldset className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-muted/20 p-4">
              <legend className="sr-only">Create a new invitation</legend>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="inv-email">Email address</Label>
                <Input
                  id="inv-email"
                  type="email"
                  placeholder="colleague@example.com"
                  value={invEmail}
                  onChange={(e) => setInvEmail(e.target.value)}
                  className="w-56 focus-visible:ring-2 focus-visible:ring-ring"
                  aria-required="true"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="inv-role">Role</Label>
                <Select value={invRole} onValueChange={setInvRole}>
                  <SelectTrigger id="inv-role" className="w-32 focus-visible:ring-2 focus-visible:ring-ring">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="superadmin">Superadmin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="inv-project">Project (optional)</Label>
                <Select value={invProjectId || '__none__'} onValueChange={(v) => setInvProjectId(v === '__none__' ? '' : v)}>
                  <SelectTrigger id="inv-project" className="w-44 focus-visible:ring-2 focus-visible:ring-ring">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {projects.map((p) => (
                      <SelectItem key={p._id} value={p._id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={handleCreateInvite}
                disabled={creating || !invEmail.trim()}
                aria-busy={creating}
              >
                {creating ? 'Sending…' : 'Create Invitation'}
              </Button>
              {invError && (
                <p role="alert" className="w-full text-sm text-destructive">
                  {invError}
                </p>
              )}
            </fieldset>

            <div className="mt-4 overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[520px] text-sm" aria-label="Invitations">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    {['Email', 'Role', 'Status', 'Expires', 'Link'].map((h) => (
                      <th scope="col" key={h} className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {invitations.map((inv) => (
                    <tr key={inv._id} className="border-b border-border last:border-0">
                      <td className="px-3 py-2 text-foreground">{inv.email}</td>
                      <td className="px-3 py-2 capitalize text-muted-foreground">{inv.role}</td>
                      <td className="px-3 py-2"><InviteStatusBadge status={inv.status} /></td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {new Date(inv.expiresAt).toLocaleDateString()}
                      </td>
                      <td className="px-3 py-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => copyInviteUrl(inv.token)}
                          aria-label={`Copy invite URL for ${inv.email}`}
                          className="focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          Copy URL
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {invitations.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-3 py-8 text-center text-sm text-muted-foreground">
                        No invitations yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </TabsContent>

        {/* ─── Tab 3: Membership ─── */}
        <TabsContent value="membership" className="mt-4 space-y-4">
          <section aria-label="Project membership management">
            <div className="flex items-center gap-3">
              <Label htmlFor="proj-select">Project</Label>
              <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                <SelectTrigger
                  id="proj-select"
                  className="w-56 focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="Select a project to manage membership"
                >
                  <SelectValue placeholder="Select a project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p._id} value={p._id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedProjectId && (
              <>
                <div className="flex items-end gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="add-user">Add user to project</Label>
                    <Select value={addUserId} onValueChange={setAddUserId}>
                      <SelectTrigger
                        id="add-user"
                        className="w-52 focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <SelectValue placeholder="Select user" />
                      </SelectTrigger>
                      <SelectContent>
                        {usersError ? (
                          <SelectItem value="__empty__" disabled>
                            Could not load users — try refreshing.
                          </SelectItem>
                        ) : nonMembers.length === 0 ? (
                          <SelectItem value="__empty__" disabled>
                            All users are already members of this project.
                          </SelectItem>
                        ) : (
                          nonMembers.map((u) => (
                            <SelectItem key={u._id} value={u._id}>{u.username}</SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    onClick={() => addMember({ variables: { projectId: selectedProjectId, userId: addUserId } })}
                    disabled={!addUserId || addingMember}
                    aria-busy={addingMember}
                    aria-label="Add selected user to project"
                    className="focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {addingMember ? 'Adding…' : 'Add'}
                  </Button>
                </div>
                {memberError && (
                  <p role="alert" className="text-sm text-destructive">
                    {memberError}
                  </p>
                )}

                <div className="overflow-hidden rounded-lg border border-border">
                  <table className="w-full text-sm" aria-label="Project members">
                    <thead>
                      <tr className="border-b border-border bg-muted/40">
                        <th scope="col" className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Username</th>
                        <th scope="col" className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {members.map((m) => {
                        const displayName = m.user?.username ?? '(unknown user)';
                        return (
                        <tr key={m._id} className="border-b border-border last:border-0">
                          <td className="px-3 py-2 text-foreground">{displayName}</td>
                          <td className="px-3 py-2">
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  aria-label={`Remove ${displayName} from project`}
                                  className="focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                  Remove
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Remove {displayName}?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This user will lose access to this project's tasks and board.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => removeMember({ variables: { projectId: selectedProjectId, userId: m.userId } })}
                                  >
                                    Remove
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </td>
                        </tr>
                        );
                      })}
                      {members.length === 0 && (
                        <tr>
                          <td colSpan={2} className="px-3 py-8 text-center text-sm text-muted-foreground">
                            No members in this project yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>
        </TabsContent>
      </Tabs>
    </main>
  );
}
