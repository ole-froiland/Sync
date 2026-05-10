import { createClient } from '@supabase/supabase-js'

const TEST_USER = {
  email: 'elias.test@syncapp.dev',
  password: 'Test1234!',
  fullName: 'Elias Nilsen',
  firstName: 'Elias',
  lastName: 'Nilsen',
  username: 'eliasn',
  selectedAvatar: '10-emerald',
  avatarEmoji: '🐧',
  avatarColor: '#059669',
  toolsUsed: ['Codex', 'GitHub', 'VS Code'],
}

function requireEnv(name) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required env var: ${name}`)
  }
  return value
}

function assertConfigured(value, name) {
  if (!value.startsWith('http') && name === 'NEXT_PUBLIC_SUPABASE_URL') {
    throw new Error(`${name} must be a real Supabase URL.`)
  }
  if (value.includes('your_') || value.includes('your-')) {
    throw new Error(`${name} still contains a placeholder value.`)
  }
  return value
}

function avatarToUrl(emoji, color) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="40" height="40"><circle cx="20" cy="20" r="20" fill="${color}"/><text x="20" y="21.5" font-size="20" text-anchor="middle" dominant-baseline="middle">${emoji}</text></svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

async function findUserByEmail(supabase, email) {
  let page = 1

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error

    const match = data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase())
    if (match) return match
    if (data.users.length < 200) return null
    page += 1
  }
}

async function ensureTestUser() {
  const supabaseUrl = assertConfigured(requireEnv('NEXT_PUBLIC_SUPABASE_URL'), 'NEXT_PUBLIC_SUPABASE_URL')
  const serviceRoleKey = assertConfigured(requireEnv('SUPABASE_SERVICE_ROLE_KEY'), 'SUPABASE_SERVICE_ROLE_KEY')

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  const avatarUrl = avatarToUrl(TEST_USER.avatarEmoji, TEST_USER.avatarColor)
  const existingAuthUser = await findUserByEmail(supabase, TEST_USER.email)

  let userId

  if (!existingAuthUser) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: TEST_USER.email,
      password: TEST_USER.password,
      email_confirm: true,
      user_metadata: {
        full_name: TEST_USER.fullName,
        avatar_url: avatarUrl,
      },
    })

    if (error) throw error
    userId = data.user.id
    console.log(`Created auth user ${TEST_USER.email}`)
  } else {
    userId = existingAuthUser.id

    const { error } = await supabase.auth.admin.updateUserById(userId, {
      password: TEST_USER.password,
      email_confirm: true,
      user_metadata: {
        ...(existingAuthUser.user_metadata ?? {}),
        full_name: TEST_USER.fullName,
        avatar_url: avatarUrl,
      },
    })

    if (error) throw error
    console.log(`Updated existing auth user ${TEST_USER.email}`)
  }

  const { data: profileByEmail, error: profileByEmailError } = await supabase
    .from('profiles')
    .select('id, email, username')
    .eq('email', TEST_USER.email)
    .maybeSingle()
  if (profileByEmailError) throw profileByEmailError

  if (profileByEmail && profileByEmail.id !== userId) {
    throw new Error(
      `Profile conflict: ${TEST_USER.email} already belongs to another user (${profileByEmail.id}).`
    )
  }

  const { data: profileByUsername, error: profileByUsernameError } = await supabase
    .from('profiles')
    .select('id, email, username')
    .eq('username', TEST_USER.username)
    .maybeSingle()
  if (profileByUsernameError) throw profileByUsernameError

  if (profileByUsername && profileByUsername.id !== userId) {
    throw new Error(
      `Username conflict: ${TEST_USER.username} already belongs to another user (${profileByUsername.id}).`
    )
  }

  const { error: profileError } = await supabase.from('profiles').upsert(
    {
      id: userId,
      email: TEST_USER.email,
      name: TEST_USER.fullName,
      first_name: TEST_USER.firstName,
      last_name: TEST_USER.lastName,
      username: TEST_USER.username,
      selected_avatar: TEST_USER.selectedAvatar,
      avatar_url: avatarUrl,
      role: null,
      tools_used: TEST_USER.toolsUsed,
      onboarding_completed: true,
    },
    { onConflict: 'id' }
  )

  if (profileError) throw profileError

  console.log(`Upserted profile for ${TEST_USER.fullName}`)
  console.log(`Login: ${TEST_USER.email} / ${TEST_USER.password}`)
}

ensureTestUser().catch((error) => {
  console.error(error)
  process.exit(1)
})
