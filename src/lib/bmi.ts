// Puro y sin "server-only": Onboarding necesita previsualizar el IMC en cliente
// mientras el usuario escribe, antes de que exista ningún perfil guardado.

export function calculateBmi(weightKg: number, heightCm: number): number {
  const heightM = heightCm / 100;
  return Math.round((weightKg / (heightM * heightM)) * 10) / 10;
}

export function calculateAge(dateOfBirth: string): number {
  const [birthYear, birthMonth, birthDay] = dateOfBirth.split("-").map(Number);
  const today = new Date();
  const todayMonth = today.getMonth() + 1;
  const todayDay = today.getDate();

  let age = today.getFullYear() - birthYear;
  const birthdayAlreadyPassedThisYear =
    todayMonth > birthMonth || (todayMonth === birthMonth && todayDay >= birthDay);
  if (!birthdayAlreadyPassedThisYear) {
    age -= 1;
  }
  return age;
}

export function categorizeBmi(bmi: number): { category: string; color: string; emoji: string } {
  if (bmi < 18.5) return { category: "Bajo peso", color: "#3b82f6", emoji: "🔵" };
  if (bmi < 25) return { category: "Normal", color: "#22c55e", emoji: "🟢" };
  if (bmi < 30) return { category: "Sobrepeso", color: "#eab308", emoji: "🟡" };
  return { category: "Obesidad", color: "#ef4444", emoji: "🔴" };
}
