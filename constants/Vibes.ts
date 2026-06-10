export type Vibe = {
  id: string
  emoji: string
  label: string
  tier: 1 | 2 // 1 = any chat, 2 = completed job only
}

export const VIBES: Vibe[] = [
  // Tier 1 — communication vibes (available after any chat)
  { id: 'great_communicator', emoji: '💬', label: 'Great communicator', tier: 1 },
  { id: 'quick_to_respond',   emoji: '⚡', label: 'Quick to respond',   tier: 1 },
  { id: 'professional',       emoji: '🤝', label: 'Professional attitude', tier: 1 },

  // Tier 2 — work quality vibes (available after completed job)
  { id: 'nailed_the_brief',        emoji: '🎯', label: 'Nailed the brief',         tier: 2 },
  { id: 'exceeded_expectations',   emoji: '✨', label: 'Exceeded expectations',    tier: 2 },
  { id: 'brought_new_ideas',       emoji: '💡', label: 'Brought new ideas',        tier: 2 },
  { id: 'would_hire_again',        emoji: '🔁', label: 'Would hire again',         tier: 2 },
  { id: 'lightning_fast',          emoji: '🚀', label: 'Lightning fast delivery',  tier: 2 },
]
