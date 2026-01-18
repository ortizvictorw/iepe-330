export const peopleData = [
  { name: 'Victor Ortiz', cuotasPaid: 2 },
  { name: 'Maria Perez', cuotasPaid: 1 },
  { name: 'Juan Gomez', cuotasPaid: 2 },
  { name: 'Luisa Lopez', cuotasPaid: 1 },
  { name: 'Carlos Ramirez', cuotasPaid: 3 },
  { name: 'Ana Diaz', cuotasPaid: 2 },
  { name: 'Victor Ortiz', cuotasPaid: 1 },
  { name: 'Paula Mora', cuotasPaid: 2 },
  { name: 'Diego Torres', cuotasPaid: 3 },
  { name: 'Marcos Silva', cuotasPaid: 0 },
  // generate up to 300 entries by repeating patterns
  ...Array.from({ length: 290 }).flatMap((_, i) => {
    const names = ['Victor Ortiz','Maria Perez','Juan Gomez','Luisa Lopez','Carlos Ramirez','Ana Diaz','Diego Torres','Paula Mora','Marcos Silva','Sofia Reyes']
    return [{ name: names[i % names.length], cuotasPaid: Math.floor(Math.random() * 4) }]
  })
]

export default peopleData
