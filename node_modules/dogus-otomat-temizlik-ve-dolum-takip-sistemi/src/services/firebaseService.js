import { ref, get, set, push, remove, update, query, orderByChild, equalTo } from 'firebase/database';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { database, auth } from '../config/firebase';

// Firebase Realtime Database referansları - Firebase v9 syntax
const getReportsRef = () => ref(database, 'temizlikTakip/reports');
const getUsersRef = () => ref(database, 'temizlikTakip/users');
const getCommoditiesRef = () => ref(database, 'temizlikTakip/commodityList');
const getReportRef = (reportId) => ref(database, `temizlikTakip/reports/${reportId}`);
const getUserRef = (userId) => ref(database, `temizlikTakip/users/${userId}`);
const getCommodityRef = (commodityId) => ref(database, `temizlikTakip/commodityList/${commodityId}`);

// Auth Servisi
export const authService = {
  // Kullanıcı girişi
  async login(email, password) {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // Kullanıcı bilgilerini veritabanından al
      const userSnapshot = await get(getUserRef(user.uid));
      if (userSnapshot.exists()) {
        const userData = userSnapshot.val();
        console.log('Firebase\'den gelen kullanıcı bilgileri:', userData);
        
        // lastLogin'i güncelle
        const currentTime = new Date().toISOString();
        await update(getUserRef(user.uid), {
          lastLogin: currentTime,
          updatedAt: currentTime
        });
        
        return { 
          success: true, 
          user: { 
            uid: user.uid, 
            email: user.email,
            ...userData,
            lastLogin: currentTime
          } 
        };
      } else {
        return { success: false, error: 'Kullanıcı bilgileri bulunamadı' };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Kullanıcı çıkışı
  async logout() {
    try {
      await signOut(auth);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Kullanıcı oluştur
  async createUser(email, password, userData) {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // Kullanıcı bilgilerini veritabanına kaydet
      const newUser = {
        id: user.uid,
        email: user.email,
        ...userData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      console.log('Firebase\'e kaydedilecek kullanıcı:', newUser);
      
      await set(getUserRef(user.uid), newUser);
      return { success: true, user: newUser };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Auth state listener
  onAuthStateChanged(callback) {
    return onAuthStateChanged(auth, callback);
  },

  // Mevcut kullanıcı
  getCurrentUser() {
    return auth.currentUser;
  },

  // Kullanıcı bilgilerini getir
  async getUserById(userId) {
    try {
      const snapshot = await get(getUserRef(userId));
      if (snapshot.exists()) {
        return { 
          success: true, 
          user: { id: snapshot.key, ...snapshot.val() } 
        };
      }
      return { success: false, error: 'Kullanıcı bulunamadı' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
};

// Rapor Servisleri
export const reportService = {
  // Tüm raporları getir
  async getAllReports() {
    try {
      const snapshot = await get(getReportsRef());
      
      if (snapshot.exists()) {
        const reports = [];
        snapshot.forEach((childSnapshot) => {
          reports.push({
            id: childSnapshot.key,
            ...childSnapshot.val()
          });
        });
        return { success: true, reports };
      }
      return { success: true, reports: [] };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Kullanıcının raporlarını getir
  async getUserReports(userId) {
    try {
      
      // userId kontrolü
      if (!userId) {
        return { success: false, error: 'Kullanıcı kimliği gerekli' };
      }
      
      const reportsQuery = query(
        getReportsRef(),
        orderByChild('userId'),
        equalTo(userId)
      );
      const snapshot = await get(reportsQuery);
      
      if (snapshot.exists()) {
        const reports = [];
        snapshot.forEach((childSnapshot) => {
          reports.push({
            id: childSnapshot.key,
            ...childSnapshot.val()
          });
        });
        return { success: true, reports };
      }
      return { success: true, reports: [] };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Günlük rapor sayısını al
  async getDailyReportCount() {
    try {
      const snapshot = await get(getReportsRef());
      if (snapshot.exists()) {
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD formatı
        let count = 0;
        
        snapshot.forEach((childSnapshot) => {
          const report = childSnapshot.val();
          // Raporun oluşturulma tarihini kontrol et
          if (report.createdAt && report.createdAt.startsWith(today)) {
            count++;
          }
        });
        
        return count;
      }
      return 0;
    } catch (error) {
      return 0;
    }
  },

  // Rapor ID'si oluştur (DGS-(Rapor numarası)(Yıl)(Ay)(Gün) formatında)
  async generateReportId() {
    try {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const dateStr = `${year}${month}${day}`;
      
      // Günlük rapor sayısını al
      const dailyCount = await this.getDailyReportCount();
      // Sıradaki rapor numarası (3 haneli)
      const nextNumber = String(dailyCount + 1).padStart(3, '0');
      
      return `DGS-${nextNumber}${dateStr}`;
    } catch (error) {
      // Hata durumunda rastgele ID oluştur
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const dateStr = `${year}${month}${day}`;
      const randomNumber = Math.floor(Math.random() * 900) + 100;
      
      return `DGS-${randomNumber}${dateStr}`;
    }
  },

  // Rapor oluştur
  async createReport(reportData) {
    try {
      // Yeni rapor ID formatı oluştur
      const reportId = await this.generateReportId();
      
      const report = {
        id: reportId,
        ...reportData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Raporu belirli ID ile kaydet
      const reportRef = getReportRef(reportId);
      await set(reportRef, report);
      
      return { success: true, reportId, report };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Rapor güncelle
  async updateReport(reportId, updateData) {
    try {
      const reportRef = getReportRef(reportId);
      await update(reportRef, {
        ...updateData,
        updatedAt: new Date().toISOString()
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Rapor sil
  async deleteReport(reportId) {
    try {
      // Önce raporu getir
      const reportSnapshot = await get(getReportRef(reportId));
      if (!reportSnapshot.exists()) {
        return { success: false, error: 'Rapor bulunamadı' };
      }

      // Raporu sil (fotoğraflar URL olarak saklandığı için ayrı silmeye gerek yok)
      await remove(getReportRef(reportId));
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Rapor detayını getir
  async getReportById(reportId) {
    try {
      const snapshot = await get(getReportRef(reportId));
      if (snapshot.exists()) {
        return { 
          success: true, 
          report: { id: snapshot.key, ...snapshot.val() } 
        };
      }
      return { success: false, error: 'Rapor bulunamadı' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Bayi raporlarını getir (kendisine tanımlı operasyon yetkilisi raporları)
  async getDealerReports(dealerId) {
    try {
      // Önce bayi bilgilerini al
      const dealerSnapshot = await get(getUserRef(dealerId));
      if (!dealerSnapshot.exists()) {
        return { success: false, error: 'Bayi bilgileri bulunamadı' };
      }

      const dealerData = dealerSnapshot.val();
      
      // Bayiye tanımlı operasyon yetkililerini bul
      const assignedOperators = dealerData.assignedOperators || [];
      
      if (assignedOperators.length === 0) {
        return { success: true, reports: [] };
      }

      // Bu operasyon yetkililerinin raporlarını getir
      const reports = [];
      for (const operatorId of assignedOperators) {
        const operatorReports = await this.getUserReports(operatorId);
        if (operatorReports.success) {
          reports.push(...operatorReports.reports);
        }
      }

      // Tarihe göre sırala (en yeni önce)
      reports.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      return { success: true, reports };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
};

// Kullanıcı Servisleri
export const userService = {
  // Tüm kullanıcıları getir
  async getAllUsers() {
    try {
      const snapshot = await get(getUsersRef());
      
      if (snapshot.exists()) {
        const users = [];
        snapshot.forEach((childSnapshot) => {
          users.push({
            id: childSnapshot.key,
            ...childSnapshot.val()
          });
        });
        return { success: true, users };
      }
      return { success: true, users: [] };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Kullanıcı getir
  async getUserById(userId) {
    try {
      const snapshot = await get(getUserRef(userId));
      if (snapshot.exists()) {
        return { 
          success: true, 
          user: { id: snapshot.key, ...snapshot.val() } 
        };
      }
      return { success: false, error: 'Kullanıcı bulunamadı' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Kullanıcı güncelle
  async updateUser(userId, updateData) {
    try {
      const userRef = getUserRef(userId);
      await update(userRef, {
        ...updateData,
        updatedAt: new Date().toISOString()
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Kullanıcı sil
  async deleteUser(userId) {
    try {
      await remove(getUserRef(userId));
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },


};

// Commodity Servisleri
export const commodityService = {
  // Tüm ürünleri getir
  async getAllCommodities() {
    try {
      const snapshot = await get(getCommoditiesRef());
      
      if (snapshot.exists()) {
        const commodities = [];
        snapshot.forEach((childSnapshot) => {
          commodities.push({
            id: childSnapshot.key,
            ...childSnapshot.val()
          });
        });
        return { success: true, commodities };
      }
      return { success: true, commodities: [] };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Ürün getir
  async getCommodityById(commodityId) {
    try {
      const snapshot = await get(getCommodityRef(commodityId));
      if (snapshot.exists()) {
        return { 
          success: true, 
          commodity: { id: snapshot.key, ...snapshot.val() } 
        };
      }
      return { success: false, error: 'Ürün bulunamadı' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Ürün oluştur
  async createCommodity(commodityData) {
    try {
      const newCommodityRef = push(getCommoditiesRef());
      const commodityId = newCommodityRef.key;
      
      const commodity = {
        id: commodityId,
        ...commodityData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await set(newCommodityRef, commodity);
      
      return { success: true, commodityId, commodity };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Ürün güncelle
  async updateCommodity(commodityId, updateData) {
    try {
      const commodityRef = getCommodityRef(commodityId);
      await update(commodityRef, {
        ...updateData,
        updatedAt: new Date().toISOString()
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Ürün sil
  async deleteCommodity(commodityId) {
    try {
      await remove(getCommodityRef(commodityId));
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
};

// Fotoğraf Servisi (LocalStorage + Sıkıştırılmış Base64)
export const photoService = {
  // Fotoğrafı sıkıştırılmış base64 olarak kaydet
  async savePhotoUrl(photoFile, folder = 'general') {
    try {
      
      // Dosyayı sıkıştır ve base64'e çevir
      const compressedBase64 = await this.compressAndConvertToBase64(photoFile);
      
      return { success: true, url: compressedBase64 };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Çoklu fotoğrafları sıkıştırılmış base64 olarak kaydet
  async saveMultiplePhotoUrls(photoFiles, folder = 'general') {
    try {
      
      const compressedBase64Array = [];
      for (const file of photoFiles) {
        const compressedBase64 = await this.compressAndConvertToBase64(file);
        compressedBase64Array.push(compressedBase64);
      }
      
      return {
        success: true,
        photos: compressedBase64Array
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Dosyayı sıkıştır ve base64'e çevir
  async compressAndConvertToBase64(file) {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        try {
          // Canvas boyutunu ayarla (maksimum 800x600)
          const maxWidth = 800;
          const maxHeight = 600;
          let { width, height } = img;
          
          if (width > height) {
            if (width > maxWidth) {
              height = (height * maxWidth) / width;
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = (width * maxHeight) / height;
              height = maxHeight;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          
          // Fotoğrafı canvas'a çiz
          ctx.drawImage(img, 0, 0, width, height);
          
          // JPEG olarak sıkıştır (kalite: 0.7)
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.7);
          
          resolve(compressedDataUrl);
        } catch (error) {
          reject(error);
        }
      };
      
      img.onerror = () => reject(new Error('Resim yüklenemedi'));
      
      // Dosyayı oku
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target.result;
      };
      reader.onerror = () => reject(new Error('Dosya okunamadı'));
      reader.readAsDataURL(file);
    });
  },

  // Fotoğrafı localStorage'a kaydet (büyük dosyalar için)
  async savePhotoToLocalStorage(photoFile, reportId, type) {
    try {
      
      const compressedBase64 = await this.compressAndConvertToBase64(photoFile);
      const photoKey = `photo_${reportId}_${type}_${Date.now()}`;
      
      // localStorage'a kaydet
      localStorage.setItem(photoKey, compressedBase64);
      
      return { 
        success: true, 
        url: compressedBase64,
        storageKey: photoKey 
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // localStorage'dan fotoğrafı getir
  async getPhotoFromLocalStorage(storageKey) {
    try {
      const photoData = localStorage.getItem(storageKey);
      if (photoData) {
        return { success: true, url: photoData };
      }
      return { success: false, error: 'Fotoğraf bulunamadı' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // localStorage'dan fotoğrafı sil
  async deletePhotoFromLocalStorage(storageKey) {
    try {
      localStorage.removeItem(storageKey);
      return { success: true, message: 'Fotoğraf localStorage\'dan silindi' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Fotoğraf URL'ini sil
  async deletePhotoUrl(photoUrl) {
    // Fotoğraf silme işlemi burada yapılabilir
    return { success: true, message: 'Fotoğraf silindi' };
  }
};

// Default export
const firebaseService = {
  authService,
  reportService,
  userService,
  commodityService,
  photoService
};

export default firebaseService;