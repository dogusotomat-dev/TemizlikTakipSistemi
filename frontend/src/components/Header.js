import React from 'react';
import { AppBar, Toolbar, Typography, Button, Box, Avatar, Menu, MenuItem } from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import { Assignment, Dashboard, AdminPanelSettings, Person, Logout, Kitchen } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';

const Header = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { userData, logout } = useAuth();
  const [anchorEl, setAnchorEl] = React.useState(null);

  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = async () => {
    try {
      await logout(); // AuthContext'teki logout fonksiyonunu kullan
      navigate('/login');
    } catch (error) {
      // Hata sessizce handle edildi
    }
    handleMenuClose();
  };

  const handleNavigate = (path) => {
    navigate(path);
    handleMenuClose();
  };

  if (!userData) return null; // Hide header if not logged in

  return (
    <AppBar position="static">
      <Toolbar>
        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
          Doğuş Otomat Temizlik ve Dolum Takip Sistemi
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          {userData.role === 'admin' && (
            <>
              <Button
                color="inherit"
                startIcon={<AdminPanelSettings />}
                onClick={() => navigate('/admin')}
                sx={{ 
                  backgroundColor: location.pathname === '/admin' ? 'rgba(255,255,255,0.1)' : 'transparent' 
                }}
              >
                Admin Paneli
              </Button>
            </>
          )}
          
          {(userData.role === 'routeman' || userData.role === 'operator' || userData.role === 'dealer' || userData.role === 'viewer') && (
            <>
              <Button
                color="inherit"
                startIcon={<Dashboard />}
                onClick={() => navigate('/')}
                sx={{ 
                  backgroundColor: location.pathname === '/' ? 'rgba(255,255,255,0.1)' : 'transparent' 
                }}
              >
                Ana Sayfa
              </Button>
            </>
          )}
          
          {(userData.role === 'routeman' || userData.role === 'operator') && (
            <>
              {/* Operasyon sorumlusu tüm formları görebilir */}
              {userData.role === 'routeman' && (
                <>
                  <Button
                    color="inherit"
                    startIcon={<Assignment />}
                    onClick={() => navigate('/new-report')}
                    sx={{ 
                      backgroundColor: location.pathname === '/new-report' ? 'rgba(255,255,255,0.1)' : 'transparent' 
                    }}
                  >
                    Dondurma Temizlik
                  </Button>
                  <Button
                    color="inherit"
                    startIcon={<Kitchen />}
                    onClick={() => navigate('/new-fridge-report')}
                    sx={{ 
                      backgroundColor: location.pathname === '/new-fridge-report' ? 'rgba(255,255,255,0.1)' : 'transparent' 
                    }}
                  >
                    Taze Dolap Dolum
                  </Button>
                </>
              )}
              
              {/* Operasyon yetkilisi sadece yetkili olduğu formları görebilir */}
              {userData.role === 'operator' && (
                <>
                  {userData.permissions?.iceCream && (
                    <Button
                      color="inherit"
                      startIcon={<Assignment />}
                      onClick={() => navigate('/new-report')}
                      sx={{ 
                        backgroundColor: location.pathname === '/new-report' ? 'rgba(255,255,255,0.1)' : 'transparent' 
                      }}
                    >
                      Dondurma Temizlik
                    </Button>
                  )}
                  {userData.permissions?.fridge && (
                    <Button
                      color="inherit"
                      startIcon={<Kitchen />}
                      onClick={() => navigate('/new-fridge-report')}
                      sx={{ 
                        backgroundColor: location.pathname === '/new-fridge-report' ? 'rgba(255,255,255,0.1)' : 'transparent' 
                      }}
                    >
                      Taze Dolap Dolum
                    </Button>
                  )}
                </>
              )}
            </>
          )}
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" color="inherit">
              {userData.name} ({userData.role === 'admin' ? 'Admin' : 
                               userData.role === 'routeman' ? 'Operasyon Sorumlusu' : 
                               userData.role === 'operator' ? 'Operasyon Yetkilisi' :
                               userData.role === 'dealer' ? 'Bayi' : 'İzleyici'})
            </Typography>
            <Avatar 
              sx={{ width: 32, height: 32, cursor: 'pointer' }} 
              onClick={handleMenuOpen}
            >
              <Person />
            </Avatar>
          </Box>
        </Box>
        
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleMenuClose}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'right',
          }}
          transformOrigin={{
            vertical: 'top',
            horizontal: 'right',
          }}
        >
          {userData.role === 'admin' && (
            <MenuItem onClick={() => handleNavigate('/admin')}>
              <AdminPanelSettings sx={{ mr: 1 }} />
              Admin Paneli
            </MenuItem>
          )}
          {(userData.role === 'routeman' || userData.role === 'operator') && (
            <>
              {/* Operasyon sorumlusu tüm formları görebilir */}
              {userData.role === 'routeman' && (
                <>
                  <MenuItem onClick={() => handleNavigate('/new-report')}>
                    <Assignment sx={{ mr: 1 }} />
                    Dondurma Temizlik
                  </MenuItem>
                  <MenuItem onClick={() => handleNavigate('/new-fridge-report')}>
                    <Kitchen sx={{ mr: 1 }} />
                    Taze Dolap Dolum
                  </MenuItem>
                </>
              )}
              
              {/* Operasyon yetkilisi sadece yetkili olduğu formları görebilir */}
              {userData.role === 'operator' && (
                <>
                  {userData.permissions?.iceCream && (
                    <MenuItem onClick={() => handleNavigate('/new-report')}>
                      <Assignment sx={{ mr: 1 }} />
                      Dondurma Temizlik
                    </MenuItem>
                  )}
                  {userData.permissions?.fridge && (
                    <MenuItem onClick={() => handleNavigate('/new-fridge-report')}>
                      <Kitchen sx={{ mr: 1 }} />
                      Taze Dolap Dolum
                    </MenuItem>
                  )}
                </>
              )}
            </>
          )}
          <MenuItem onClick={handleLogout}>
            <Logout sx={{ mr: 1 }} />
            Çıkış Yap
          </MenuItem>
        </Menu>
      </Toolbar>
    </AppBar>
  );
};

export default Header;
