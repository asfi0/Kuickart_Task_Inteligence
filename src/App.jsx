import React, { useEffect, useMemo, useState } from 'react';
import {
  LayoutDashboard,
  ClipboardList,
  CheckSquare,
  Users,
  LogOut,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  Clock3,
  Building2,
  Shield,
  Filter,
  LockKeyhole,
  Mail,
  UserCircle2,
} from 'lucide-react';

const STORAGE_KEY = 'kuickart-task-manager-v2';
const COUNTRIES = ['Germany', 'France', 'Pakistan'];
const PRIORITIES = ['Low', 'Medium', 'High'];
const STATUSES = {
  TODO: 'todo',
  IN_PROGRESS: 'in_progress',
  PENDING_APPROVAL: 'pending_approval',
  APPROVED: 'approved',
  REJECTED: 'rejected',
};

const ROLE_LABELS = {
  owner: 'Owner',
  admin: 'Admin',
  user: 'User',
};

const DEMO_PASSWORDS = {
  owner: 'owner123',
  admin: 'admin123',
  user: 'user123',
};

const seedUsers = [
  { id: 'owner-de', name: 'Germany Owner', role: 'owner', country: 'Germany', email: 'owner.germany@kuickart.local', password: DEMO_PASSWORDS.owner },
  { id: 'owner-fr', name: 'France Owner', role: 'owner', country: 'France', email: 'owner.france@kuickart.local', password: DEMO_PASSWORDS.owner },
  { id: 'owner-pk', name: 'Pakistan Owner', role: 'owner', country: 'Pakistan', email: 'owner.pakistan@kuickart.local', password: DEMO_PASSWORDS.owner },
  { id: 'admin-de', name: 'Germany Admin', role: 'admin', country: 'Germany', email: 'admin.germany@kuickart.local', password: DEMO_PASSWORDS.admin },
  { id: 'admin-fr', name: 'France Admin', role: 'admin', country: 'France', email: 'admin.france@kuickart.local', password: DEMO_PASSWORDS.admin },
  { id: 'admin-pk', name: 'Pakistan Admin', role: 'admin', country: 'Pakistan', email: 'admin.pakistan@kuickart.local', password: DEMO_PASSWORDS.admin },
  { id: 'user-de-1', name: 'Lena', role: 'user', country: 'Germany', email: 'lena@kuickart.local', password: DEMO_PASSWORDS.user },
  { id: 'user-de-2', name: 'Noah', role: 'user', country: 'Germany', email: 'noah@kuickart.local', password: DEMO_PASSWORDS.user },
  { id: 'user-fr-1', name: 'Amina', role: 'user', country: 'France', email: 'amina@kuickart.local', password: DEMO_PASSWORDS.user },
  { id: 'user-fr-2', name: 'Youssef', role: 'user', country: 'France', email: 'youssef@kuickart.local', password: DEMO_PASSWORDS.user },
  { id: 'user-pk-1', name: 'Ali', role: 'user', country: 'Pakistan', email: 'ali@kuickart.local', password: DEMO_PASSWORDS.user },
  { id: 'user-pk-2', name: 'Fatima', role: 'user', country: 'Pakistan', email: 'fatima@kuickart.local', password: DEMO_PASSWORDS.user },
];

const seedTasks = [
  {
    id: crypto.randomUUID(),
    title: 'Review Germany supplier invoice batch',
    description: 'Check pricing, tax values and upload reviewed note for the Germany finance cycle.',
    country: 'Germany',
    priority: 'High',
    category: 'Finance',
    assignedTo: 'user-de-1',
    createdBy: 'admin-de',
    reviewedBy: null,
    dueDate: futureDate(2),
    status: STATUSES.IN_PROGRESS,
    completionNote: '',
    rejectionReason: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: crypto.randomUUID(),
    title: 'Publish France Ramadan landing update',
    description: 'Replace hero banner, check CTA links and confirm product collection visibility.',
    country: 'France',
    priority: 'Medium',
    category: 'Marketing',
    assignedTo: 'user-fr-1',
    createdBy: 'admin-fr',
    reviewedBy: null,
    dueDate: futureDate(1),
    status: STATUSES.TODO,
    completionNote: '',
    rejectionReason: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: crypto.randomUUID(),
    title: 'Verify Pakistan warehouse stock variance',
    description: 'Match physical stock with sheet counts and submit discrepancy note.',
    country: 'Pakistan',
    priority: 'High',
    category: 'Operations',
    assignedTo: 'user-pk-1',
    createdBy: 'admin-pk',
    reviewedBy: null,
    dueDate: futureDate(3),
    status: STATUSES.PENDING_APPROVAL,
    completionNote: 'Count verified. Two SKU variances flagged in the note.',
    rejectionReason: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const initialData = {
  users: seedUsers,
  tasks: seedTasks,
  activity: [makeActivity('system', 'system_seeded', 'Demo users and starter tasks loaded.')],
  session: {
    isAuthenticated: false,
    userId: null,
  },
};

function futureDate(days) {
  const value = new Date();
  value.setDate(value.getDate() + days);
  return value.toISOString().slice(0, 10);
}

function makeActivity(actorId, action, message, taskId = null) {
  return {
    id: crypto.randomUUID(),
    actorId,
    action,
    message,
    taskId,
    createdAt: new Date().toISOString(),
  };
}

function loadAppState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initialData));
      return initialData;
    }
    const parsed = JSON.parse(raw);
    if (!parsed.session) {
      parsed.session = { isAuthenticated: false, userId: null };
    }
    return parsed;
  } catch {
    return initialData;
  }
}

function saveAppState(value) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}

function statusLabel(status) {
  return status.replaceAll('_', ' ').replace(/\b\w/g, (m) => m.toUpperCase());
}

function roleTagClasses(role) {
  if (role === 'owner') return 'bg-violet-100 text-violet-700';
  if (role === 'admin') return 'bg-sky-100 text-sky-700';
  return 'bg-slate-100 text-slate-700';
}

function statusClasses(status) {
  switch (status) {
    case STATUSES.APPROVED:
      return 'bg-emerald-100 text-emerald-700';
    case STATUSES.PENDING_APPROVAL:
      return 'bg-amber-100 text-amber-800';
    case STATUSES.REJECTED:
      return 'bg-rose-100 text-rose-700';
    case STATUSES.IN_PROGRESS:
      return 'bg-blue-100 text-blue-700';
    default:
      return 'bg-slate-100 text-slate-700';
  }
}

function canSeeTask(user, task) {
  if (user.role === 'owner') return true;
  if (user.role === 'admin') return user.country === task.country;
  return task.assignedTo === user.id;
}

function canCreateTask(user) {
  return user.role === 'owner' || user.role === 'admin';
}

function canReviewTask(user, task) {
  if (user.role === 'owner') return true;
  if (user.role === 'admin') return user.country === task.country;
  return false;
}

function canManageUsers(user) {
  return user.role === 'owner';
}

function StatCard({ icon: Icon, label, value, helper }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div className="rounded-2xl bg-slate-900 p-2 text-white">
          <Icon size={18} />
        </div>
        <span className="text-xs text-slate-400">Live state</span>
      </div>
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-semibold text-slate-900">{value}</p>
      <p className="mt-2 text-xs text-slate-400">{helper}</p>
    </div>
  );
}

function LoginScreen({ users, onLogin }) {
  const [form, setForm] = useState({
    email: users[5]?.email || 'admin.pakistan@kuickart.local',
    password: DEMO_PASSWORDS.admin,
  });
  const [error, setError] = useState('');

  const groupedUsers = {
    owner: users.filter((user) => user.role === 'owner'),
    admin: users.filter((user) => user.role === 'admin'),
    user: users.filter((user) => user.role === 'user'),
  };

  const submit = (event) => {
    event.preventDefault();
    const matched = users.find(
      (user) => user.email.toLowerCase() === form.email.trim().toLowerCase() && user.password === form.password
    );

    if (!matched) {
      setError('Invalid demo credentials. Use one of the accounts shown below.');
      return;
    }

    setError('');
    onLogin(matched.id);
  };

  return (
    <div className="min-h-screen bg-slate-100 p-4 lg:p-8">
      <div className="mx-auto grid max-w-7xl gap-6 xl:grid-cols-[1.05fr,0.95fr]">
        <section className="rounded-[32px] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8 text-white shadow-xl lg:p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-300">Kuickart</p>
          <h1 className="mt-4 text-4xl font-semibold leading-tight">Task Manager with demo password login</h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">
            Owners have complete access. Admins create tasks and approve or reject submissions. Users only see their assigned work and send completion requests for review.
          </p>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <p className="text-sm font-medium">Owners</p>
              <p className="mt-2 text-2xl font-semibold">3</p>
              <p className="mt-2 text-xs text-slate-300">Germany, France, Pakistan</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <p className="text-sm font-medium">Admins</p>
              <p className="mt-2 text-2xl font-semibold">3</p>
              <p className="mt-2 text-xs text-slate-300">Country-based task control</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <p className="text-sm font-medium">Users</p>
              <p className="mt-2 text-2xl font-semibold">6</p>
              <p className="mt-2 text-xs text-slate-300">Assigned task workflow</p>
            </div>
          </div>

          <div className="mt-10 rounded-[28px] border border-white/10 bg-white/5 p-5">
            <h2 className="text-lg font-semibold">Demo passwords</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl bg-white/5 p-4">
                <p className="text-sm font-medium">Owners</p>
                <p className="mt-2 font-mono text-sm text-slate-200">owner123</p>
              </div>
              <div className="rounded-2xl bg-white/5 p-4">
                <p className="text-sm font-medium">Admins</p>
                <p className="mt-2 font-mono text-sm text-slate-200">admin123</p>
              </div>
              <div className="rounded-2xl bg-white/5 p-4">
                <p className="text-sm font-medium">Users</p>
                <p className="mt-2 font-mono text-sm text-slate-200">user123</p>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm lg:p-8">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-slate-900 p-3 text-white">
              <LockKeyhole size={18} />
            </div>
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">Sign in</h2>
              <p className="text-sm text-slate-500">Use any demo email and the matching role password.</p>
            </div>
          </div>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <label className="space-y-2 block">
              <span className="text-sm font-medium text-slate-700">Email</span>
              <div className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3">
                <Mail size={16} className="text-slate-400" />
                <input
                  className="w-full bg-transparent outline-none"
                  value={form.email}
                  onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                  placeholder="email"
                />
              </div>
            </label>

            <label className="space-y-2 block">
              <span className="text-sm font-medium text-slate-700">Password</span>
              <div className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3">
                <LockKeyhole size={16} className="text-slate-400" />
                <input
                  type="password"
                  className="w-full bg-transparent outline-none"
                  value={form.password}
                  onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                  placeholder="password"
                />
              </div>
            </label>

            {error && <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}

            <button type="submit" className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white">
              Login to task manager
            </button>
          </form>

          <div className="mt-8 space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">Demo accounts</h3>
            {['owner', 'admin', 'user'].map((role) => (
              <div key={role} className="rounded-3xl bg-slate-50 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-900">{ROLE_LABELS[role]}</p>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${roleTagClasses(role)}`}>{DEMO_PASSWORDS[role]}</span>
                </div>
                <div className="space-y-2">
                  {groupedUsers[role].map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => setForm({ email: user.email, password: DEMO_PASSWORDS[role] })}
                      className="flex w-full items-center justify-between rounded-2xl bg-white px-4 py-3 text-left transition hover:bg-slate-100"
                    >
                      <div>
                        <p className="text-sm font-medium text-slate-900">{user.name}</p>
                        <p className="text-xs text-slate-500">{user.email}</p>
                      </div>
                      <span className="text-xs text-slate-400">{user.country}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function Sidebar({ activeTab, setActiveTab, currentUser, onLogout }) {
  const items = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'tasks', label: currentUser.role === 'user' ? 'My Tasks' : 'All Tasks', icon: ClipboardList },
    { id: 'pending', label: currentUser.role === 'user' ? 'My Submissions' : 'Pending Approval', icon: CheckSquare },
    { id: 'users', label: 'Users', icon: Users },
  ];

  return (
    <aside className="w-full lg:sticky lg:top-6 lg:w-80 lg:flex-none">
      <div className="flex h-full flex-col rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">Kuickart</p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">Task Manager</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">Frontend demo with password login and country-based task workflow.</p>
        </div>

        <div className="mt-8 space-y-2">
          {items.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-medium transition ${
                activeTab === id ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
        </div>

        <div className="mt-8 rounded-3xl bg-slate-50 p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-white p-2 text-slate-700 shadow-sm">
              <Shield size={18} />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">{currentUser.name}</p>
              <p className="text-xs text-slate-500">{ROLE_LABELS[currentUser.role]} · {currentUser.country}</p>
            </div>
          </div>
        </div>

        <button
          onClick={onLogout}
          className="mt-4 inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
        >
          <LogOut size={16} />
          Logout
        </button>
      </div>
    </aside>
  );
}

function Header({ currentUser, onReset }) {
  return (
    <div className="flex flex-col gap-4 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm xl:flex-row xl:items-center xl:justify-between">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">Role-aware task workflow</h2>
        <p className="mt-1 text-sm text-slate-500">
          Owners have complete access, admins create and approve tasks, users submit work for review.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-600">
          Logged in as <span className="font-semibold text-slate-900">{currentUser.email}</span>
        </div>
        <button
          onClick={onReset}
          className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
        >
          Reset demo data
        </button>
      </div>
    </div>
  );
}

function TaskForm({ currentUser, users, onSubmit, onClose }) {
  const countries = currentUser.role === 'owner' ? COUNTRIES : [currentUser.country];
  const [form, setForm] = useState({
    title: '',
    description: '',
    country: countries[0],
    priority: 'Medium',
    category: 'Operations',
    assignedTo: '',
    dueDate: futureDate(1),
  });

  const assignableUsers = useMemo(
    () => users.filter((user) => user.role === 'user' && user.country === form.country),
    [form.country, users]
  );

  useEffect(() => {
    if (!assignableUsers.some((user) => user.id === form.assignedTo)) {
      setForm((prev) => ({ ...prev, assignedTo: assignableUsers[0]?.id || '' }));
    }
  }, [assignableUsers, form.assignedTo]);

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!form.title.trim() || !form.assignedTo) return;
    onSubmit(form);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
      <div className="w-full max-w-2xl rounded-[28px] bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-semibold text-slate-900">Create task</h3>
            <p className="text-sm text-slate-500">Admins are restricted to their own country. Owners can create across all countries.</p>
          </div>
          <button onClick={onClose} className="rounded-2xl bg-slate-100 px-3 py-2 text-sm text-slate-600">Close</button>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2 md:col-span-2">
            <span className="text-sm font-medium text-slate-700">Task title</span>
            <input className="field" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Enter task title" />
          </label>

          <label className="space-y-2 md:col-span-2">
            <span className="text-sm font-medium text-slate-700">Description</span>
            <textarea className="field min-h-28" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Describe the work clearly" />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Country</span>
            <select className="field" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })}>
              {countries.map((country) => <option key={country}>{country}</option>)}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Priority</span>
            <select className="field" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
              {PRIORITIES.map((priority) => <option key={priority}>{priority}</option>)}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Category</span>
            <input className="field" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Operations / Marketing / Finance" />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Assign user</span>
            <select className="field" value={form.assignedTo} onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}>
              {assignableUsers.map((user) => (
                <option key={user.id} value={user.id}>{user.name} — {user.country}</option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Due date</span>
            <input type="date" className="field" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
          </label>

          <div className="md:col-span-2 flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600">Cancel</button>
            <button type="submit" className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white">Create task</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Dashboard({ currentUser, visibleTasks, pendingTasks, activity, users }) {
  const myOpenTasks = visibleTasks.filter((task) => [STATUSES.TODO, STATUSES.IN_PROGRESS, STATUSES.REJECTED].includes(task.status));
  const approvedTasks = visibleTasks.filter((task) => task.status === STATUSES.APPROVED);
  const countryCount = currentUser.role === 'owner' ? COUNTRIES.length : 1;
  const recentActivity = activity.slice(0, 6);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
        <StatCard icon={ClipboardList} label="Visible tasks" value={visibleTasks.length} helper="Tasks shown for this role" />
        <StatCard icon={Clock3} label="Pending approval" value={pendingTasks.length} helper="Waiting for admin or owner review" />
        <StatCard icon={CheckCircle2} label="Approved" value={approvedTasks.length} helper="Completed and accepted tasks" />
        <StatCard icon={Building2} label="Countries in scope" value={countryCount} helper={currentUser.role === 'owner' ? 'Cross-country access enabled' : `Limited to ${currentUser.country}`} />
      </div>

      <div className="grid gap-6 2xl:grid-cols-[1.35fr,0.95fr]">
        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Work snapshot</h3>
              <p className="text-sm text-slate-500">Current status across your visible workflow.</p>
            </div>
          </div>
          <div className="space-y-3">
            {myOpenTasks.slice(0, 5).map((task) => (
              <div key={task.id} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="font-medium text-slate-900">{task.title}</h4>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClasses(task.status)}`}>{statusLabel(task.status)}</span>
                </div>
                <p className="mt-2 text-sm text-slate-500">{task.description}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-400">
                  <span>{task.country}</span>
                  <span>•</span>
                  <span>{task.category}</span>
                  <span>•</span>
                  <span>Due {task.dueDate}</span>
                </div>
              </div>
            ))}
            {!myOpenTasks.length && <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">No open tasks in your current view.</div>}
          </div>
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Recent activity</h3>
          <p className="text-sm text-slate-500">Local activity log stored in the browser.</p>
          <div className="mt-4 space-y-3">
            {recentActivity.map((item) => {
              const actor = users.find((user) => user.id === item.actorId);
              return (
                <div key={item.id} className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-sm font-medium text-slate-800">{item.message}</p>
                  <p className="mt-1 text-xs text-slate-500">{actor?.name || 'System'} · {new Date(item.createdAt).toLocaleString()}</p>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

function TaskTable({ currentUser, users, tasks, pendingOnly, onSubmitForApproval, onApprove, onReject, onStartTask }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [noteDrafts, setNoteDrafts] = useState({});
  const [rejectionDrafts, setRejectionDrafts] = useState({});

  const filtered = useMemo(() => {
    return tasks.filter((task) => {
      const pendingScope = pendingOnly
        ? currentUser.role === 'user'
          ? [STATUSES.PENDING_APPROVAL, STATUSES.APPROVED, STATUSES.REJECTED].includes(task.status)
          : task.status === STATUSES.PENDING_APPROVAL
        : true;
      const matchesSearch = [task.title, task.description, task.category, task.country]
        .join(' ')
        .toLowerCase()
        .includes(search.toLowerCase());
      const matchesStatus = statusFilter === 'all' ? true : task.status === statusFilter;
      return pendingScope && matchesSearch && matchesStatus;
    });
  }, [currentUser.role, pendingOnly, search, statusFilter, tasks]);

  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{pendingOnly ? (currentUser.role === 'user' ? 'My submissions' : 'Approval queue') : 'Task board'}</h3>
          <p className="text-sm text-slate-500">
            {pendingOnly
              ? currentUser.role === 'user'
                ? 'Track submitted tasks and review outcomes from admins.'
                : 'Review completion requests and approve or reject them.'
              : 'Dynamic frontend task list filtered by role permissions.'}
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="flex items-center gap-2 rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-500">
            <Search size={16} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tasks" className="w-44 bg-transparent outline-none" />
          </label>
          <label className="flex items-center gap-2 rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-500">
            <Filter size={16} />
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-transparent outline-none">
              <option value="all">All statuses</option>
              {Object.values(STATUSES).map((status) => (
                <option key={status} value={status}>{statusLabel(status)}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="mt-5 space-y-4">
        {filtered.map((task) => {
          const assignedUser = users.find((user) => user.id === task.assignedTo);
          const canSubmit = currentUser.role === 'user' && task.assignedTo === currentUser.id && [STATUSES.TODO, STATUSES.IN_PROGRESS, STATUSES.REJECTED].includes(task.status);
          const canStart = currentUser.role === 'user' && task.assignedTo === currentUser.id && task.status === STATUSES.TODO;
          const canReview = canReviewTask(currentUser, task) && task.status === STATUSES.PENDING_APPROVAL;

          return (
            <article key={task.id} className="rounded-3xl border border-slate-200 p-4">
              <div className="flex flex-col gap-3 2xl:flex-row 2xl:items-start 2xl:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-lg font-semibold text-slate-900">{task.title}</h4>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClasses(task.status)}`}>{statusLabel(task.status)}</span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{task.priority}</span>
                  </div>
                  <p className="mt-2 max-w-3xl text-sm text-slate-500">{task.description}</p>
                  <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-400">
                    <span>{task.country}</span>
                    <span>Assigned to {assignedUser?.name || 'Unknown'}</span>
                    <span>Category {task.category}</span>
                    <span>Due {task.dueDate}</span>
                  </div>
                </div>
                <div className="text-xs text-slate-400">
                  <p>Created {new Date(task.createdAt).toLocaleString()}</p>
                  <p>Updated {new Date(task.updatedAt).toLocaleString()}</p>
                </div>
              </div>

              {task.completionNote && (
                <div className="mt-4 rounded-2xl bg-blue-50 p-3 text-sm text-blue-800">
                  <strong>Completion note:</strong> {task.completionNote}
                </div>
              )}

              {task.rejectionReason && task.status === STATUSES.REJECTED && (
                <div className="mt-4 rounded-2xl bg-rose-50 p-3 text-sm text-rose-800">
                  <strong>Rejected reason:</strong> {task.rejectionReason}
                </div>
              )}

              {canStart && (
                <div className="mt-4">
                  <button onClick={() => onStartTask(task.id)} className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700">Start task</button>
                </div>
              )}

              {canSubmit && (
                <div className="mt-4 space-y-3 rounded-2xl bg-slate-50 p-4">
                  <textarea
                    className="field min-h-24"
                    placeholder="Add a completion note for the admin"
                    value={noteDrafts[task.id] || task.completionNote || ''}
                    onChange={(e) => setNoteDrafts((prev) => ({ ...prev, [task.id]: e.target.value }))}
                  />
                  <button
                    onClick={() => onSubmitForApproval(task.id, noteDrafts[task.id] || '')}
                    className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white"
                  >
                    Mark done and send for approval
                  </button>
                </div>
              )}

              {canReview && (
                <div className="mt-4 grid gap-3 rounded-2xl bg-slate-50 p-4 lg:grid-cols-[1fr,auto,auto]">
                  <textarea
                    className="field min-h-24"
                    placeholder="Optional rejection comment"
                    value={rejectionDrafts[task.id] || ''}
                    onChange={(e) => setRejectionDrafts((prev) => ({ ...prev, [task.id]: e.target.value }))}
                  />
                  <button
                    onClick={() => onApprove(task.id)}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white"
                  >
                    <CheckCircle2 size={16} /> Approve
                  </button>
                  <button
                    onClick={() => onReject(task.id, rejectionDrafts[task.id] || 'Please revise and resubmit.')}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-rose-600 px-4 py-2 text-sm font-medium text-white"
                  >
                    <XCircle size={16} /> Reject
                  </button>
                </div>
              )}
            </article>
          );
        })}

        {!filtered.length && <div className="rounded-3xl border border-dashed border-slate-200 p-10 text-center text-sm text-slate-500">No tasks found for this view.</div>}
      </div>
    </section>
  );
}

function UsersPanel({ currentUser, users, tasks }) {
  if (!canManageUsers(currentUser)) {
    return (
      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Users</h3>
        <p className="mt-2 text-sm text-slate-500">Only owners can view the full user management summary in this frontend demo.</p>
      </section>
    );
  }

  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-lg font-semibold text-slate-900">Country roles overview</h3>
      <p className="text-sm text-slate-500">Owners and admins are fixed demo roles. Users are shown with current assigned workload.</p>
      <div className="mt-5 grid gap-4 xl:grid-cols-3">
        {COUNTRIES.map((country) => {
          const countryUsers = users.filter((user) => user.country === country);
          return (
            <div key={country} className="rounded-3xl border border-slate-200 p-4">
              <h4 className="text-base font-semibold text-slate-900">{country}</h4>
              <div className="mt-4 space-y-3">
                {countryUsers.map((user) => (
                  <div key={user.id} className="rounded-2xl bg-slate-50 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-slate-900">{user.name}</p>
                        <p className="text-xs text-slate-500">{user.email}</p>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${roleTagClasses(user.role)}`}>{ROLE_LABELS[user.role]}</span>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">
                      Assigned tasks: {tasks.filter((task) => task.assignedTo === user.id).length}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default function App() {
  const [appState, setAppState] = useState(loadAppState);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    saveAppState(appState);
  }, [appState]);

  const currentUser = useMemo(
    () => appState.users.find((user) => user.id === appState.session.userId) || null,
    [appState.session.userId, appState.users]
  );

  const visibleTasks = useMemo(
    () => currentUser ? appState.tasks.filter((task) => canSeeTask(currentUser, task)) : [],
    [appState.tasks, currentUser]
  );

  const pendingTasks = useMemo(() => {
    if (!currentUser) return [];
    if (currentUser.role === 'user') {
      return visibleTasks.filter((task) => [STATUSES.PENDING_APPROVAL, STATUSES.APPROVED, STATUSES.REJECTED].includes(task.status));
    }
    return visibleTasks.filter((task) => task.status === STATUSES.PENDING_APPROVAL && canReviewTask(currentUser, task));
  }, [currentUser, visibleTasks]);

  function patchState(updater) {
    setAppState((prev) => (typeof updater === 'function' ? updater(prev) : updater));
  }

  function login(userId) {
    patchState((prev) => ({
      ...prev,
      session: { isAuthenticated: true, userId },
      activity: [makeActivity(userId, 'login', 'Logged into the task manager.'), ...prev.activity],
    }));
  }

  function logout() {
    patchState((prev) => ({
      ...prev,
      session: { isAuthenticated: false, userId: null },
      activity: currentUser
        ? [makeActivity(currentUser.id, 'logout', 'Logged out of the task manager.'), ...prev.activity]
        : prev.activity,
    }));
    setActiveTab('dashboard');
  }

  function resetDemo() {
    setAppState({
      ...initialData,
      session: currentUser ? { isAuthenticated: true, userId: currentUser.id } : initialData.session,
    });
    setActiveTab('dashboard');
  }

  function addActivity(action, message, taskId = null) {
    return makeActivity(currentUser.id, action, message, taskId);
  }

  function createTask(form) {
    if (!canCreateTask(currentUser)) return;
    const task = {
      id: crypto.randomUUID(),
      title: form.title.trim(),
      description: form.description.trim(),
      country: form.country,
      priority: form.priority,
      category: form.category.trim() || 'Operations',
      assignedTo: form.assignedTo,
      createdBy: currentUser.id,
      reviewedBy: null,
      dueDate: form.dueDate,
      status: STATUSES.TODO,
      completionNote: '',
      rejectionReason: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    patchState((prev) => ({
      ...prev,
      tasks: [task, ...prev.tasks],
      activity: [addActivity('task_created', `Created task “${task.title}” for ${task.country}.`, task.id), ...prev.activity],
    }));
  }

  function startTask(taskId) {
    patchState((prev) => ({
      ...prev,
      tasks: prev.tasks.map((task) => task.id === taskId ? { ...task, status: STATUSES.IN_PROGRESS, updatedAt: new Date().toISOString() } : task),
      activity: [addActivity('task_started', 'Started working on an assigned task.', taskId), ...prev.activity],
    }));
  }

  function submitForApproval(taskId, note) {
    patchState((prev) => ({
      ...prev,
      tasks: prev.tasks.map((task) => task.id === taskId ? {
        ...task,
        status: STATUSES.PENDING_APPROVAL,
        completionNote: note.trim(),
        rejectionReason: '',
        updatedAt: new Date().toISOString(),
      } : task),
      activity: [addActivity('task_submitted', 'Submitted a task for admin approval.', taskId), ...prev.activity],
    }));
    setActiveTab('pending');
  }

  function approveTask(taskId) {
    patchState((prev) => ({
      ...prev,
      tasks: prev.tasks.map((task) => task.id === taskId ? {
        ...task,
        status: STATUSES.APPROVED,
        reviewedBy: currentUser.id,
        updatedAt: new Date().toISOString(),
      } : task),
      activity: [addActivity('task_approved', 'Approved a submitted task.', taskId), ...prev.activity],
    }));
  }

  function rejectTask(taskId, reason) {
    patchState((prev) => ({
      ...prev,
      tasks: prev.tasks.map((task) => task.id === taskId ? {
        ...task,
        status: STATUSES.REJECTED,
        reviewedBy: currentUser.id,
        rejectionReason: reason.trim(),
        updatedAt: new Date().toISOString(),
      } : task),
      activity: [addActivity('task_rejected', 'Rejected a submitted task and sent it back.', taskId), ...prev.activity],
    }));
  }

  if (!appState.session.isAuthenticated || !currentUser) {
    return <LoginScreen users={appState.users} onLogin={login} />;
  }

  return (
    <div className="min-h-screen bg-slate-100 p-4 lg:p-6">
      <div className="mx-auto flex max-w-[1600px] flex-col items-start gap-6 lg:flex-row">
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} currentUser={currentUser} onLogout={logout} />

        <main className="min-w-0 flex-1 space-y-6 self-stretch">
          <Header currentUser={currentUser} onReset={resetDemo} />

          <section className="flex flex-col gap-3 rounded-[28px] border border-slate-200 bg-gradient-to-br from-slate-900 to-slate-800 p-6 text-white shadow-sm xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-sm text-slate-300">Current access level</p>
              <h2 className="mt-1 text-2xl font-semibold">{ROLE_LABELS[currentUser.role]} · {currentUser.country}</h2>
              <p className="mt-2 max-w-2xl text-sm text-slate-300">
                {currentUser.role === 'owner' && 'Complete system access across Germany, France and Pakistan.'}
                {currentUser.role === 'admin' && 'Can create tasks and approve completion for the assigned country.'}
                {currentUser.role === 'user' && 'Can view assigned tasks, work on them and submit completed work for approval.'}
              </p>
            </div>
            {canCreateTask(currentUser) && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-900"
              >
                <Plus size={16} />
                Create task
              </button>
            )}
          </section>

          {activeTab === 'dashboard' && (
            <Dashboard currentUser={currentUser} visibleTasks={visibleTasks} pendingTasks={pendingTasks} activity={appState.activity} users={appState.users} />
          )}

          {activeTab === 'tasks' && (
            <TaskTable
              currentUser={currentUser}
              users={appState.users}
              tasks={visibleTasks}
              pendingOnly={false}
              onSubmitForApproval={submitForApproval}
              onApprove={approveTask}
              onReject={rejectTask}
              onStartTask={startTask}
            />
          )}

          {activeTab === 'pending' && (
            <TaskTable
              currentUser={currentUser}
              users={appState.users}
              tasks={pendingTasks}
              pendingOnly
              onSubmitForApproval={submitForApproval}
              onApprove={approveTask}
              onReject={rejectTask}
              onStartTask={startTask}
            />
          )}

          {activeTab === 'users' && <UsersPanel currentUser={currentUser} users={appState.users} tasks={appState.tasks} />}
        </main>
      </div>

      {showCreateModal && (
        <TaskForm
          currentUser={currentUser}
          users={appState.users}
          onSubmit={createTask}
          onClose={() => setShowCreateModal(false)}
        />
      )}
    </div>
  );
}
