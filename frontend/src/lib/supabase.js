// lib/supabase.js
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://szguatzzkzqyanekyaia.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN6Z3VhdHp6a3pxeWFuZWt5YWlhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzMDA2OTMsImV4cCI6MjA4NTg3NjY5M30.axHR8-r6-ypLijwCzy6VUUbBl7kD3b5EWQh_d8Fxw3M'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
})

export default supabase