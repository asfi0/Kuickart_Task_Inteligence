import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import {
  API_BASE_URL,
  authApi,
  clearTokens,
  coreApi,
  getAccessToken,
  getRefreshToken,
  setTokens,
} from './services/api';

const STATUSES = {
  TODO: 'TODO',
  IN_PROGRESS: 'IN_PROGRESS',
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
};

const PRIORITY_LABELS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const OPERATIONAL_ROLE_GROUPS = [
  {
    id: 'governance',
    title: 'Governance',
    helper: 'Cross-country oversight and approvals',
    roles: ['Board Governance'],
  },
  {
    id: 'pko',
    title: 'PKO',
    helper: 'Digital and finance execution roles',
    roles: ['PKO Digital Dev', 'PKO Digital Ops', 'PKO Finance'],
  },
  {
    id: 'fro',
    title: 'FRO',
    helper: 'Operations, logistics and finance workflow roles',
    roles: ['FRO Operations', 'FRO Logistics', 'FRO Finance'],
  },
];

const SUBMISSION_NOTES_KEY = 'kuickart_submission_notes_v1';
const OPERATIONAL_ROLE_PREFS_KEY = 'kuickart_operational_role_preferences_v1';

function futureDate(days) {
  const value = new Date();
  value.setDate(value.getDate() + days);
  return value.toISOString().slice(0, 10);
}

function formatLabel(value) {
  return String(value || '')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function safeJsonParse(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function loadSubmissionNotes() {
  try {
    return safeJsonParse(localStorage.getItem(SUBMISSION_NOTES_KEY) || '{}', {});
  } catch {
    return {};
  }
}

function loadRolePreferences() {
  try {
    return safeJsonParse(localStorage.getItem(OPERATIONAL_ROLE_PREFS_KEY) || '{}', {});
  } catch {
    return {};
  }
}

function isGovernanceUser(user) {
  return user?.role === 'OWNER';
}

function canCreateTask(user) {
  return Boolean(user);
}

function canReviewTask(user) {
  return isGovernanceUser(user);
}

function canManageUsers(user) {
  return isGovernanceUser(user);
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

function severityClasses(severity) {
  switch (severity) {
    case 'CRITICAL':
      return 'bg-rose-100 text-rose-700';
    case 'HIGH':
      return 'bg-amber-100 text-amber-800';
    case 'MEDIUM':
      return 'bg-blue-100 text-blue-700';
    default:
      return 'bg-slate-100 text-slate-700';
  }
}

function accessTagClasses(label) {
  if (label === 'Board Governance') {
    return 'bg-violet-100 text-violet-700';
  }
  return 'bg-sky-100 text-sky-700';
}

function normalizeUser(user) {
  return {
    ...user,
    countryId: user.countryId || user.country?.id || '',
    countryName: user.country?.name || user.countryName || 'Unknown',
  };
}

function normalizeTask(task) {
  return {
    ...task,
    title: task.taskTemplate?.name || 'Untitled Task',
    description:
      task.customInstructions?.trim() ||
      task.initialNotes?.trim() ||
      task.taskTemplate?.description ||
      'No details available.',
    priority: task.priority || 'MEDIUM',
    assignedUserId: task.assignedUserId || task.assignedUser?.id || '',
    assignedUserName: task.assignedUser?.name || 'Unknown',
    createdByUserId: task.createdBy || task.creator?.id || '',
    countryName: task.country?.name || 'Unknown',
    roleName: task.taskTemplate?.role?.name || '',
    divisionName: task.taskTemplate?.role?.division?.name || '',
    subUnitName: task.taskTemplate?.subUnit?.name || '',
    dueDate: task.dueDate ? String(task.dueDate).slice(0, 10) : '',
  };
}

function inferOperationalRoleName(user, roles, tasks, rolePreferences) {
  if (!user) return '';
  if (isGovernanceUser(user)) return 'Board Governance';

  const stored = rolePreferences[user.id];
  if (stored && roles.some((role) => role.name === stored)) {
    return stored;
  }

  const taskRole = tasks.find(
    (task) => task.assignedUserId === user.id || task.createdByUserId === user.id,
  )?.roleName;

  if (taskRole) {
    return taskRole;
  }

  return 'Operational Member';
}

function buildTaskRejectionReasons(activityLogs) {
  const reasons = {};

  activityLogs.forEach((item) => {
    if (item.action !== 'TASK_REJECTED') return;

    const metadata = typeof item.metadata === 'string' ? safeJsonParse(item.metadata, {}) : item.metadata || {};
    const reason = metadata?.reason;
    const taskId = item.taskId || item.entityId;

    if (taskId && reason) {
      reasons[taskId] = reason;
    }
  });

  return reasons;
}

function describeActivityLog(item, taskMap) {
  const taskTitle = item.taskId ? taskMap.get(item.taskId)?.title : taskMap.get(item.entityId)?.title;

  switch (item.action) {
    case 'TASK_CREATED':
      return taskTitle ? `Created task “${taskTitle}”.` : 'Created a task.';
    case 'TASK_STARTED':
      return taskTitle ? `Started task “${taskTitle}”.` : 'Started an operational task.';
    case 'TASK_SUBMITTED':
      return taskTitle ? `Submitted task “${taskTitle}” for approval.` : 'Submitted a task for approval.';
    case 'TASK_APPROVED':
      return taskTitle ? `Approved task “${taskTitle}”.` : 'Approved a task.';
    case 'TASK_REJECTED': {
      const metadata = typeof item.metadata === 'string' ? safeJsonParse(item.metadata, {}) : item.metadata || {};
      return taskTitle
        ? `Rejected task “${taskTitle}”.${metadata.reason ? ` Reason: ${metadata.reason}` : ''}`
        : 'Rejected a task.';
    }
    case 'USER_LOGIN':
      return 'Signed into the operations engine.';
    case 'ALERT_CREATED':
      return 'Created an alert.';
    case 'ALERT_RESOLVED':
      return 'Resolved an alert.';
    case 'REPORT_CREATED':
      return 'Created a report.';
    default:
      return `${formatLabel(item.action || 'activity')} recorded.`;
  }
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

function LoginScreen({ onLogin, error, isSubmitting }) {
  const [form, setForm] = useState({
    email: '',
    password: '',
  });

  const submit = async (event) => {
    event.preventDefault();
    await onLogin(form);
  };

  return (
    <div className="min-h-screen bg-slate-100 p-4 lg:p-8">
      <div className="mx-auto grid max-w-7xl gap-6 xl:grid-cols-[1.05fr,0.95fr]">
        <section className="rounded-[32px] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8 text-white shadow-xl lg:p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-300">Kuickart</p>
          <h1 className="mt-4 text-4xl font-semibold leading-tight">Operations Engine connected to backend auth</h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">
            Sign in with your backend credentials. Board Governance has governance oversight, while operational roles execute,
            submit, and monitor workflow using live NestJS APIs.
          </p>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <p className="text-sm font-medium">Roles</p>
              <p className="mt-2 text-2xl font-semibold">7</p>
              <p className="mt-2 text-xs text-slate-300">Operational roles drive access</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <p className="text-sm font-medium">Workflow</p>
              <p className="mt-2 text-2xl font-semibold">5 stages</p>
              <p className="mt-2 text-xs text-slate-300">TODO to APPROVED</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <p className="text-sm font-medium">API</p>
              <p className="mt-2 text-2xl font-semibold">Live</p>
              <p className="mt-2 text-xs text-slate-300">{API_BASE_URL}</p>
            </div>
          </div>

          <div className="mt-10 rounded-[28px] border border-white/10 bg-white/5 p-5">
            <h2 className="text-lg font-semibold">Access model</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl bg-white/5 p-4">
                <p className="text-sm font-medium">Board Governance</p>
                <p className="mt-2 text-sm text-slate-200">Approvals, reports, KPIs, alerts and cross-country oversight.</p>
              </div>
              <div className="rounded-2xl bg-white/5 p-4">
                <p className="text-sm font-medium">Operational roles</p>
                <p className="mt-2 text-sm text-slate-200">Role → SubUnit → TaskTemplate workflow with backend task APIs.</p>
              </div>
              <div className="rounded-2xl bg-white/5 p-4">
                <p className="text-sm font-medium">JWT auth</p>
                <p className="mt-2 text-sm text-slate-200">Login, refresh, logout and session recovery are backend-driven.</p>
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
              <p className="text-sm text-slate-500">Use your backend credentials to connect to the operations engine.</p>
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
                  onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
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
                  onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
                  placeholder="password"
                />
              </div>
            </label>

            {error && <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-70"
            >
              {isSubmitting ? 'Signing in...' : 'Login to task manager'}
            </button>
          </form>

          <div className="mt-8 space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">Operational roles</h3>
            {OPERATIONAL_ROLE_GROUPS.map((group) => (
              <div key={group.id} className="rounded-3xl bg-slate-50 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-900">{group.title}</p>
                  <span className="rounded-full bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white">{group.helper}</span>
                </div>
                <div className="space-y-2">
                  {group.roles.map((role) => (
                    <div
                      key={role}
                      className="flex w-full items-center justify-between rounded-2xl bg-white px-4 py-3 text-left"
                    >
                      <div>
                        <p className="text-sm font-medium text-slate-900">{role}</p>
                        <p className="text-xs text-slate-500">Backend-authenticated operational access</p>
                      </div>
                      <span className="text-xs text-slate-400">Live API</span>
                    </div>
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

function Sidebar({ activeTab, setActiveTab, currentUser, onLogout, accessLabel }) {
  const items = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'tasks', label: 'Task Board', icon: ClipboardList },
    {
      id: 'pending',
      label: canReviewTask(currentUser) ? 'Approval Queue' : 'Workflow Status',
      icon: CheckSquare,
    },
    { id: 'users', label: 'Users', icon: Users },
  ];

  return (
    <aside className="w-full lg:sticky lg:top-6 lg:w-80 lg:flex-none">
      <div className="flex h-full flex-col rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">Kuickart</p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">Task Manager</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">Backend-connected control panel for operational workflow and governance oversight.</p>
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
              <p className="text-xs text-slate-500">{accessLabel} · {currentUser.countryName}</p>
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

function Header({ currentUser, onRefresh, refreshing }) {
  return (
    <div className="flex flex-col gap-4 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm xl:flex-row xl:items-center xl:justify-between">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">Operational workflow</h2>
        <p className="mt-1 text-sm text-slate-500">
          Governance reviews approvals and oversight metrics, while operational roles execute template-based tasks from live backend data.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-600">
          Logged in as <span className="font-semibold text-slate-900">{currentUser.email}</span>
        </div>
        <button
          onClick={onRefresh}
          className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
        >
          {refreshing ? 'Refreshing...' : 'Refresh data'}
        </button>
      </div>
    </div>
  );
}

function TaskForm({ currentUser, users, roles, tasks, rolePreferences, onRememberRole, onSubmit, onClose }) {
  const defaultRoleName = inferOperationalRoleName(currentUser, roles, tasks, rolePreferences);
  const defaultRoleId = roles.find((role) => role.name === defaultRoleName)?.id || roles[0]?.id || '';

  const [form, setForm] = useState({
    roleId: defaultRoleId,
    subUnitId: '',
    taskTemplateId: '',
    assignedUserId: users[0]?.id || '',
    customInstructions: '',
    initialNotes: '',
    dueDate: futureDate(1),
  });
  const [subUnits, setSubUnits] = useState([]);
  const [taskTemplates, setTaskTemplates] = useState([]);
  const [isLoadingSubUnits, setIsLoadingSubUnits] = useState(false);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const assignableUsers = useMemo(() => {
    const scopedUsers = users.filter((user) => user.status !== 'INACTIVE');
    if (isGovernanceUser(currentUser)) return scopedUsers;
    return scopedUsers.filter((user) => user.countryId === currentUser.countryId);
  }, [currentUser, users]);

  useEffect(() => {
    let active = true;

    async function loadSubUnits() {
      if (!form.roleId) {
        setSubUnits([]);
        setTaskTemplates([]);
        return;
      }

      setIsLoadingSubUnits(true);
      setError('');

      try {
        const items = await coreApi.getSubUnits({ roleId: form.roleId });
        if (!active) return;
        setSubUnits(items);
        setForm((prev) => ({
          ...prev,
          subUnitId: items.some((item) => item.id === prev.subUnitId) ? prev.subUnitId : items[0]?.id || '',
        }));
      } catch (requestError) {
        if (!active) return;
        setError(requestError.message || 'Unable to load sub-units.');
        setSubUnits([]);
      } finally {
        if (active) setIsLoadingSubUnits(false);
      }
    }

    loadSubUnits();
    return () => {
      active = false;
    };
  }, [form.roleId]);

  useEffect(() => {
    let active = true;

    async function loadTemplates() {
      if (!form.roleId || !form.subUnitId) {
        setTaskTemplates([]);
        return;
      }

      setIsLoadingTemplates(true);
      setError('');

      try {
        const items = await coreApi.getTaskTemplates({ roleId: form.roleId, subUnitId: form.subUnitId });
        if (!active) return;
        setTaskTemplates(items);
        setForm((prev) => ({
          ...prev,
          taskTemplateId: items.some((item) => item.id === prev.taskTemplateId) ? prev.taskTemplateId : items[0]?.id || '',
        }));
      } catch (requestError) {
        if (!active) return;
        setError(requestError.message || 'Unable to load task templates.');
        setTaskTemplates([]);
      } finally {
        if (active) setIsLoadingTemplates(false);
      }
    }

    loadTemplates();
    return () => {
      active = false;
    };
  }, [form.roleId, form.subUnitId]);

  useEffect(() => {
    if (!assignableUsers.some((user) => user.id === form.assignedUserId)) {
      setForm((prev) => ({ ...prev, assignedUserId: assignableUsers[0]?.id || '' }));
    }
  }, [assignableUsers, form.assignedUserId]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!form.roleId || !form.subUnitId || !form.taskTemplateId || !form.assignedUserId) {
      setError('Select an operational role, sub-unit, template and assignee before submitting.');
      return;
    }

    setIsSaving(true);
    setError('');

    const selectedRole = roles.find((role) => role.id === form.roleId);
    if (selectedRole && currentUser.id) {
      onRememberRole(currentUser.id, selectedRole.name);
    }

    const success = await onSubmit({
      taskTemplateId: form.taskTemplateId,
      assignedUserId: form.assignedUserId,
      customInstructions: form.customInstructions.trim() || undefined,
      initialNotes: form.initialNotes.trim() || undefined,
      dueDate: form.dueDate || undefined,
    });

    setIsSaving(false);
    if (success) {
      onClose();
    }
  };

  const selectedTemplate = taskTemplates.find((item) => item.id === form.taskTemplateId);

  return (
  <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/40 p-4">
    <div className="flex min-h-full items-center justify-center">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-[28px] bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-semibold text-slate-900">Create task</h3>
            <p className="text-sm text-slate-500">Role → SubUnit → TaskTemplate → Custom Instructions → Initial Notes.</p>
          </div>
          <button onClick={onClose} className="rounded-2xl bg-slate-100 px-3 py-2 text-sm text-slate-600">
            Close
          </button>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2 md:col-span-2">
            <span className="text-sm font-medium text-slate-700">Operational role</span>
            <select className="field" value={form.roleId} onChange={(event) => setForm((prev) => ({ ...prev, roleId: event.target.value }))}>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>{role.name}</option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Sub Unit</span>
            <select
              className="field"
              value={form.subUnitId}
              onChange={(event) => setForm((prev) => ({ ...prev, subUnitId: event.target.value }))}
              disabled={isLoadingSubUnits || !subUnits.length}
            >
              {subUnits.map((subUnit) => (
                <option key={subUnit.id} value={subUnit.id}>{subUnit.name}</option>
              ))}
            </select>
            <p className="text-xs text-slate-400">{isLoadingSubUnits ? 'Loading sub-units...' : 'Loaded dynamically from /subunits.'}</p>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Task Template</span>
            <select
              className="field"
              value={form.taskTemplateId}
              onChange={(event) => setForm((prev) => ({ ...prev, taskTemplateId: event.target.value }))}
              disabled={isLoadingTemplates || !taskTemplates.length}
            >
              {taskTemplates.map((template) => (
                <option key={template.id} value={template.id}>{template.name}</option>
              ))}
            </select>
            <p className="text-xs text-slate-400">{isLoadingTemplates ? 'Loading templates...' : 'Loaded dynamically from /task-templates.'}</p>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Assign user</span>
            <select className="field" value={form.assignedUserId} onChange={(event) => setForm((prev) => ({ ...prev, assignedUserId: event.target.value }))}>
              {assignableUsers.map((user) => (
                <option key={user.id} value={user.id}>{user.name} — {user.countryName}</option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Due date</span>
            <input type="date" className="field" value={form.dueDate} onChange={(event) => setForm((prev) => ({ ...prev, dueDate: event.target.value }))} />
          </label>

          <label className="space-y-2 md:col-span-2">
            <span className="text-sm font-medium text-slate-700">Custom Instructions</span>
            <textarea
              className="field min-h-28"
              value={form.customInstructions}
              onChange={(event) => setForm((prev) => ({ ...prev, customInstructions: event.target.value }))}
              placeholder="Add task-specific execution instructions"
            />
          </label>

          <label className="space-y-2 md:col-span-2">
            <span className="text-sm font-medium text-slate-700">Initial Notes</span>
            <textarea
              className="field min-h-28"
              value={form.initialNotes}
              onChange={(event) => setForm((prev) => ({ ...prev, initialNotes: event.target.value }))}
              placeholder="Add opening notes for the assignee"
            />
          </label>

          {selectedTemplate && (
            <div className="md:col-span-2 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
              <p className="font-medium text-slate-900">Template context</p>
              <p className="mt-2">{selectedTemplate.description}</p>
              <p className="mt-2 text-xs text-slate-500">
                Division: {selectedTemplate.role?.division?.name || 'N/A'} · Priority: {formatLabel(selectedTemplate.priority || 'MEDIUM')}
              </p>
            </div>
          )}

          {error && <p className="md:col-span-2 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}

          <div className="md:col-span-2 flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600">
              Cancel
            </button>
            <button type="submit" disabled={isSaving} className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-70">
              {isSaving ? 'Creating...' : 'Create task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
);
}

function Dashboard({ currentUser, kpi, alerts, reports, activityLogs, tasks }) {
  const summary = kpi?.summary || {
    totalTasks: 0,
    completedTasks: 0,
    pendingApprovals: 0,
    rejectedTasks: 0,
    openAlerts: 0,
    resolvedAlerts: 0,
    completionRate: 0,
  };

  const taskMap = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);

  const intelligenceItems = useMemo(() => {
    const reportItems = reports.map((report) => ({
      id: `report-${report.id}`,
      type: 'report',
      title: report.title,
      description: report.content,
      createdAt: report.createdAt,
      badge: 'Report',
      badgeClass: 'bg-slate-100 text-slate-700',
      meta: [report.country?.name, report.division?.name].filter(Boolean),
    }));

    const alertItems = alerts.map((alert) => ({
      id: `alert-${alert.id}`,
      type: 'alert',
      title: alert.title,
      description: alert.description,
      createdAt: alert.createdAt,
      badge: `${formatLabel(alert.severity)} · ${formatLabel(alert.status)}`,
      badgeClass: severityClasses(alert.severity),
      meta: [alert.country?.name, alert.division?.name].filter(Boolean),
    }));

    return [...alertItems, ...reportItems]
      .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))
      .slice(0, 6);
  }, [alerts, reports]);

  const recentActivity = activityLogs.slice(0, 6);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
        <StatCard icon={ClipboardList} label="Total tasks" value={summary.totalTasks} helper="Live count from /kpi" />
        <StatCard icon={Clock3} label="Pending approval" value={summary.pendingApprovals} helper="Waiting for governance review" />
        <StatCard icon={CheckCircle2} label="Completed" value={summary.completedTasks} helper={`${summary.completionRate}% completion rate`} />
        <StatCard icon={Building2} label="Open alerts" value={summary.openAlerts} helper={isGovernanceUser(currentUser) ? 'Cross-country governance visibility' : `Scoped to ${currentUser.countryName}`} />
      </div>

      <div className="grid gap-6 2xl:grid-cols-[1.35fr,0.95fr]">
        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Operational intelligence</h3>
              <p className="text-sm text-slate-500">Latest alerts and reports from live backend modules.</p>
            </div>
          </div>
          <div className="space-y-3">
            {intelligenceItems.map((item) => (
              <div key={item.id} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="font-medium text-slate-900">{item.title}</h4>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${item.badgeClass}`}>{item.badge}</span>
                </div>
                <p className="mt-2 text-sm text-slate-500">{item.description}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-400">
                  {item.meta.length ? item.meta.map((meta) => <span key={`${item.id}-${meta}`}>{meta}</span>) : <span>System scope</span>}
                  <span>•</span>
                  <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
            {!intelligenceItems.length && <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">No alerts or reports available in your current scope.</div>}
          </div>
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Recent activity</h3>
          <p className="text-sm text-slate-500">Activity logs loaded from /activity-logs.</p>
          <div className="mt-4 space-y-3">
            {recentActivity.map((item) => (
              <div key={item.id} className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm font-medium text-slate-800">{describeActivityLog(item, taskMap)}</p>
                <p className="mt-1 text-xs text-slate-500">{item.user?.name || 'System'} · {new Date(item.createdAt).toLocaleString()}</p>
              </div>
            ))}
            {!recentActivity.length && <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">No recent activity in your current scope.</div>}
          </div>
        </section>
      </div>
    </div>
  );
}

function TaskTable({
  currentUser,
  users,
  tasks,
  pendingOnly,
  onSubmitForApproval,
  onApprove,
  onReject,
  onStartTask,
  submissionNotes,
  rejectionReasons,
}) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [noteDrafts, setNoteDrafts] = useState({});
  const [rejectionDrafts, setRejectionDrafts] = useState({});

  const filtered = useMemo(() => {
    return tasks.filter((task) => {
      const pendingScope = pendingOnly
        ? canReviewTask(currentUser)
          ? task.status === STATUSES.PENDING_APPROVAL
          : [STATUSES.PENDING_APPROVAL, STATUSES.APPROVED, STATUSES.REJECTED].includes(task.status)
        : true;
      const matchesSearch = [
        task.title,
        task.description,
        task.roleName,
        task.subUnitName,
        task.countryName,
        task.divisionName,
      ]
        .join(' ')
        .toLowerCase()
        .includes(search.toLowerCase());
      const matchesStatus = statusFilter === 'all' ? true : task.status === statusFilter;
      return pendingScope && matchesSearch && matchesStatus;
    });
  }, [currentUser, pendingOnly, search, statusFilter, tasks]);

  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{pendingOnly ? (canReviewTask(currentUser) ? 'Approval queue' : 'Workflow status') : 'Task board'}</h3>
          <p className="text-sm text-slate-500">
            {pendingOnly
              ? canReviewTask(currentUser)
                ? 'Review task submissions and approve or reject governance-ready work.'
                : 'Track submitted, approved and rejected tasks in your current backend scope.'
              : 'Backend-driven task list mapped from the operations engine workflow.'}
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="flex items-center gap-2 rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-500">
            <Search size={16} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search tasks" className="w-44 bg-transparent outline-none" />
          </label>
          <label className="flex items-center gap-2 rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-500">
            <Filter size={16} />
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="bg-transparent outline-none">
              <option value="all">All statuses</option>
              {Object.values(STATUSES).map((status) => (
                <option key={status} value={status}>{formatLabel(status)}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="mt-5 space-y-4">
        {filtered.map((task) => {
          const assignedUser = users.find((user) => user.id === task.assignedUserId);
          const canStart = task.assignedUserId === currentUser.id && task.status === STATUSES.TODO;
          const canSubmit = task.assignedUserId === currentUser.id && task.status === STATUSES.IN_PROGRESS;
          const canReview = canReviewTask(currentUser) && task.status === STATUSES.PENDING_APPROVAL;
          const completionNote = submissionNotes[task.id];
          const rejectionReason = rejectionReasons[task.id];

          return (
            <article key={task.id} className="rounded-3xl border border-slate-200 p-4">
              <div className="flex flex-col gap-3 2xl:flex-row 2xl:items-start 2xl:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-lg font-semibold text-slate-900">{task.title}</h4>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClasses(task.status)}`}>{formatLabel(task.status)}</span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{formatLabel(task.priority)}</span>
                  </div>
                  <p className="mt-2 max-w-3xl text-sm text-slate-500">{task.description}</p>
                  <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-400">
                    <span>{task.countryName}</span>
                    <span>{task.roleName || task.divisionName || 'Operational workflow'}</span>
                    <span>{task.subUnitName || 'General'}</span>
                    <span>Assigned to {assignedUser?.name || task.assignedUserName || 'Unknown'}</span>
                    {task.dueDate && <span>Due {task.dueDate}</span>}
                  </div>
                </div>
                <div className="text-xs text-slate-400">
                  <p>Created {new Date(task.createdAt).toLocaleString()}</p>
                  <p>Updated {new Date(task.updatedAt).toLocaleString()}</p>
                </div>
              </div>

              {completionNote && (
                <div className="mt-4 rounded-2xl bg-blue-50 p-3 text-sm text-blue-800">
                  <strong>Completion note:</strong> {completionNote}
                </div>
              )}

              {rejectionReason && task.status === STATUSES.REJECTED && (
                <div className="mt-4 rounded-2xl bg-rose-50 p-3 text-sm text-rose-800">
                  <strong>Rejected reason:</strong> {rejectionReason}
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
                    placeholder="Add a completion note for your workflow history"
                    value={noteDrafts[task.id] || submissionNotes[task.id] || ''}
                    onChange={(event) => setNoteDrafts((prev) => ({ ...prev, [task.id]: event.target.value }))}
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
                    onChange={(event) => setRejectionDrafts((prev) => ({ ...prev, [task.id]: event.target.value }))}
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

function UsersPanel({ currentUser, users, tasks, roles, rolePreferences }) {
  const groupedUsers = useMemo(() => {
    return users.reduce((groups, user) => {
      const country = user.countryName || 'Unknown';
      groups[country] = groups[country] || [];
      groups[country].push(user);
      return groups;
    }, {});
  }, [users]);

  const orderedCountries = Object.keys(groupedUsers).sort((left, right) => left.localeCompare(right));

  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-lg font-semibold text-slate-900">{canManageUsers(currentUser) ? 'User management overview' : 'Scoped users'}</h3>
      <p className="text-sm text-slate-500">
        {canManageUsers(currentUser)
          ? 'Board Governance can see users across countries. Operational members see the user scope returned by the backend.'
          : 'Users shown here are scoped by the backend based on your access.'}
      </p>
      <div className="mt-5 grid gap-4 xl:grid-cols-3">
        {orderedCountries.map((country) => (
          <div key={country} className="rounded-3xl border border-slate-200 p-4">
            <h4 className="text-base font-semibold text-slate-900">{country}</h4>
            <div className="mt-4 space-y-3">
              {groupedUsers[country].map((user) => {
                const accessLabel = inferOperationalRoleName(user, roles, tasks, rolePreferences);
                return (
                  <div key={user.id} className="rounded-2xl bg-slate-50 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-slate-900">{user.name}</p>
                        <p className="text-xs text-slate-500">{user.email}</p>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${accessTagClasses(accessLabel)}`}>{accessLabel}</span>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">Assigned tasks: {tasks.filter((task) => task.assignedUserId === user.id).length}</p>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        {!orderedCountries.length && (
          <div className="rounded-3xl border border-dashed border-slate-200 p-10 text-center text-sm text-slate-500 xl:col-span-3">
            No users available in your current scope.
          </div>
        )}
      </div>
    </section>
  );
}

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-slate-100 p-4 lg:p-8">
      <div className="mx-auto flex min-h-[70vh] max-w-4xl items-center justify-center rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-white">
            <UserCircle2 size={24} />
          </div>
          <h2 className="mt-4 text-2xl font-semibold text-slate-900">Connecting to Kuickart Operations Engine</h2>
          <p className="mt-2 text-sm text-slate-500">Checking your session and loading backend data.</p>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [roles, setRoles] = useState([]);
  const [users, setUsers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [reports, setReports] = useState([]);
  const [activityLogs, setActivityLogs] = useState([]);
  const [kpi, setKpi] = useState(null);
  const [authError, setAuthError] = useState('');
  const [pageError, setPageError] = useState('');
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [submissionNotes, setSubmissionNotes] = useState(loadSubmissionNotes);
  const [rolePreferences, setRolePreferences] = useState(loadRolePreferences);

  useEffect(() => {
    localStorage.setItem(SUBMISSION_NOTES_KEY, JSON.stringify(submissionNotes));
  }, [submissionNotes]);

  useEffect(() => {
    localStorage.setItem(OPERATIONAL_ROLE_PREFS_KEY, JSON.stringify(rolePreferences));
  }, [rolePreferences]);

  const refreshAllData = useCallback(async () => {
    if (!currentUser) return false;

    setIsRefreshing(true);
    setPageError('');

    try {
      const [rolesData, usersData, tasksData, alertsData, reportsData, activityData, kpiData] = await Promise.all([
        coreApi.getRoles(),
        coreApi.getUsers({ limit: 100 }),
        coreApi.getTasks({ limit: 100 }),
        coreApi.getAlerts({ limit: 50 }),
        coreApi.getReports({ limit: 50 }),
        coreApi.getActivityLogs({ limit: 50 }),
        coreApi.getKpi(),
      ]);

      setRoles(rolesData || []);
      setUsers((usersData || []).map(normalizeUser));
      setTasks((tasksData || []).map(normalizeTask));
      setAlerts(alertsData || []);
      setReports(reportsData || []);
      setActivityLogs(activityData || []);
      setKpi(kpiData || null);
      return true;
    } catch (requestError) {
      setPageError(requestError.message || 'Unable to load dashboard data from the backend.');
      return false;
    } finally {
      setIsRefreshing(false);
    }
  }, [currentUser]);

  const bootstrapSession = useCallback(async () => {
    setIsBootstrapping(true);
    setAuthError('');

    if (!getAccessToken() && !getRefreshToken()) {
      setCurrentUser(null);
      setIsBootstrapping(false);
      return;
    }

    try {
      const me = await authApi.me();
      setCurrentUser(normalizeUser(me));
    } catch {
      clearTokens();
      setCurrentUser(null);
    } finally {
      setIsBootstrapping(false);
    }
  }, []);

  useEffect(() => {
    bootstrapSession();
  }, [bootstrapSession]);

  useEffect(() => {
    if (!currentUser) {
      setRoles([]);
      setUsers([]);
      setTasks([]);
      setAlerts([]);
      setReports([]);
      setActivityLogs([]);
      setKpi(null);
      return;
    }

    refreshAllData();
  }, [currentUser, refreshAllData]);

  const accessLabel = useMemo(
    () => inferOperationalRoleName(currentUser, roles, tasks, rolePreferences),
    [currentUser, roles, tasks, rolePreferences],
  );

  const visibleTasks = tasks;

  const pendingTasks = useMemo(() => {
    if (!currentUser) return [];
    if (canReviewTask(currentUser)) {
      return visibleTasks.filter((task) => task.status === STATUSES.PENDING_APPROVAL);
    }
    return visibleTasks.filter((task) => [STATUSES.PENDING_APPROVAL, STATUSES.APPROVED, STATUSES.REJECTED].includes(task.status));
  }, [currentUser, visibleTasks]);

  const rejectionReasons = useMemo(() => buildTaskRejectionReasons(activityLogs), [activityLogs]);

  const rememberRolePreference = useCallback((userId, roleName) => {
    if (!userId || !roleName) return;
    setRolePreferences((prev) => ({ ...prev, [userId]: roleName }));
  }, []);

  async function handleLogin(credentials) {
    setIsSigningIn(true);
    setAuthError('');

    try {
      const response = await authApi.login(credentials);
      setTokens({ accessToken: response.accessToken, refreshToken: response.refreshToken });
      setCurrentUser(normalizeUser(response.user));
      setActiveTab('dashboard');
    } catch (requestError) {
      setAuthError(requestError.message || 'Unable to sign in.');
    } finally {
      setIsSigningIn(false);
    }
  }

  async function handleLogout() {
    try {
      const refreshToken = getRefreshToken();
      if (refreshToken) {
        await authApi.logout({ refreshToken });
      }
    } catch {
      // ignore logout failures and clear local session anyway
    } finally {
      clearTokens();
      setCurrentUser(null);
      setActiveTab('dashboard');
      setPageError('');
      setAuthError('');
    }
  }

  async function handleCreateTask(payload) {
    setPageError('');

    try {
      await coreApi.createTask(payload);
      await refreshAllData();
      return true;
    } catch (requestError) {
      setPageError(requestError.message || 'Unable to create task.');
      return false;
    }
  }

  async function handleStartTask(taskId) {
    setPageError('');

    try {
      await coreApi.startTask(taskId);
      await refreshAllData();
    } catch (requestError) {
      setPageError(requestError.message || 'Unable to start task.');
    }
  }

  async function handleSubmitForApproval(taskId, note) {
    setPageError('');

    try {
      await coreApi.submitTask(taskId);
      setSubmissionNotes((prev) => ({ ...prev, [taskId]: note.trim() }));
      setActiveTab('pending');
      await refreshAllData();
    } catch (requestError) {
      setPageError(requestError.message || 'Unable to submit task for approval.');
    }
  }

  async function handleApproveTask(taskId) {
    setPageError('');

    try {
      await coreApi.approveTask(taskId);
      await refreshAllData();
    } catch (requestError) {
      setPageError(requestError.message || 'Unable to approve task.');
    }
  }

  async function handleRejectTask(taskId, reason) {
    setPageError('');

    try {
      await coreApi.rejectTask(taskId, reason);
      await refreshAllData();
    } catch (requestError) {
      setPageError(requestError.message || 'Unable to reject task.');
    }
  }

  if (isBootstrapping) {
    return <LoadingScreen />;
  }

  if (!currentUser) {
    return <LoginScreen onLogin={handleLogin} error={authError} isSubmitting={isSigningIn} />;
  }

  return (
    <div className="min-h-screen bg-slate-100 p-4 lg:p-6">
      <div className="mx-auto flex max-w-[1600px] flex-col items-start gap-6 lg:flex-row">
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} currentUser={currentUser} onLogout={handleLogout} accessLabel={accessLabel} />

        <main className="min-w-0 flex-1 space-y-6 self-stretch">
          <Header currentUser={currentUser} onRefresh={refreshAllData} refreshing={isRefreshing} />

          {pageError && <div className="rounded-3xl bg-rose-50 px-5 py-4 text-sm text-rose-700">{pageError}</div>}

          <section className="flex flex-col gap-3 rounded-[28px] border border-slate-200 bg-gradient-to-br from-slate-900 to-slate-800 p-6 text-white shadow-sm xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-sm text-slate-300">Current access level</p>
              <h2 className="mt-1 text-2xl font-semibold">{accessLabel} · {currentUser.countryName}</h2>
              <p className="mt-2 max-w-2xl text-sm text-slate-300">
                {isGovernanceUser(currentUser)
                  ? 'Full governance oversight across KPIs, alerts, reports, activity logs, users and approvals.'
                  : 'Operational workflow access for task execution, task submission, scoped reports and scoped dashboard visibility.'}
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
            <Dashboard currentUser={currentUser} kpi={kpi} alerts={alerts} reports={reports} activityLogs={activityLogs} tasks={visibleTasks} />
          )}

          {activeTab === 'tasks' && (
            <TaskTable
              currentUser={currentUser}
              users={users}
              tasks={visibleTasks}
              pendingOnly={false}
              onSubmitForApproval={handleSubmitForApproval}
              onApprove={handleApproveTask}
              onReject={handleRejectTask}
              onStartTask={handleStartTask}
              submissionNotes={submissionNotes}
              rejectionReasons={rejectionReasons}
            />
          )}

          {activeTab === 'pending' && (
            <TaskTable
              currentUser={currentUser}
              users={users}
              tasks={pendingTasks}
              pendingOnly
              onSubmitForApproval={handleSubmitForApproval}
              onApprove={handleApproveTask}
              onReject={handleRejectTask}
              onStartTask={handleStartTask}
              submissionNotes={submissionNotes}
              rejectionReasons={rejectionReasons}
            />
          )}

          {activeTab === 'users' && (
            <UsersPanel currentUser={currentUser} users={users} tasks={visibleTasks} roles={roles} rolePreferences={rolePreferences} />
          )}
        </main>
      </div>

      {showCreateModal && (
        <TaskForm
          currentUser={currentUser}
          users={users}
          roles={roles}
          tasks={visibleTasks}
          rolePreferences={rolePreferences}
          onRememberRole={rememberRolePreference}
          onSubmit={handleCreateTask}
          onClose={() => setShowCreateModal(false)}
        />
      )}
    </div>
  );
}
