
import { useState, useEffect } from 'react'
import { useAuth } from './use-auth'
import { supabase, UserStreak } from '@/lib/supabase'
import { useToast } from './use-toast'

export function useStreaks() {
  const { session } = useAuth()
  const { toast } = useToast()
  const [userStreak, setUserStreak] = useState<UserStreak | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (session.user) {
      fetchUserStreak()
    } else {
      setLoading(false)
    }
  }, [session.user])

  const fetchUserStreak = async () => {
    if (!session.user) return

    try {
      setLoading(true)
      setError(null)
      
      const { data, error } = await supabase
        .from('user_streaks')
        .select('*')
        .eq('user_id', session.user.id)
        .single();

      if (error) {
        // If no streak exists, create a new one
        if (error.message.includes('No rows found')) {
          await createNewStreak(session.user.id)
          return // Exit to prevent further errors, the next fetch will get the new streak
        }
        throw error
      }

      setUserStreak(data as unknown as UserStreak)
    } catch (error: any) {
      console.error('Error fetching user streak:', error)
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const createNewStreak = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('user_streaks')
        .insert([{ user_id: userId, current_streak: 0, max_streak: 0, last_played: null }])

      if (error) throw error

      // After creating, immediately fetch the new streak
      fetchUserStreak()
    } catch (error: any) {
      console.error('Error creating new streak:', error)
      setError(error.message)
      setLoading(false) // Make sure to set loading to false in case of error
    }
  }

  const updateStreak = async (): Promise<number | null> => {
    if (!session.user) return null;

    const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD

    try {
      // If no streak exists, create a new one
      if (!userStreak) {
        await createNewStreak(session.user.id)
        return 1 // Indicate the start of a new streak
      }

      const lastPlayed = userStreak.last_played ? userStreak.last_played.split('T')[0] : null

      if (lastPlayed === today) {
        // Already played today, do nothing
        return userStreak.current_streak
      }

      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const yesterdayStr = yesterday.toISOString().split('T')[0]

      let newStreak = 1
      if (lastPlayed === yesterdayStr) {
        // Continue streak
        newStreak = (userStreak.current_streak || 0) + 1
      }

      const { data, error } = await supabase
        .from('user_streaks')
        .update({
          current_streak: newStreak,
          max_streak: Math.max(newStreak, userStreak.max_streak || 0),
          last_played: new Date().toISOString(),
        })
        .eq('user_id', session.user.id)
        .select()
        .single()

      if (error) throw error

      setUserStreak(data)
      return newStreak
    } catch (error: any) {
      console.error('Error updating streak:', error)
      toast({
        title: "Streak Error",
        description: "Failed to update streak. Please try again.",
        variant: "destructive",
      })
      return null
    }
  }

  return {
    userStreak,
    loading,
    error,
    updateStreak: session.user ? updateStreak : () => Promise.resolve(null)
  }
}
