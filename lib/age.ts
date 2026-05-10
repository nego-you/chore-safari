// 生年月日から「現在の満年齢」を算出するユーティリティ。
// DB には age を持たせず、表示時にここで計算する。

export function calculateAge(birthDate: Date, now: Date = new Date()): number {
  let age = now.getFullYear() - birthDate.getFullYear();
  const monthDiff = now.getMonth() - birthDate.getMonth();
  if (
    monthDiff < 0 ||
    (monthDiff === 0 && now.getDate() < birthDate.getDate())
  ) {
    age -= 1;
  }
  return age;
}

export function formatBirthDate(birthDate: Date): string {
  const yyyy = birthDate.getFullYear();
  const mm = String(birthDate.getMonth() + 1).padStart(2, "0");
  const dd = String(birthDate.getDate()).padStart(2, "0");
  return `${yyyy}/${mm}/${dd}`;
}
