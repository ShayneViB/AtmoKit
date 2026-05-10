import { X } from 'lucide-react';

export default function StandardComparisonModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      backdropFilter: 'blur(4px)'
    }} onClick={onClose}>
      <div 
        className="glass-panel" 
        style={{ maxWidth: '800px', width: '90%', position: 'relative' }}
        onClick={e => e.stopPropagation()}
      >
        <button 
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: 'none',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          title="关闭"
        >
          <X size={24} />
        </button>
        <h3 style={{ marginTop: 0, marginBottom: '24px' }}>历版标准二级限值 (IAQI=100) 对比</h3>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>执行阶段</th>
                <th>PM2.5 (24h)</th>
                <th>PM10 (24h)</th>
                <th>SO2 (24h)</th>
                <th>NO2 (24h)</th>
                <th>O3 (8h)</th>
                <th>CO (24h)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ color: 'var(--text-secondary)' }}>2013-2025 (旧标)</td>
                <td style={{ color: 'var(--color-red)' }}>75</td>
                <td style={{ color: 'var(--color-red)' }}>150</td>
                <td style={{ color: 'var(--text-secondary)' }}>150</td>
                <td style={{ color: 'var(--color-red)' }}>80</td>
                <td style={{ color: 'var(--text-secondary)' }}>160</td>
                <td style={{ color: 'var(--text-secondary)' }}>4</td>
              </tr>
              <tr>
                <td style={{ color: 'var(--text-secondary)' }}>2026-2030 (过渡)</td>
                <td style={{ color: 'var(--color-orange)' }}>60</td>
                <td style={{ color: 'var(--color-orange)' }}>120</td>
                <td style={{ color: 'var(--text-secondary)' }}>150</td>
                <td style={{ color: 'var(--color-red)' }}>80</td>
                <td style={{ color: 'var(--text-secondary)' }}>160</td>
                <td style={{ color: 'var(--text-secondary)' }}>4</td>
              </tr>
              <tr>
                <td style={{ color: 'var(--text-secondary)' }}>2031及以后 (最终)</td>
                <td style={{ color: 'var(--color-green)', fontWeight: 'bold' }}>50</td>
                <td style={{ color: 'var(--color-green)', fontWeight: 'bold' }}>100</td>
                <td style={{ color: 'var(--color-green)', fontWeight: 'bold' }}>50</td>
                <td style={{ color: 'var(--color-green)', fontWeight: 'bold' }}>50</td>
                <td style={{ color: 'var(--text-secondary)' }}>160</td>
                <td style={{ color: 'var(--text-secondary)' }}>4</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
