import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { Wind, BarChart2, Clock } from 'lucide-react';

export default function Layout() {
  const location = useLocation();

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header className="glass-panel" style={{ borderRadius: 0, borderBottom: '1px solid var(--border)', padding: '16px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Wind size={28} color="var(--accent)" />
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 'bold' }}>AtmoKit 空气质量工具集</h1>
        </div>
        <nav style={{ display: 'flex', gap: '8px' }}>
          <Link 
            to="/" 
            style={{ 
              color: location.pathname === '/' ? 'var(--accent)' : 'var(--text-secondary)',
              backgroundColor: location.pathname === '/' ? 'rgba(37, 99, 235, 0.1)' : 'transparent',
              padding: '8px 16px',
              borderRadius: '8px',
              textDecoration: 'none', 
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s ease'
            }}
          >
            <Wind size={20} />
            AQI 计算器
          </Link>
          <Link 
            to="/evaluation" 
            style={{ 
              color: location.pathname === '/evaluation' ? 'var(--accent)' : 'var(--text-secondary)', 
              backgroundColor: location.pathname === '/evaluation' ? 'rgba(37, 99, 235, 0.1)' : 'transparent',
              padding: '8px 16px',
              borderRadius: '8px',
              textDecoration: 'none', 
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s ease'
            }}
          >
            <BarChart2 size={20} />
            综合评价
          </Link>
          <Link 
            to="/tracking" 
            style={{ 
              color: location.pathname === '/tracking' ? 'var(--accent)' : 'var(--text-secondary)', 
              backgroundColor: location.pathname === '/tracking' ? 'rgba(37, 99, 235, 0.1)' : 'transparent',
              padding: '8px 16px',
              borderRadius: '8px',
              textDecoration: 'none', 
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s ease'
            }}
          >
            <Clock size={20} />
            实时余量研判
          </Link>
        </nav>
      </header>

      <main className="container" style={{ flex: 1, width: '100%' }}>
        <Outlet />
      </main>
      
      <footer style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
        &copy; {new Date().getFullYear()} AtmoKit Environment Data Validation Tools. All rights reserved.
      </footer>
    </div>
  );
}
