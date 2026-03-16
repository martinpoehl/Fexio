import { SupabaseClient } from '@supabase/supabase-js'

export async function getOrCreateCompanyId(supabase: SupabaseClient): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Nicht eingeloggt.')

  const { data: companies } = await supabase
    .from('companies')
    .select('id')
    .eq('user_id', user.id)
    .limit(1)

  if (companies && companies.length > 0) {
    return companies[0].id
  }

  // No company found — create one automatically
  const companyName =
    user.user_metadata?.company ||
    user.user_metadata?.full_name ||
    user.email?.split('@')[0] ||
    'Meine Firma'

  const { data: newCompany, error } = await supabase
    .from('companies')
    .insert([{ user_id: user.id, name: companyName, email: user.email || '' }])
    .select('id')
    .single()

  if (error) throw new Error('Firmenprofil konnte nicht erstellt werden: ' + error.message)
  return newCompany.id
}
