'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function generateMissionAction(): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY
  
  if (!apiKey) {
    return 'MISSION GENERATOR OFFLINE. (API Key missing)'
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: 'You are an AI coordinating a cyberpunk underground network. Generate a single, highly specific, short outdoor physical mission for a player to complete in the real world to earn points. Examples: "Locate and photograph a public payphone", "Stand under a flickering streetlamp for 30 seconds", "Find a red vehicle and touch the back bumper". Keep it under 15 words. DO NOT wrap it in quotes. Keep it gritty and serious.'
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.9,
            maxOutputTokens: 50,
          }
        })
      }
    )

    if (!response.ok) {
      console.error('Gemini API Error:', await response.text())
      return 'NETWORK INTERFERENCE. FAILED TO GENERATE MISSION.'
    }

    const data = await response.json()
    const mission = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
    
    return mission || 'FIND AND OBSERVE A SECURITY CAMERA FOR 1 MINUTE.'
  } catch (error) {
    console.error('Failed to fetch from Gemini:', error)
    return 'NETWORK INTERFERENCE. FAILED TO GENERATE MISSION.'
  }
}

export async function claimMissionRewardAction() {
  const supabase = await createClient()
  
  const { error } = await supabase.rpc('claim_mission_reward')
  
  if (error) {
    console.error('Failed to claim mission reward:', error)
    return { success: false }
  }

  revalidatePath('/game')
  return { success: true }
}
