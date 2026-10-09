'use client'

import { useState } from 'react'
import { toggleEquipment } from '@/app/actions/inventory'

export function EquipButton({ inventoryId, currentlyEquipped }: { inventoryId: string, currentlyEquipped: boolean }) {
  const [loading, setLoading] = useState(false)

  async function handleToggle() {
    setLoading(true)
    await toggleEquipment(inventoryId, !currentlyEquipped)
    setLoading(false)
  }

  if (currentlyEquipped) {
    return (
      <button 
        onClick={handleToggle} 
        disabled={loading}
        className="btn btn-danger text-[10px] h-6 px-3"
      >
        {loading ? '...' : 'UNEQUIP'}
      </button>
    )
  }

  return (
    <button 
      onClick={handleToggle} 
      disabled={loading}
      className="btn btn-outline border-border/50 text-[10px] h-6 px-3 hover:border-white hover:text-white"
    >
      {loading ? '...' : 'EQUIP'}
    </button>
  )
}
