import { commodityService } from '../services/firebaseService';

// JSON dosyasından ürün verilerini içe aktarma fonksiyonu
export const importCommoditiesFromJSON = async (jsonData) => {
  try {
    console.log('Ürün verilerini içe aktarma başlatılıyor...');
    
    if (!jsonData.commodityList) {
      throw new Error('JSON dosyasında commodityList bulunamadı');
    }

    const commodities = jsonData.commodityList;
    const commodityArray = Object.values(commodities);
    
    console.log(`${commodityArray.length} ürün bulundu, içe aktarılıyor...`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const commodity of commodityArray) {
      try {
        // Ürün kodunu kontrol et
        if (!commodity['Commodity code'] || !commodity['Product name']) {
          console.warn('Eksik veri:', commodity);
          errorCount++;
          continue;
        }
        
        const result = await commodityService.createCommodity(commodity);
        
        if (result.success) {
          successCount++;
          console.log(`✓ ${commodity['Product name']} başarıyla eklendi`);
        } else {
          errorCount++;
          console.error(`✗ ${commodity['Product name']} eklenemedi:`, result.error);
        }
      } catch (error) {
        errorCount++;
        console.error(`✗ Ürün eklenirken hata:`, error);
      }
    }
    
    console.log(`İçe aktarma tamamlandı! Başarılı: ${successCount}, Hatalı: ${errorCount}`);
    
    return {
      success: true,
      successCount,
      errorCount,
      total: commodityArray.length
    };
  } catch (error) {
    console.error('İçe aktarma hatası:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Örnek kullanım:
// importCommoditiesFromJSON(jsonData).then(result => {
//   if (result.success) {
//     console.log(`${result.successCount} ürün başarıyla içe aktarıldı`);
//   }
// });