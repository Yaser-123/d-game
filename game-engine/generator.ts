type SigilComponent = {
  id: string
  name: string
  description: string
}

const CORE_POWERS: SigilComponent[] = [
  { id: 'c1', name: 'Kinetic', description: 'Manipulate physical force and momentum.' },
  { id: 'c2', name: 'Thermal', description: 'Control ambient temperature and heat exchange.' },
  { id: 'c3', name: 'Chronal', description: 'Slightly alter local time perception and flow.' },
  { id: 'c4', name: 'Neural', description: 'Interact with the nervous systems of nearby targets.' },
  { id: 'c5', name: 'Spatial', description: 'Bend space for short-range displacement.' },
  { id: 'c6', name: 'Luminous', description: 'Control photons and light refraction.' },
  { id: 'c7', name: 'Acoustic', description: 'Manipulate sound waves and frequencies.' },
  { id: 'c8', name: 'Gravitic', description: 'Alter local gravity vectors.' },
  { id: 'c9', name: 'Chemical', description: 'Accelerate or inhibit chemical reactions.' },
  { id: 'c10', name: 'Magnetic', description: 'Control magnetic fields and ferrous materials.' },
  { id: 'c11', name: 'Vital', description: 'Manipulate life force and biological recovery.' },
  { id: 'c12', name: 'Ethereal', description: 'Phase through physical matter briefly.' },
]

const APPLICATIONS: SigilComponent[] = [
  { id: 'a1', name: 'Burst', description: 'Releases the effect in a sudden, violent expansion.' },
  { id: 'a2', name: 'Weave', description: 'Applies the effect in a continuous, controllable stream.' },
  { id: 'a3', name: 'Anchor', description: 'Binds the effect to a specific physical location.' },
  { id: 'a4', name: 'Echo', description: 'Creates delayed, repeating instances of the effect.' },
  { id: 'a5', name: 'Aura', description: 'Surrounds the user with a passive zone of effect.' },
]

const LIMITATIONS: SigilComponent[] = [
  { id: 'l1', name: 'Blood Toll', description: 'Using this ability causes minor physical damage to the user.' },
  { id: 'l2', name: 'Sensory Deprivation', description: 'Temporarily blinds or deafens the user during use.' },
  { id: 'l3', name: 'Cooldown', description: 'Requires a significant recovery period between uses.' },
  { id: 'l4', name: 'Proximity', description: 'Only effective at extremely close range.' },
  { id: 'l5', name: 'Catalyst', description: 'Requires a specific material or condition to activate.' },
  { id: 'l6', name: 'Inertia', description: 'Takes a long time to charge up before taking effect.' },
]

const HIDDEN_MECHANICS = [
  'Resonates strongly when used near other players with similar powers.',
  'Gradually permanently alters the user\'s physical appearance.',
  'Can be inverted to produce the exact opposite effect at great risk.',
  'Leaves a permanent, invisible trace that can be tracked by certain entities.',
  'Gains extreme power when the user is near death.',
  'Slowly drains the life force of flora and fauna in the vicinity.',
]

const ABILITY_TEMPLATES = [
  { type: 'DAMAGE', magnitude: 25, cooldown: 3 },
  { type: 'HEAL', magnitude: 30, cooldown: 4 },
  { type: 'SHIELD', magnitude: 15, duration: 2, cooldown: 3 },
  { type: 'COUNTER', magnitude: 20, duration: 1, cooldown: 3 },
  { type: 'DISRUPT', duration: 1, cooldown: 4 }
]

export function generateSigil(_randomSeed: number) {
  const core = CORE_POWERS[Math.floor(Math.random() * CORE_POWERS.length)]
  const app = APPLICATIONS[Math.floor(Math.random() * APPLICATIONS.length)]
  const limit = LIMITATIONS[Math.floor(Math.random() * LIMITATIONS.length)]
  const hiddenIdx = Math.floor(Math.random() * HIDDEN_MECHANICS.length)
  const hidden = HIDDEN_MECHANICS[hiddenIdx]
  
  // Pick a structured ability deterministically based on the generated components
  const templateIdx = (CORE_POWERS.indexOf(core) + APPLICATIONS.indexOf(app)) % ABILITY_TEMPLATES.length
  const abilityMeta = ABILITY_TEMPLATES[templateIdx]

  const fingerprint = `${core.id}-${app.id}-${limit.id}-${hiddenIdx}`
  const name = `${core.name} ${app.name}`
  const basicAbility = `You can ${core.description.toLowerCase()} Your application method is ${app.name.toUpperCase()}, which ${app.description.toLowerCase()}`
  
  return {
    fingerprint,
    name,
    basic_ability: basicAbility,
    limitation: limit.description,
    hidden_mechanic: hidden,
    ability_meta: abilityMeta
  }
}

