import { supabase } from '../supabase.js'

const ACCESS_TOKEN_KEY = 'kuickart_access_token'
const REFRESH_TOKEN_KEY = 'kuickart_refresh_token'

function setTokensFromSession(session) {
  try {
    if (!session) return
    localStorage.setItem(ACCESS_TOKEN_KEY, session.access_token || '')
    localStorage.setItem(REFRESH_TOKEN_KEY, session.refresh_token || '')
  } catch {}
}

export function getAccessToken() {
  try {
    return localStorage.getItem(ACCESS_TOKEN_KEY) || ''
  } catch {
    return ''
  }
}

export function getRefreshToken() {
  try {
    return localStorage.getItem(REFRESH_TOKEN_KEY) || ''
  } catch {
    return ''
  }
}

export function setTokens({ accessToken, refreshToken }) {
  try {
    if (accessToken) localStorage.setItem(ACCESS_TOKEN_KEY, accessToken)
    if (refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
  } catch {}
}

export function clearTokens() {
  try {
    localStorage.removeItem(ACCESS_TOKEN_KEY)
    localStorage.removeItem(REFRESH_TOKEN_KEY)
  } catch {}
}

export async function refreshSession() {
  const { data, error } = await supabase.auth.refreshSession()
  if (error) throw error
  setTokensFromSession(data.session)
  return {
    accessToken: data.session?.access_token || '',
    refreshToken: data.session?.refresh_token || '',
  }
}

async function getMyProfile() {
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError) throw authError
  const user = authData.user
  if (!user) return null

  const { data, error } = await supabase
    .from('profiles')
    .select(`
      id,
      email,
      full_name,
      is_active,
      country:countries(id, name, code),
      role:operational_roles(id, name, division:divisions(id, name))
    `)
    .eq('id', user.id)
    .single()

  if (error) throw error

  return {
    id: data.id,
    email: data.email,
    name: data.full_name,
    isActive: data.is_active,
    country: data.country,
    role: data.role?.name || null,
    roleRecord: data.role,
  }
}

export const authApi = {
  async login(payload) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: payload.email,
      password: payload.password,
    })
    if (error) throw error

    setTokensFromSession(data.session)
    const user = await getMyProfile()

    return {
      accessToken: data.session?.access_token || '',
      refreshToken: data.session?.refresh_token || '',
      user,
    }
  },

  async me() {
    return getMyProfile()
  },

  async logout() {
    const { error } = await supabase.auth.signOut()
    clearTokens()
    if (error) throw error
    return { success: true }
  },
}

export const coreApi = {
  async getUsers() {
    const { data, error } = await supabase
      .from('profiles')
      .select(`
        id,
        email,
        full_name,
        is_active,
        country:countries(id, name, code),
        role:operational_roles(id, name, division:divisions(id, name))
      `)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  async getCountries() {
    const { data, error } = await supabase
      .from('countries')
      .select('*')
      .order('name')
    if (error) throw error
    return data || []
  },

  async getDivisions() {
    const { data, error } = await supabase
      .from('divisions')
      .select('*')
      .order('name')
    if (error) throw error
    return data || []
  },

  async getRoles() {
    const { data, error } = await supabase
      .from('operational_roles')
      .select(`
        id,
        name,
        division:divisions(id, name)
      `)
      .order('name')
    if (error) throw error
    return data || []
  },

  async getSubUnits(query = {}) {
    let req = supabase
      .from('subunits')
      .select('*')
      .order('name')

    if (query.roleId) req = req.eq('role_id', query.roleId)

    const { data, error } = await req
    if (error) throw error
    return data || []
  },

  async getTaskTemplates(query = {}) {
    let req = supabase
      .from('task_templates')
      .select('*')
      .order('name')

    if (query.roleId) req = req.eq('role_id', query.roleId)
    if (query.subUnitId) req = req.eq('subunit_id', query.subUnitId)

    const { data, error } = await req
    if (error) throw error
    return data || []
  },

  async getTasks() {
    const { data, error } = await supabase
      .from('tasks')
      .select(`
        *,
        country:countries(id, name, code),
        division:divisions(id, name),
        role:operational_roles(id, name),
        subunit:subunits(id, name),
        template:task_templates(id, name, description, default_priority),
        assignedUser:profiles!tasks_assigned_user_id_fkey(id, email, full_name),
        createdBy:profiles!tasks_created_by_fkey(id, email, full_name)
      `)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  async createTask(payload) {
    const { data, error } = await supabase
      .from('tasks')
      .insert({
        task_template_id: payload.taskTemplateId,
        assigned_user_id: payload.assignedUserId,
        custom_instructions: payload.customInstructions || null,
        initial_notes: payload.initialNotes || null,
        priority: payload.priority || null,
        due_date: payload.dueDate || null,
        title: payload.title || null,
        description: payload.description || null,
      })
      .select()
      .single()

    if (error) throw error
    return data
  },

  async startTask(taskId) {
    const { data, error } = await supabase.rpc('start_task', { p_task_id: taskId })
    if (error) throw error
    return data
  },

  async submitTask(taskId) {
    const { data, error } = await supabase.rpc('submit_task', { p_task_id: taskId })
    if (error) throw error
    return data
  },

  async approveTask(taskId) {
    const { data, error } = await supabase.rpc('approve_task', { p_task_id: taskId })
    if (error) throw error
    return data
  },

  async rejectTask(taskId, reason) {
    const { data, error } = await supabase.rpc('reject_task', {
      p_task_id: taskId,
      p_reason: reason,
    })
    if (error) throw error
    return data
  },

  async getKpi(query = {}) {
    const { data, error } = await supabase.rpc('get_kpi', {
      p_country_id: query.countryId || null,
      p_division_id: query.divisionId || null,
      p_date_from: query.dateFrom || null,
      p_date_to: query.dateTo || null,
    })
    if (error) throw error
    return data
  },

  async getAlerts() {
    const { data, error } = await supabase
      .from('alerts')
      .select(`
        *,
        division:divisions(id, name),
        country:countries(id, name, code),
        createdBy:profiles(id, email, full_name)
      `)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  async getReports(query = {}) {
    let req = supabase
      .from('reports')
      .select(`
        *,
        division:divisions(id, name),
        country:countries(id, name, code),
        createdBy:profiles(id, email, full_name)
      `)
      .order('created_at', { ascending: false })

    if (query.countryId) req = req.eq('country_id', query.countryId)
    if (query.divisionId) req = req.eq('division_id', query.divisionId)
    if (query.dateFrom) req = req.gte('created_at', query.dateFrom)
    if (query.dateTo) req = req.lte('created_at', query.dateTo)

    const { data, error } = await req
    if (error) throw error
    return data || []
  },

  async getReportSummary(query = {}) {
    const { data, error } = await supabase.rpc('get_reports_summary', {
      p_country_id: query.countryId || null,
      p_division_id: query.divisionId || null,
      p_date_from: query.dateFrom || null,
      p_date_to: query.dateTo || null,
    })
    if (error) throw error
    return data
  },

  async getActivityLogs() {
    const { data, error } = await supabase
      .from('activity_logs')
      .select(`
        *,
        actor:profiles(id, email, full_name)
      `)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  },
}

export const API_BASE_URL = 'supabase'