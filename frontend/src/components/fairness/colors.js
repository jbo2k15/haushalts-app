// Neutrale Personenfarben fuer die Fairness-Statistik (kein Gruen/Rot, nicht
// die Terrakotta-Primaerfarbe). Hell/Dunkel getrennt abgestimmt.
export const PERSON_COLORS = [
  'bg-[#2f5f9e] dark:bg-[#8fb3e6]',
  'bg-[#a99ad8] dark:bg-[#7b6bc0]',
  'bg-[#3d6b6b] dark:bg-[#8fc1c1]',
  'bg-[#9cb8e0] dark:bg-[#5f86c4]',
]

export function colorFor(people, id) {
  const i = people.findIndex(p => p.id === id)
  return PERSON_COLORS[(i < 0 ? 0 : i) % PERSON_COLORS.length]
}
