import React, { useState, useEffect, useMemo } from 'react';
import { calculateOverallAQI, AQI_STANDARDS } from '../../utils/aqiCalc';
import { Wind, Info, HelpCircle } from 'lucide-react';
import StandardComparisonModal from '../../components/StandardComparisonModal';
const POLLUTANTS = [
  { id: 'PM25', name: 'PM2.5', unit: 'μg/m³' },
  { id: 'PM10', name: 'PM10', unit: 'μg/m³' },
  { id: 'SO2', name: 'SO2', unit: 'μg/m³' },
  { id: 'NO2', name: 'NO2', unit: 'μg/m³' },
  { id: 'O3', name: 'O3', unit: 'μg/m³' },
  { id: 'CO', name: 'CO', unit: 'mg/m³' }
];

export default function Calculator() {
  const [data, setData] = useState(() => {
    const saved = localStorage.getItem('atmokit_calc_data');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return { PM25: '', PM10: '', SO2: '', NO2: '', O3: '', CO: '' };
  });
  const [selectedStandard, setSelectedStandard] = useState(() => {
    return localStorage.getItem('atmokit_calc_standard') || '2026-2030';
  });

  useEffect(() => {
    localStorage.setItem('atmokit_calc_data', JSON.stringify(data));
  }, [data]);

  useEffect(() => {
    localStorage.setItem('atmokit_calc_standard', selectedStandard);
  }, [selectedStandard]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [result, setResult] = useState(null);

  useEffect(() => {
    // Only calculate if at least one value is present and valid
    const numericData = {};
    let hasData = false;
    for (const [key, value] of Object.entries(data)) {
      if (value !== '' && !isNaN(value)) {
        numericData[key] = parseFloat(value);
        hasData = true;
      }
    }

    if (hasData) {
      setResult(calculateOverallAQI(numericData, selectedStandard));
    } else {
      setResult(null);
    }
  }, [data, selectedStandard]);

  const handleChange = (e) => {
    setData({
      ...data,
      [e.target.name]: e.target.value
    });
  };

  return (
    <div style={{ padding: '24px 0' }}>
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Wind color="var(--accent)" />
          空气质量计算器
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
            根据不同时期的限值规定计算空气质量指数，本次计算以日为单位
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              评价标准:
              <button
                onClick={() => setIsModalOpen(true)}
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--accent)', display: 'flex' }}
                title="查看历版标准对比"
              >
                <HelpCircle size={16} />
              </button>
            </label>
            <select
              value={selectedStandard}
              onChange={(e) => setSelectedStandard(e.target.value)}
              className="input-field"
              style={{ width: '280px', padding: '8px 12px' }}
            >
              {AQI_STANDARDS.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3">
        {/* Input Form */}
        <div className="glass-panel" style={{ gridColumn: 'span 2' }}>
          <h3 style={{ marginTop: 0, marginBottom: '24px' }}>污染物浓度输入</h3>
          <div className="grid grid-cols-2">
            {POLLUTANTS.map(p => (
              <div key={p.id} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                  {p.name} ({p.unit})
                </label>
                <input
                  type="number"
                  name={p.id}
                  value={data[p.id]}
                  onChange={handleChange}
                  className="input-field"
                  placeholder={`输入 ${p.name}`}
                  min="0"
                />
                <div style={{ fontSize: '0.8rem', color: 'var(--accent)' }}>
                  {result && result.iaqis[p.id] !== undefined ? `IAQI: ${result.iaqis[p.id]}` : 'IAQI: -'}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Results Panel */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
          <h3 style={{ marginTop: 0, marginBottom: '24px', width: '100%', textAlign: 'left' }}>计算结果</h3>

          {result && result.aqi !== null ? (
            <>
              <div
                style={{
                  width: '180px',
                  height: '180px',
                  borderRadius: '50%',
                  backgroundColor: result.category.color,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: result.aqi > 150 ? 'white' : 'black',
                  boxShadow: `0 0 30px ${result.category.color}40`,
                  marginBottom: '24px'
                }}
              >
                <div style={{ fontSize: '1.2rem', fontWeight: 600 }}>AQI</div>
                <div style={{ fontSize: '3.5rem', fontWeight: 800, lineHeight: 1 }}>{result.aqi}</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 600, marginTop: '4px' }}>{result.category.label} (级别 {result.category.level})</div>
              </div>

              {result.primaryPollutants.length > 0 && (
                <div style={{ background: 'var(--bg-tertiary)', padding: '12px 24px', borderRadius: '8px', width: '100%' }}>
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>首要污染物</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--accent)' }}>
                    {result.primaryPollutants.join(', ')}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div style={{ color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
              <Info size={48} opacity={0.5} />
              <p>请输入至少一项污染物浓度</p>
            </div>
          )}
        </div>

      </div>

      <StandardComparisonModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}
