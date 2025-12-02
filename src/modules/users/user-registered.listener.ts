import { db } from "../../db";
import { users } from "../../db/schema";
import { eq } from "drizzle-orm";

/**
 * Monolitik yapı için basitleştirilmiş kullanıcı oluşturma fonksiyonu
 * Artık event bus kullanmıyoruz - direkt veritabanına yazıyoruz
 */
export async function createUserProfile(data: {
  userId: string;
  tenantId: string;
  email?: string;
  gender?: string;
}): Promise<boolean> {
  try {
    // Zorunlu alan kontrolü
    if (!data?.userId || !data?.tenantId) {
      console.warn("Kullanıcı oluşturma için gerekli alanlar eksik:", data);
      return false;
    }

    // Idempotent davranış: authUserId zaten varsa ekleme yapma
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, data.userId))
      .limit(1);

    if (existing.length > 0) {
      console.log(`Kullanıcı zaten mevcut: id=${data.userId}`);
      return true;
    }

    // Yeni kullanıcı profili ekle
    await db.insert(users).values({
      id: data.userId,
      tenantId: data.tenantId,
      gender: data.gender && ['male', 'female', 'other'].includes(data.gender) ? data.gender as 'male' | 'female' | 'other' : null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    console.log(
      `Kullanıcı profili oluşturuldu: id=${data.userId}, tenant=${data.tenantId}`
    );
    return true;
  } catch (error) {
    console.error("Kullanıcı profili oluşturma hatası:", error);
    return false;
  }
}

/**
 * Kullanıcı kaydı listener'ı - artık event bus kullanmıyor
 * Bu fonksiyon doğrudan çağrılacak veya cron job ile çalışacak
 */
export async function startUsersEventListener(): Promise<() => Promise<void>> {
  console.log("[users] Monolitik kullanıcı listener başlatıldı");

  // Cleanup fonksiyonu - artık event bus bağlantısı yok
  return async () => {
    console.log("[users] Kullanıcı listener durduruldu");
  };
}
