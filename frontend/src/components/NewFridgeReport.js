import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Container,
  Typography,
  TextField,
  Button,
  Grid,
  Paper,
  Box,
  Alert,
  CircularProgress,
  IconButton,
  FormControlLabel,
  Checkbox,
  MenuItem,
  Select,
  InputLabel,
  FormControl
} from '@mui/material';
import { PhotoCamera, Delete, CloudUpload, Add } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { reportService, photoService, commodityService } from '../services/firebaseService';
import { useAuth } from '../contexts/AuthContext';

// Error Boundary Component - güçlendirilmiş
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="h6" color="error" gutterBottom>
            Bir hata oluştu
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Uygulama beklenmeyen bir hata ile karşılaştı. Lütfen tekrar deneyin.
          </Typography>
          <Button 
            variant="contained" 
            color="primary"
            onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })}
            sx={{ mr: 1 }}
          >
            Tekrar Dene
          </Button>
          <Button 
            variant="outlined" 
            color="secondary"
            onClick={() => window.location.reload()}
          >
            Sayfayı Yenile
          </Button>
        </Box>
      );
    }

    return this.props.children;
  }
}

// Türkçe karakterleri ve özel karakterleri temizle - ASCII safe
const cleanLocation = (location) => {
  return location
    // Türkçe karakterler
    .replace(/ğ/g, 'g')
    .replace(/Ğ/g, 'G')
    .replace(/ü/g, 'u')
    .replace(/Ü/g, 'U')
    .replace(/ş/g, 's')
    .replace(/Ş/g, 'S')
    .replace(/ı/g, 'i')
    .replace(/I/g, 'I')
    .replace(/ö/g, 'o')
    .replace(/Ö/g, 'O')
    .replace(/ç/g, 'c')
    .replace(/Ç/g, 'C')
    // Özel karakterler
    .replace(/[^a-zA-Z0-9\s\-_]/g, '')
    // Birden fazla boşluğu tek boşluğa çevir
    .replace(/\s+/g, ' ')
    // Başındaki ve sonundaki boşlukları kaldır
    .trim();
};

// Ürün listesi - Firebase'den yüklenecek

const NewFridgeReport = () => {
  const navigate = useNavigate();
  const { userData, loading: authLoading } = useAuth();

  // Yetki kontrolü
  useEffect(() => {
    if (!authLoading && userData) {
      // Operasyon sorumlusu her zaman erişebilir
      if (userData.role === 'routeman') {
        return;
      }
      
      // Operasyon yetkilisi sadece yetkisi varsa erişebilir
      if (userData.role === 'operator') {
        if (!userData.permissions?.fridge) {
          navigate('/dashboard');
          return;
        }
        return;
      }
      
      // Diğer roller erişemez
      navigate('/dashboard');
    }
  }, [userData, authLoading, navigate]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [countdown, setCountdown] = useState(0);
  
  // Arıza sistemi state'leri
  const [hasIssue, setHasIssue] = useState(false);
  const [issueDescription, setIssueDescription] = useState('');
  
  // Zayi sistemi state'leri
  const [hasWaste, setHasWaste] = useState(false);
  const [wasteItems, setWasteItems] = useState([]);
  const [wasteReason, setWasteReason] = useState('');
  
  // Component unmount kontrolü için ref
  const isMounted = useRef(true);
  
  // Zayi ürün ekleme fonksiyonları
  const addWasteItem = () => {
    if (!wasteReason.trim()) {
      setError('Zayi sebebi belirtilmelidir!');
      return;
    }
    const newWasteItem = {
      id: Date.now(),
      productName: '',
      productCode: '',
      quantity: '',
      unit: 'adet', // Taze dolap için varsayılan
      reason: wasteReason.trim()
    };
    setWasteItems(prev => [...prev, newWasteItem]);
    setWasteReason('');
    setError('');
  };

  const removeWasteItem = (itemId) => {
    setWasteItems(prev => prev.filter(item => item.id !== itemId));
  };

  const updateWasteItem = (itemId, field, value) => {
    setWasteItems(prev => prev.map(item => 
      item.id === itemId ? { ...item, [field]: value } : item
    ));
  };
  
  // Form state
  const [formData, setFormData] = useState({
    location: '',
    machineSerialNumber: '',
    notes: ''
  });

  // Checklist states - taze dolap için basitleştirilmiş kontrol listesi
  const [equipmentChecklist, setEquipmentChecklist] = useState([
    { id: 1, text: 'Makine çalışma kontrolü', completed: false, completedAt: null },
    { id: 2, text: 'Soğutma sistemi kontrolü', completed: false, completedAt: null },
    { id: 3, text: 'Elektrik sistemi kontrolü', completed: false, completedAt: null },
    { id: 4, text: 'Sensör kontrolü', completed: false, completedAt: null },
    { id: 5, text: 'Güvenlik sistemi kontrolü', completed: false, completedAt: null },
    { id: 6, text: 'Ekran ve buton kontrolü', completed: false, completedAt: null }
  ]);

  // Manuel slot ekleme sistemi
  const [slots, setSlots] = useState([]);
  const [newSlotNumber, setNewSlotNumber] = useState('');
  const [commoditySearch, setCommoditySearch] = useState('');

  // Fotoğraf state'leri
  const [beforePhotos, setBeforePhotos] = useState([]);
  const [afterPhotos, setAfterPhotos] = useState([]);
  const [issuePhotos, setIssuePhotos] = useState([]);
  
  // Commodity list state
  const [commodityList, setCommodityList] = useState([]);
  
  // Cleanup effect - bellek sızıntılarını önle
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Slot verilerini güncelle
  const updateSlot = (slotId, field, value) => {
    setSlots(prev => prev.map(slot => 
      slot.id === slotId ? { ...slot, [field]: value } : slot
    ));
  };

  // Ürün seçimi için yardımcı fonksiyon
  const handleCommoditySelect = (slotId, displayText) => {
    // Display text'i direkt olarak kaydet
    updateSlot(slotId, 'commodity', displayText);
  };

  // Yeni slot ekle
  const addSlot = () => {
    if (!newSlotNumber.trim()) {
      setError('Slot numarası gerekli!');
      return;
    }
    
    const slotNum = parseInt(newSlotNumber);
    if (isNaN(slotNum) || slotNum < 1 || slotNum > 58) {
      setError('Slot numarası 1-58 arasında olmalı!');
      return;
    }
    
    // Aynı slot numarası var mı kontrol et
    if (slots.some(slot => slot.id === slotNum)) {
      setError('Bu slot numarası zaten eklenmiş!');
      return;
    }
    
    const newSlot = {
      id: slotNum,
      commodity: '',
      quantity: '',
      expiryDate: '',
      batchNumber: ''
    };
    
    setSlots(prev => [...prev, newSlot].sort((a, b) => a.id - b.id));
    setNewSlotNumber('');
    setError('');
  };

  // Slot sil
  const removeSlot = (slotId) => {
    setSlots(prev => prev.filter(slot => slot.id !== slotId));
  };

  // useEffect dependency'lerini düzelt
  useEffect(() => {
    return () => {
      // Cleanup: Object URL'leri temizle
      beforePhotos.forEach(photo => {
        if (photo.preview && photo.preview.startsWith('blob:')) {
          URL.revokeObjectURL(photo.preview);
        }
      });
      afterPhotos.forEach(photo => {
        if (photo.preview && photo.preview.startsWith('blob:')) {
          URL.revokeObjectURL(photo.preview);
        }
      });
      issuePhotos.forEach(photo => {
        if (photo.preview && photo.preview.startsWith('blob:')) {
          URL.revokeObjectURL(photo.preview);
        }
      });
    };
  }, [beforePhotos, afterPhotos, issuePhotos]);

    // Commodity list'i yükle - Optimized
  useEffect(() => {
    let isMounted = true;
    
    const loadCommodities = async () => {
      try {
        const result = await commodityService.getAllCommodities();
        if (!isMounted) return;
        
        if (result.success && result.commodities && result.commodities.length > 0) {
          const commodities = result.commodities || [];
          
          // Ürün adlarını ve kodlarını birlikte kullanarak benzersiz liste oluştur
          const uniqueCommodities = [];
          const seenNames = new Set();
          
          // Performans için for...of kullan
          for (const commodity of commodities) {
            const productName = commodity['Product name'];
            const productCode = commodity['Commodity code'];
            
            if (productName && !seenNames.has(productName)) {
              seenNames.add(productName);
              uniqueCommodities.push({
                name: productName,
                code: productCode,
                displayText: `${productName} (${productCode})`
              });
            }
          }
          
          if (isMounted) {
            setCommodityList(uniqueCommodities.map(item => item.displayText));
          }
        } else {
          if (isMounted) {
            setCommodityList([]);
          }
        }
      } catch (error) {
        if (isMounted) {
          setCommodityList([]);
        }
      }
    };

    loadCommodities();
    
    return () => {
      isMounted = false;
    };
  }, []);

  // Commodity listesini memoize et - Optimized with search
  const memoizedCommodityList = useMemo(() => {
    if (!commodityList || commodityList.length === 0) return [];
    
    let filteredList = commodityList;
    
    // Arama filtresi uygula
    if (commoditySearch.trim()) {
      filteredList = commodityList.filter(item => 
        item.toLowerCase().includes(commoditySearch.toLowerCase())
      );
    }
    
    // Sadece ilk 50 ürünü göster (performans için)
    return filteredList.slice(0, 50);
  }, [commodityList, commoditySearch]);

  // userData yüklenene kadar bekle
  if (authLoading || !userData) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
          <CircularProgress size={60} />
          <Typography variant="h6" sx={{ ml: 2 }}>
            Kullanıcı bilgileri yükleniyor...
          </Typography>
        </Box>
      </Container>
    );
  }
  
  // State güncellemelerini güvenli hale getir
  const safeSetState = (setter, value) => {
    if (isMounted.current) {
      setter(value);
    }
  };

  // Form input değişikliklerini handle et
  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Checklist item'larını toggle et
  const toggleChecklistItem = (itemId) => {
    setEquipmentChecklist(prev => prev.map(item => 
      item.id === itemId 
        ? { 
          ...item, 
            completed: !item.completed,
            completedAt: !item.completed ? new Date().toISOString() : null
          }
        : item
    ));
  };



  // Fotoğraf ekle - Optimized
  const handlePhotoAdd = async (files, type) => {
    try {
      setLoading(true);
      
      // Dosya boyutu kontrolü (5MB limit)
      const maxSize = 5 * 1024 * 1024; // 5MB
      const oversizedFiles = Array.from(files).filter(file => file.size > maxSize);
      
      if (oversizedFiles.length > 0) {
        setError('Bazı dosyalar çok büyük. Maksimum dosya boyutu 5MB olmalıdır.');
        return;
      }
      
      // Dosyaları base64 olarak kaydet
      const uploadResult = await photoService.saveMultiplePhotoUrls(files, type);
      if (uploadResult.success) {
        const newPhotos = uploadResult.photos.map((base64, index) => ({
          id: Date.now() + index,
          url: base64,
          preview: base64, // Base64 direkt preview olarak kullanılabilir
          name: files[index]?.name || `photo_${index}`,
          file: files[index] // Orijinal dosyayı sakla
        }));
        
        switch (type) {
          case 'before': setBeforePhotos(prev => [...prev, ...newPhotos]); break;
          case 'after': setAfterPhotos(prev => [...prev, ...newPhotos]); break;
          case 'issue': setIssuePhotos(prev => [...prev, ...newPhotos]); break;
          default: break;
        }
        
        setSuccess(`${type === 'before' ? 'Öncesi' : type === 'after' ? 'Sonrası' : 'Sorun'} fotoğrafları başarıyla yüklendi!`);
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(`Fotoğraf yüklenemedi: ${uploadResult.errors?.join(', ')}`);
      }
    } catch (error) {
      setError('Fotoğraf yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  // Fotoğraf sil
  const handlePhotoDelete = async (photoId, type) => {
    try {
      let photoToDelete;
      switch (type) {
        case 'before': photoToDelete = beforePhotos.find(p => p.id === photoId); break;
        case 'after': photoToDelete = afterPhotos.find(p => p.id === photoId); break;
        case 'issue': photoToDelete = issuePhotos.find(p => p.id === photoId); break;
        default: break;
      }
      
      if (photoToDelete) {
        // Base64 veritabanından kaldırma işlemi
        await photoService.deletePhotoUrl(photoToDelete.url);
      }
      
      // Update state after successful deletion
      switch (type) {
        case 'before': setBeforePhotos(prev => prev.filter(p => p.id !== photoId)); break;
        case 'after': setAfterPhotos(prev => prev.filter(p => p.id !== photoId)); break;
        case 'issue': setIssuePhotos(prev => prev.filter(p => p.id !== photoId)); break;
        default: break;
      }
      
      setSuccess('Fotoğraf başarıyla silindi!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      setError('Fotoğraf silinirken hata oluştu');
    }
  };

  // Rapor başlığı oluştur
  const generateReportTitle = () => {
      const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
    const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, ''); // HHMMSS
    
    return `${cleanLocation(formData.location)}-${formData.machineSerialNumber}-${dateStr}${timeStr}`;
  };

  // Rapor gönder
  const handleSubmit = async (e) => {
    e.preventDefault();
    


    // userData kontrolü
    if (!userData || !userData.uid) {
      safeSetState(setError, 'Kullanıcı bilgileri yüklenemedi. Lütfen tekrar giriş yapın.');
      return;
    }

    if (!formData.location.trim() || !formData.machineSerialNumber.trim()) {
      safeSetState(setError, 'Lütfen lokasyon ve makine seri numarası alanlarını doldurun');
      return;
    }

    // Makine seri numarası formatını kontrol et (10 haneli sayı)
    const serialNumberRegex = /^\d{10}$/;
    if (!serialNumberRegex.test(formData.machineSerialNumber.trim())) {
      safeSetState(setError, 'Makine seri numarası 10 haneli sayı olmalıdır (Örn: 2403290003)');
      return;
    }

    // Fotoğraf zorunluluğu kontrolü
    if (beforePhotos.length === 0) {
      safeSetState(setError, 'En az bir "Öncesi" fotoğraf eklemek zorunludur!');
      return;
    }

    if (afterPhotos.length === 0) {
      safeSetState(setError, 'En az bir "Sonrası" fotoğraf eklemek zorunludur!');
      return;
    }

    // Arıza açıklaması kontrolü
    if (hasIssue && !issueDescription.trim()) {
      safeSetState(setError, 'Arıza seçildi ama açıklama yazılmadı!');
      return;
    }

    // Zayi kontrolü
    if (hasWaste && wasteItems.length === 0) {
      safeSetState(setError, 'Zayi seçildi ama hiç ürün eklenmedi!');
      return;
    }

    // Zayi ürünlerinde boş alan kontrolü
    if (hasWaste) {
      for (const item of wasteItems) {
        if (!item.productName.trim() || !item.quantity.trim()) {
          safeSetState(setError, 'Zayi ürünlerinde ürün adı ve miktar alanları doldurulmalıdır!');
          return;
        }
      }
    }


    safeSetState(setLoading, true);
    safeSetState(setError, '');
    safeSetState(setSuccess, '');

    try {
      // Fotoğrafları rapor verisine ekle
      const photoUploads = [];
      
      for (const photo of beforePhotos) {
        photoUploads.push({ type: 'before', url: photo.url });
      }

      for (const photo of afterPhotos) {
        photoUploads.push({ type: 'after', url: photo.url });
      }

      for (const photo of issuePhotos) {
        photoUploads.push({ type: 'issue', url: photo.url });
      }

      const reportData = {
        location: cleanLocation(formData.location),
        machineSerialNumber: formData.machineSerialNumber.trim(),
        notes: formData.notes.trim(),
        // Arıza bilgileri
        hasIssue: hasIssue,
        issueDescription: hasIssue ? issueDescription.trim() : '',
        issueResolved: false, // Formdan kaldırıldığı için her zaman false
        issueResolvedDate: '', // Formdan kaldırıldığı için boş
        issueDate: hasIssue ? new Date().toISOString() : '',
        // Zayi bilgileri
        hasWaste: hasWaste,
        wasteItems: hasWaste ? wasteItems : [],
        wasteDate: hasWaste ? new Date().toISOString() : '',
        equipmentChecklist: equipmentChecklist.map(item => ({
          id: item.id, 
          text: item.text, 
          completed: item.completed, 
          completedAt: item.completedAt
        })),
        slots: slots.filter(slot => slot.commodity || slot.quantity || slot.expiryDate || slot.batchNumber).map(slot => ({
          ...slot,
          commodity: slot.commodity ? slot.commodity.split(' (')[0] : '' // Sadece ürün adını al
        })),
        beforePhotos: photoUploads.filter(p => p.type === 'before').map(p => p.url),
        afterPhotos: photoUploads.filter(p => p.type === 'after').map(p => p.url),
        issuePhotos: photoUploads.filter(p => p.type === 'issue').map(p => p.url),
        status: hasIssue ? 'issue' : hasWaste ? 'waste' : 'completed',
        title: generateReportTitle(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        userId: userData.uid,
        userName: userData.name,
        reportType: 'fridge'
      };

      const result = await reportService.createReport(reportData);

      if (result.success) {
        safeSetState(setSuccess, "Rapor başarıyla oluşturuldu! Dashboard'a yönlendiriliyorsunuz...");
        
        // Countdown başlat
        let count = 3;
        safeSetState(setCountdown, count);
        
        const countdownInterval = setInterval(() => {
          count--;
          safeSetState(setCountdown, count);
          
          if (count <= 0) {
            clearInterval(countdownInterval);
            
            try {
              navigate('/', { replace: true });
            } catch (navError) {
              // Fallback: window.location ile yönlendir
              window.location.href = '/';
            }
          }
        }, 1000);
      } else {
        throw new Error(result.error || 'Rapor oluşturulamadı');
      }

    } catch (error) {
      safeSetState(setError, `Rapor gönderilemedi: ${error.message}`);
    } finally {
      safeSetState(setLoading, false);
    }
  };


  return (
    <ErrorBoundary>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom align="center" sx={{ fontWeight: 'bold', color: 'primary.main', mb: 4 }}>
          Yeni Taze Dolap Dolum Raporu
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

        {success && (
          <Alert severity="success" sx={{ mb: 2 }}>
            {success} {countdown > 0 && `(${countdown} saniye sonra yönlendirileceksiniz)`}
          </Alert>
        )}

        <Paper elevation={3} sx={{ p: 4 }}>
          <Box component="form" onSubmit={handleSubmit}>
            {/* Temel Bilgiler */}
            <Typography variant="h6" gutterBottom sx={{ mt: 2, mb: 3, fontWeight: 'bold', color: 'primary.main' }}>
          Temel Bilgiler
        </Typography>
            
            <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Lokasyon"
              value={formData.location}
              onChange={(e) => handleInputChange('location', e.target.value)}
              required
                  placeholder="Örn: İstanbul, Kadıköy"
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Makine Seri Numarası"
              value={formData.machineSerialNumber}
              onChange={(e) => handleInputChange('machineSerialNumber', e.target.value)}
              required
                  placeholder="Örn: 2403290003"
            />
          </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  label="Notlar"
                  value={formData.notes}
                  onChange={(e) => handleInputChange('notes', e.target.value)}
                  placeholder="Ek notlar, özel durumlar..."
                />
        </Grid>
        
        {/* Arıza Sistemi */}
        <Grid item xs={12}>
          <Paper variant="outlined" sx={{ p: 2, borderColor: hasIssue ? 'error.main' : 'divider' }}>
            <Typography variant="h6" gutterBottom color={hasIssue ? 'error' : 'primary'}>
              ⚠️ Arıza Bildirimi
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={hasIssue}
                      onChange={(e) => setHasIssue(e.target.checked)}
                      color="error"
                    />
                  }
                  label="Arıza var"
                />
              </Grid>
              {hasIssue && (
                <>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      multiline
                      rows={3}
                      label="Arıza Açıklaması"
                      value={issueDescription}
                      onChange={(e) => setIssueDescription(e.target.value)}
                      placeholder="Arızanın detaylı açıklamasını yazın..."
                      required
                    />
                  </Grid>

                </>
              )}
            </Grid>
          </Paper>
        </Grid>
        
        {/* Zayi Sistemi */}
        <Grid item xs={12}>
          <Paper variant="outlined" sx={{ p: 2, borderColor: hasWaste ? 'warning.main' : 'divider' }}>
            <Typography variant="h6" gutterBottom color={hasWaste ? 'warning' : 'primary'}>
              📊 Zayi Bildirimi
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={hasWaste}
                      onChange={(e) => setHasWaste(e.target.checked)}
                      color="warning"
                    />
                  }
                  label="Zayi var"
                />
              </Grid>
              {hasWaste && (
                <>
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" gutterBottom>
                      Zayi Ürünleri Ekle
                    </Typography>
                    <Grid container spacing={2} alignItems="center">
                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          label="Zayi Sebebi"
                          value={wasteReason}
                          onChange={(e) => setWasteReason(e.target.value)}
                          placeholder="Örn: Son kullanma tarihi geçmiş, hasarlı paket..."
                          helperText="Bu sebep tüm zayi ürünleri için geçerli olacak"
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Button
                          variant="contained"
                          onClick={addWasteItem}
                          disabled={!wasteReason.trim()}
                          startIcon={<Add />}
                        >
                          Zayi Ürün Ekle
                        </Button>
                      </Grid>
                    </Grid>
                  </Grid>
                  
                  {wasteItems.length > 0 && (
                    <Grid item xs={12}>
                      <Typography variant="subtitle2" gutterBottom>
                        Zayi Ürün Listesi ({wasteItems.length})
                      </Typography>
                      {wasteItems.map((item, index) => (
                        <Paper key={item.id} variant="outlined" sx={{ p: 2, mb: 2 }}>
                          <Grid container spacing={2} alignItems="center">
                            <Grid item xs={12} sm={4}>
                              <FormControl fullWidth>
                                <InputLabel>Ürün Seç</InputLabel>
                                <Select
                                  value={item.productName}
                                  label="Ürün Seç"
                                  onChange={(e) => {
                                    const selectedProduct = e.target.value;
                                    const productCode = commodityList.find(commodity => 
                                      commodity.includes(selectedProduct)
                                    )?.match(/\(([^)]+)\)/)?.[1] || '';
                                    updateWasteItem(item.id, 'productName', selectedProduct);
                                    updateWasteItem(item.id, 'productCode', productCode);
                                  }}
                                >
                                  {memoizedCommodityList.map((commodity, index) => (
                                    <MenuItem key={index} value={commodity.split(' (')[0]}>
                                      {commodity}
                                    </MenuItem>
                                  ))}
                                </Select>
                              </FormControl>
                            </Grid>
                            <Grid item xs={12} sm={3}>
                              <TextField
                                fullWidth
                                label="Miktar"
                                type="number"
                                value={item.quantity}
                                onChange={(e) => updateWasteItem(item.id, 'quantity', e.target.value)}
                                placeholder="0"
                              />
                            </Grid>
                            <Grid item xs={12} sm={3}>
                              <FormControl fullWidth>
                                <InputLabel>Birim</InputLabel>
                                <Select
                                  value={item.unit}
                                  label="Birim"
                                  onChange={(e) => updateWasteItem(item.id, 'unit', e.target.value)}
                                >
                                  <MenuItem value="adet">Adet</MenuItem>
                                  <MenuItem value="gram">Gram</MenuItem>
                                  <MenuItem value="kg">KG</MenuItem>
                                  <MenuItem value="litre">Litre</MenuItem>
                                </Select>
                              </FormControl>
                            </Grid>
                            <Grid item xs={12} sm={2}>
                              <IconButton
                                color="error"
                                onClick={() => removeWasteItem(item.id)}
                                title="Sil"
                              >
                                <Delete />
                              </IconButton>
                            </Grid>
                          </Grid>
                          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                            <strong>Sebep:</strong> {item.reason}
                            {item.productCode && (
                              <span> • <strong>Kod:</strong> {item.productCode}</span>
                            )}
                          </Typography>
                        </Paper>
                      ))}
                    </Grid>
                  )}
                </>
              )}
            </Grid>
          </Paper>
        </Grid>
            </Grid>

            {/* Ekipman Kontrol Listesi */}
            <Typography variant="h6" gutterBottom sx={{ mt: 4, mb: 3, fontWeight: 'bold', color: 'primary.main' }}>
              Ekipman Kontrol Listesi
        </Typography>
            
            <Grid container spacing={2} sx={{ mb: 3 }}>
              {equipmentChecklist.map((item) => (
                <Grid item xs={12} md={6} key={item.id}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={item.completed}
                        onChange={() => toggleChecklistItem(item.id)}
                        color="primary"
                      />
                    }
                    label={item.text}
                  />
                </Grid>
              ))}
            </Grid>

            {/* Manuel Slot Ekleme Sistemi */}
            <Typography variant="h6" gutterBottom sx={{ mt: 4, mb: 3, fontWeight: 'bold', color: 'primary.main' }}>
              Otomat İçeriği (Manuel Slot Ekleme)
            </Typography>
            
            {/* Slot Ekleme Kontrolü */}
            <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
              <Typography variant="subtitle1" gutterBottom>
                Yeni Slot Ekle
              </Typography>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    label="Slot Numarası (1-58)"
                    type="number"
                    value={newSlotNumber}
                    onChange={(e) => setNewSlotNumber(e.target.value)}
                    inputProps={{ min: 1, max: 58 }}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Button
                    variant="contained"
                    onClick={addSlot}
                    disabled={!newSlotNumber.trim()}
                    startIcon={<Add />}
                  >
                    Slot Ekle
                  </Button>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Typography variant="body2" color="textSecondary">
                    Eklenen Slot: {slots.length} / 58
                  </Typography>
                </Grid>
              </Grid>
            </Paper>
            
            {/* Slot Listesi */}
            {slots.length === 0 ? (
              <Alert severity="info" sx={{ mb: 3 }}>
                Henüz slot eklenmemiş. Yukarıdan slot numarası girerek slot ekleyebilirsiniz.
              </Alert>
            ) : (
              <Grid container spacing={2} sx={{ mb: 3 }}>
                {slots.map((slot) => (
                  <Grid item xs={12} sm={6} md={4} key={slot.id}>
                    <Paper variant="outlined" sx={{ p: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                        <Typography variant="subtitle2">
                          Slot {slot.id}
                        </Typography>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => removeSlot(slot.id)}
                        >
                          <Delete />
                        </IconButton>
                      </Box>
                      <FormControl fullWidth sx={{ mb: 1 }}>
                        <InputLabel>Ürün</InputLabel>
                        <Select
                          value={slot.commodity || ''}
                          label="Ürün"
                          onChange={(e) => handleCommoditySelect(slot.id, e.target.value)}
                          MenuProps={{
                            PaperProps: {
                              style: {
                                maxHeight: 300
                              }
                            }
                          }}
                        >
                          {/* Arama alanı */}
                          <Box sx={{ p: 1 }}>
                            <TextField
                              size="small"
                              placeholder="Ürün ara..."
                              value={commoditySearch}
                              onChange={(e) => setCommoditySearch(e.target.value)}
                              fullWidth
                              sx={{ mb: 1 }}
                            />
                          </Box>
                          {memoizedCommodityList.map((commodity, index) => (
                            <MenuItem key={`commodity-${commodity}-${index}`} value={commodity}>
                              {commodity}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      <TextField
                        fullWidth
                        size="small"
                        label="Miktar"
                        type="number"
                        value={slot.quantity}
                        onChange={(e) => updateSlot(slot.id, 'quantity', e.target.value)}
                        sx={{ mb: 1 }}
                      />
                      <TextField
                        fullWidth
                        size="small"
                        label="Son Kullanma Tarihi"
                        type="date"
                        value={slot.expiryDate}
                        onChange={(e) => updateSlot(slot.id, 'expiryDate', e.target.value)}
                        InputLabelProps={{
                          shrink: true,
                        }}
                        sx={{ mb: 1 }}
                      />
                      <TextField
                        fullWidth
                        size="small"
                        label="Parti Numarası"
                        value={slot.batchNumber}
                        onChange={(e) => updateSlot(slot.id, 'batchNumber', e.target.value)}
                      />
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            )}

            {/* Fotoğraflar */}
            <Typography variant="h6" gutterBottom sx={{ mt: 4, mb: 3, fontWeight: 'bold', color: 'primary.main' }}>
              Fotoğraflar <span style={{ color: 'red', fontSize: '0.8em' }}>* Zorunlu</span>
            </Typography>
            
            <Grid container spacing={3} sx={{ mb: 3 }}>
              {/* Before Photos */}
              <Grid item xs={12} md={4}>
                <Typography variant="subtitle1" gutterBottom>
                  Öncesi Fotoğraflar <span style={{ color: 'red' }}>*</span>
                </Typography>
                <input
                  accept="image/*"
                  style={{ display: 'none' }}
                  id="before-photos"
                  multiple
                  type="file"
                  onChange={(e) => handlePhotoAdd(e.target.files, 'before')}
                />
                <label htmlFor="before-photos">
        <Button
          variant="outlined"
                    component="span"
                    startIcon={<PhotoCamera />}
                    fullWidth
        >
                    Fotoğraf Ekle
        </Button>
                </label>
                {beforePhotos.length === 0 && (
                  <Alert severity="warning" sx={{ mt: 1, fontSize: '0.8em' }}>
                    En az bir fotoğraf eklemek zorunludur
                  </Alert>
                )}
                {beforePhotos.map((photo) => (
                  <Box key={photo.id} sx={{ mt: 2, position: 'relative' }}>
                    <img
                      src={photo.preview}
                      alt="Before"
                      style={{ width: '100%', height: 150, objectFit: 'cover' }}
                    />
                    <IconButton
                      size="small"
                      sx={{ position: 'absolute', top: 5, right: 5 }}
                      onClick={() => handlePhotoDelete(photo.id, 'before')}
                    >
                      <Delete />
                    </IconButton>
                  </Box>
                ))}
              </Grid>

              {/* After Photos */}
              <Grid item xs={12} md={4}>
                <Typography variant="subtitle1" gutterBottom>
                  Sonrası Fotoğraflar <span style={{ color: 'red' }}>*</span>
                </Typography>
                <input
                  accept="image/*"
                  style={{ display: 'none' }}
                  id="after-photos"
                  multiple
                  type="file"
                  onChange={(e) => handlePhotoAdd(e.target.files, 'after')}
                />
                <label htmlFor="after-photos">
          <Button
            variant="outlined"
                    component="span"
                    startIcon={<PhotoCamera />}
                    fullWidth
                  >
                    Fotoğraf Ekle
          </Button>
                </label>
                {afterPhotos.length === 0 && (
                  <Alert severity="warning" sx={{ mt: 1, fontSize: '0.8em' }}>
                    En az bir fotoğraf eklemek zorunludur
                  </Alert>
                )}
                {afterPhotos.map((photo) => (
                  <Box key={photo.id} sx={{ mt: 2, position: 'relative' }}>
                    <img
                      src={photo.preview}
                      alt="After"
                      style={{ width: '100%', height: 150, objectFit: 'cover' }}
                    />
                    <IconButton
                      size="small"
                      sx={{ position: 'absolute', top: 5, right: 5 }}
                      onClick={() => handlePhotoDelete(photo.id, 'after')}
                    >
                      <Delete />
                    </IconButton>
                  </Box>
                ))}
              </Grid>

              {/* Issue Photos */}
              <Grid item xs={12} md={4}>
                <Typography variant="subtitle1" gutterBottom>
                  Arıza Fotoğrafları <span style={{ color: 'gray', fontSize: '0.8em' }}>(Opsiyonel)</span>
                </Typography>
                <input
                  accept="image/*"
                  style={{ display: 'none' }}
                  id="issue-photos"
                  multiple
                  type="file"
                  onChange={(e) => handlePhotoAdd(e.target.files, 'issue')}
                />
                <label htmlFor="issue-photos">
          <Button
            variant="outlined"
                    component="span"
                    startIcon={<PhotoCamera />}
                    fullWidth
                  >
                    Fotoğraf Ekle
          </Button>
                </label>
                {issuePhotos.map((photo) => (
                  <Box key={photo.id} sx={{ mt: 2, position: 'relative' }}>
                    <img
                      src={photo.preview}
                      alt="Issue"
                      style={{ width: '100%', height: 150, objectFit: 'cover' }}
                    />
                    <IconButton
                      size="small"
                      sx={{ position: 'absolute', top: 5, right: 5 }}
                      onClick={() => handlePhotoDelete(photo.id, 'issue')}
                    >
                      <Delete />
                    </IconButton>
                  </Box>
                ))}
              </Grid>
            </Grid>

            {/* Submit Button */}
            <Box sx={{ mt: 4, textAlign: 'center' }}>
              <Button
                type="submit"
                variant="contained"
                size="large"
                disabled={loading}
                startIcon={loading ? <CircularProgress size={20} /> : <CloudUpload />}
                sx={{ minWidth: 200 }}
              >
                {loading ? 'Gönderiliyor...' : 'Raporu Gönder'}
              </Button>
            </Box>
          </Box>
          </Paper>
    </Container>
    </ErrorBoundary>
  );
};

export default NewFridgeReport;