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
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
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
                  text: 'You are an AI coordinating a cyberpunk underground network. Generate a single, highly specific, short outdoor physical mission for a player to complete in the real world to earn points. Examples: "Locate and photograph a public payphone", "Find a red vehicle and photograph its tire", "Take a picture of a metallic chainlink fence". Keep it under 15 words. DO NOT wrap it in quotes. Keep it gritty and serious.'
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
    
    return mission || 'FIND AND PHOTOGRAPH A SECURITY CAMERA.'
  } catch (error) {
    console.error('Failed to fetch from Gemini:', error)
    return 'NETWORK INTERFERENCE. FAILED TO GENERATE MISSION.'
  }
}

export async function verifyAndClaimMissionAction(missionText: string, base64Image: string) {
  const apiKey = process.env.GEMINI_API_KEY
  
  if (!apiKey) {
    return { success: false, message: 'API Key missing.' }
  }

  try {
    // 1. Verify Image with Gemini Vision
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `The operative was given this mission: "${missionText}". Look at this image. Does it prove they completed the mission? Answer exactly "YES" or "NO".`
                },
                {
                  inlineData: {
                    mimeType: 'image/jpeg',
                    data: base64Image.split(',')[1] // Remove the data:image/jpeg;base64, prefix
                  }
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 5,
          }
        })
      }
    )

    if (!response.ok) {
      console.error('Gemini Vision API Error:', await response.text())
      return { success: false, message: 'AI VISION SYSTEM OFFLINE.' }
    }

    const data = await response.json()
    const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim().toUpperCase()

    if (aiResponse && aiResponse.includes('YES')) {
      // 2. Image Verified! Grant Points.
      const supabase = await createClient()
      const { error } = await supabase.rpc('claim_mission_reward')
      
      if (error) {
        console.error('Failed to claim mission reward:', error)
        return { success: false, message: 'DATABASE ERROR.' }
      }

      revalidatePath('/game')
      return { success: true, message: 'MISSION VERIFIED. POINTS SECURED.' }
    } else {
      return { success: false, message: 'MISSION FAILED. AI REJECTED PROOF.' }
    }
  } catch (error) {
    console.error('Failed to verify image:', error)
    return { success: false, message: 'UPLOAD INTERRUPTED.' }
  }
}
