import React, { useState, useMemo, useEffect, useRef } from 'react';
import { parseFile } from '../../utils/fileParser';
import { calculateIAQI, getAqiCategory, AQI_STANDARDS } from '../../utils/aqiCalc';
import { Clock, Upload, FileText, Download } from 'lucide-react';
import { calculateAverage } from '../../utils/statistics';
import * as XLSX from 'xlsx';

const POLLUTANTS = [
  { id: 'O3', name: 'O3', key: 'O3(μg/m3)' },
  { id: 'PM25', name: 'PM2.5', key: 'PM2.5(μg/m3)' },
  { id: 'PM10', name: 'PM10', key: 'PM10(μg/m3)' },
  { id: 'SO2', name: 'SO2', key: 'SO2(μg/m3)' },
  { id: 'NO2', name: 'NO2', key: 'NO2(μg/m3)' },
  { id: 'CO', name: 'CO', key: 'CO(mg/m3)' }
];

export default function HourlyTracking() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedPollutant, setSelectedPollutant] = useState('O3');
  const [selectedStandard, setSelectedStandard] = useState('2026-2030');
  const tableRef = useRef(null);

  const exportToExcel = () => {
    if (!tableRef.current) return;
    const table = tableRef.current;
    const ws = XLSX.utils.table_to_sheet(table);

    // Apply background colors from inline styles
    const cells = table.querySelectorAll('td, th');
    cells.forEach(cell => {
      const bg = cell.style.backgroundColor;
      if (!bg || bg === 'transparent' || bg === '') return;
      // Find cell address
      const row = cell.parentElement;
      const tbody = row.parentElement;
      const allRows = table.querySelectorAll('tr');
      const rowIdx = Array.from(allRows).indexOf(row);
      const cellIdx = Array.from(row.querySelectorAll('td, th')).indexOf(cell);
      if (rowIdx < 0 || cellIdx < 0) return;
      const addr = XLSX.utils.encode_cell({ r: rowIdx, c: cellIdx });
      if (!ws[addr]) return;
      // Convert rgb(...) to hex
      const match = bg.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
      if (!match) return;
      const hex = ('0' + parseInt(match[1]).toString(16)).slice(-2)
                + ('0' + parseInt(match[2]).toString(16)).slice(-2)
                + ('0' + parseInt(match[3]).toString(16)).slice(-2);
      ws[addr].s = { fill: { fgColor: { rgb: hex.toUpperCase() } } };
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '实时余量研判');
    const pollutantName = POLLUTANTS.find(p => p.id === selectedPollutant)?.name || selectedPollutant;
    XLSX.writeFile(wb, `实时余量研判_${pollutantName}.xlsx`);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);
    try {
      const parsedData = await parseFile(file);
      setData(parsedData);
    } catch (err) {
      console.error(err);
      alert('解析失败，请检查文件格式。');
    }
    setLoading(false);
  };

  useEffect(() => {
    const loadDefaultData = async () => {
      try {
        setLoading(true);
        const res = await fetch('/templates/城市监测数据小时值_2026-04-26 01_00_2026-04-26 17_00_原始（实况）.xlsx');
        if (!res.ok) throw new Error("获取默认模板数据失败");
        const arrayBuffer = await res.arrayBuffer();
        const file = new File([arrayBuffer], "城市监测数据小时值.xlsx", {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        });
        const parsedData = await parseFile(file);
        setData(parsedData);
      } catch (err) {
        console.error("加载默认数据出错:", err);
      } finally {
        setLoading(false);
      }
    };

    loadDefaultData();
  }, []);

  const matrixData = useMemo(() => {
    if (data.length === 0) return null;

    // Group by City
    const citiesMap = {};
    const polKey = POLLUTANTS.find(p => p.id === selectedPollutant).key;

    let globalMin = Infinity;
    let globalMax = -Infinity;

    data.forEach(row => {
      if (!row['城市'] || !row['时间']) return;
      const city = row['城市'];
      if (!citiesMap[city]) {
        citiesMap[city] = new Array(24).fill(null);
      }

      try {
        const timeStr = row['时间'].toString(); // "2026-05-08 01:00"
        let hour = -1;
        if (timeStr.includes(':')) {
          hour = parseInt(timeStr.split(' ')[1].split(':')[0], 10);
        } else {
          // Fallback if Date object parsing needed
          hour = new Date(timeStr).getHours();
        }

        if (!isNaN(hour) && hour >= 0 && hour < 24) {
          const val = parseFloat(row[polKey]);
          citiesMap[city][hour] = val;
          if (!isNaN(val)) {
            if (val < globalMin) globalMin = val;
            if (val > globalMax) globalMax = val;
          }
        }
      } catch (e) {
        console.warn("Time parsing error", e);
      }
    });

    const citiesList = Object.keys(citiesMap);

    // Find target limit for "Good" (IAQI=100)
    const standardObj = AQI_STANDARDS.find(s => s.id === selectedStandard) || AQI_STANDARDS[1];
    const rules = standardObj.pollutants[selectedPollutant === 'PM25' ? 'PM25' : selectedPollutant];
    let targetLimit = 160;
    let targets = { 100: null, 150: null, 200: null, 300: null };
    if (rules) {
      [100, 150, 200, 300].forEach(iaqiVal => {
        const idx = rules.iaqi.indexOf(iaqiVal);
        if (idx !== -1) targets[iaqiVal] = rules.breakpoints[idx];
      });
      if (targets[100] !== null) targetLimit = targets[100];
    }

    // Process hourly stats per city
    const processedCities = citiesList.map(city => {
      const hourlyVals = citiesMap[city];
      const hours = [];
      let max8h = -1;

      for (let h = 0; h < 24; h++) {
        const val1h = hourlyVals[h] !== null && !isNaN(hourlyVals[h]) ? hourlyVals[h] : null;
        let val8h = null;

        if (h >= 7) {
          const window = hourlyVals.slice(h - 7, h + 1);
          const validVals = window.filter(v => v !== null && !isNaN(v));
          // Requirements: valid if all 8 hours exist, or at least 6. We'll use 6 as valid minimum.
          if (validVals.length >= 6) {
            val8h = validVals.reduce((a, b) => a + b, 0) / validVals.length;
            if (val8h > max8h) max8h = val8h;
          }
        }

        const iaqi1h = val1h !== null ? calculateIAQI(selectedPollutant, val1h, selectedStandard) : null;
        const iaqi8h = val8h !== null ? calculateIAQI(selectedPollutant, val8h, selectedStandard) : null;

        hours.push({
          hour: h,
          c1: val1h,
          iaqi1: iaqi1h,
          cat1: getAqiCategory(iaqi1h),
          c8: val8h,
          iaqi8: iaqi8h,
          cat8: getAqiCategory(iaqi8h)
        });
      }

      let margin = null;
      let margin100 = null, margin150 = null, margin200 = null, margin300 = null;
      let dailyAvg = null;

      let lastValidIdx = -1;
      for (let h = 23; h >= 0; h--) {
        if (hourlyVals[h] !== null && !isNaN(hourlyVals[h])) {
          lastValidIdx = h;
          break;
        }
      }

      if (lastValidIdx !== -1) {
        const values_arr = [];
        for (let i = 0; i <= lastValidIdx; i++) {
          values_arr.push(hourlyVals[i] !== null && !isNaN(hourlyVals[i]) ? hourlyVals[i] : 0);
        }

        let n = values_arr.length;
        if (selectedPollutant === 'O3') {
          if (n < 24) {
            let remaining_controls = [];
            for (let k = 1; k <= 8; k++) {
              if (n + k > 24) break;
              let m = 8 - k;
              let sum_m = 0;
              if (m > 0 && n > 0) {
                let start_idx = Math.max(0, n - m);
                for (let i = start_idx; i < n; i++) {
                  sum_m += values_arr[i];
                }
              }
              let C_k = Math.floor((targetLimit * 8 - sum_m) / k);
              remaining_controls.push(C_k);
            }
            if (remaining_controls.length > 0) {
              margin = Math.min(...remaining_controls);
            }
          }
        } else {
          const validValues = hourlyVals.filter(v => v !== null && !isNaN(v));
          let n_valid = validValues.length;
          let sum_all = validValues.reduce((a, b) => a + b, 0);

          if (n_valid > 0) {
            dailyAvg = sum_all / n_valid;
          }

          let k = 24 - n_valid;
          if (k > 0) {
            margin100 = targets[100] !== null ? (targets[100] * 24 - sum_all) / k : null;
            margin150 = targets[150] !== null ? (targets[150] * 24 - sum_all) / k : null;
            margin200 = targets[200] !== null ? (targets[200] * 24 - sum_all) / k : null;
            margin300 = targets[300] !== null ? (targets[300] * 24 - sum_all) / k : null;

            if (selectedPollutant !== 'CO') {
              if (margin100 !== null) margin100 = Math.floor(margin100);
              if (margin150 !== null) margin150 = Math.floor(margin150);
              if (margin200 !== null) margin200 = Math.floor(margin200);
              if (margin300 !== null) margin300 = Math.floor(margin300);
            }
          }
        }
      }

      // Calculate daily summary
      let finalIaqi = null;
      if (selectedPollutant === 'O3') {
        finalIaqi = max8h !== -1 ? calculateIAQI(selectedPollutant, max8h, selectedStandard) : null;
      } else {
        finalIaqi = dailyAvg !== null ? calculateIAQI(selectedPollutant, dailyAvg, selectedStandard) : null;
      }
      const finalCat = getAqiCategory(finalIaqi);

      return {
        name: city,
        hours,
        max8h: max8h !== -1 ? max8h : null,
        dailyAvg,
        finalIaqi,
        finalCat,
        margin,
        margin100, margin150, margin200, margin300
      };
    });

    if (globalMin === Infinity) globalMin = 0;
    if (globalMax === -Infinity) globalMax = 100;

    return {
      cities: processedCities,
      hoursList: Array.from({ length: 24 }, (_, i) => i + 1),
      globalMin,
      globalMax
    };
  }, [data, selectedPollutant, selectedStandard]);

  const getColorScale = (val, min, max) => {
    if (val === null || val === undefined || isNaN(val)) return 'transparent';
    if (min === max) return 'rgb(99, 190, 123)';

    const colorStart = [99, 190, 123];   // Green
    const colorMid = [255, 235, 132];    // Yellow
    const colorEnd = [248, 105, 107];    // Red

    const mid = (min + max) / 2;

    let r, g, b;
    if (val <= mid) {
      const ratio = (val - min) / (mid - min);
      r = Math.round(colorStart[0] + ratio * (colorMid[0] - colorStart[0]));
      g = Math.round(colorStart[1] + ratio * (colorMid[1] - colorStart[1]));
      b = Math.round(colorStart[2] + ratio * (colorMid[2] - colorStart[2]));
    } else {
      const ratio = (val - mid) / (max - mid);
      r = Math.round(colorMid[0] + ratio * (colorEnd[0] - colorMid[0]));
      g = Math.round(colorMid[1] + ratio * (colorEnd[1] - colorMid[1]));
      b = Math.round(colorMid[2] + ratio * (colorEnd[2] - colorMid[2]));
    }

    return `rgb(${r}, ${g}, ${b})`;
  };

  const renderCell = (value, globalMin, globalMax, isFloat) => {
    if (value === null || value === undefined || isNaN(value)) {
      return <td></td>;
    }
    const displayValue = isFloat ? value.toFixed(1) : Math.round(value);

    const bgColor = getColorScale(value, globalMin, globalMax);
    const color = 'black';

    return (
      <td style={{ backgroundColor: bgColor, color, textAlign: 'center', fontWeight: 'bold' }}>
        {displayValue}
      </td>
    );
  };

  return (
    <div style={{ padding: '24px 0' }}>
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Clock color="var(--accent)" />
          实时余量研判
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
            追踪各站点逐小时实况数据，支持全时段数据热力渲染和控制余量研判。
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>污染物:</label>
            <select
              value={selectedPollutant}
              onChange={(e) => setSelectedPollutant(e.target.value)}
              className="input-field"
              style={{ width: '120px', padding: '8px 12px' }}
            >
              {POLLUTANTS.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <label style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginLeft: '8px' }}>评价标准:</label>
            <select
              value={selectedStandard}
              onChange={(e) => setSelectedStandard(e.target.value)}
              className="input-field"
              style={{ width: '220px', padding: '8px 12px' }}
            >
              {AQI_STANDARDS.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="glass-panel" style={{ marginBottom: '24px' }}>
        <h3 style={{ marginTop: 0 }}>数据导入</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <label className="btn" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Upload size={18} />
            上传小时数据文件
            <input type="file" accept=".csv, .xlsx, .xls" onChange={handleFileUpload} style={{ display: 'none' }} />
          </label>
          <a href="/templates/城市监测数据小时值_2026-04-26 01_00_2026-04-26 17_00_原始（实况）.xlsx" download className="btn" style={{ background: 'transparent', color: 'var(--text-primary)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
            <FileText size={18} /> 下载模板
          </a>
          {matrixData && (
            <button className="btn" onClick={exportToExcel} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--color-green)', color: 'white', border: 'none' }}>
              <Download size={18} /> 导出 xlsx
            </button>
          )}
          {loading && <span style={{ color: 'var(--accent)' }}>解析中...</span>}
        </div>
      </div>

      {!matrixData && !loading && (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '64px 24px', color: 'var(--text-secondary)' }}>
          <Clock size={64} opacity={0.2} style={{ marginBottom: '16px', display: 'inline-block' }} />
          <h3 style={{ margin: '0 0 8px 0', color: 'var(--text-primary)' }}>暂无数据</h3>
          <p style={{ margin: 0 }}>请上传您的空气质量小时级别数据以生成追踪矩阵。</p>
        </div>
      )}

      {matrixData && (
        <div className="glass-panel tracking-table-container" style={{ padding: '0', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="tracking-table" ref={tableRef}>
              <thead>
                <tr>
                  <th style={{ minWidth: '80px', position: 'sticky', left: 0, zIndex: 10 }}>监测时间</th>
                  {matrixData.cities.map(city => (
                    <th key={city.name} style={{ textAlign: 'center' }}>{city.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrixData.hoursList.map(h => (
                  <tr key={h}>
                    <td style={{ position: 'sticky', left: 0, background: 'var(--bg-tertiary)', fontWeight: 'bold', zIndex: 5 }}>
                      {h}时
                    </td>
                    {matrixData.cities.map(city => {
                      const hourData = city.hours[h === 24 ? 0 : h];
                      return (
                        <React.Fragment key={`${city.name}-${h}`}>
                          {hourData ? renderCell(hourData.c1, matrixData.globalMin, matrixData.globalMax, false) : <td></td>}
                        </React.Fragment>
                      );
                    })}
                  </tr>
                ))}
                {/* Summary Rows */}
                {selectedPollutant === 'O3' ? (
                  <>
                    <tr style={{ borderTop: '2px solid var(--border)' }}>
                      <td style={{ position: 'sticky', left: 0, background: 'var(--bg-tertiary)', fontWeight: 'bold', zIndex: 5 }}>最大8小时滑动平均</td>
                      {matrixData.cities.map(city => (
                        <td key={`max-${city.name}`} style={{ textAlign: 'center', fontWeight: 'bold' }}>
                          {city.max8h !== null ? Math.round(city.max8h) : '-'}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td style={{ position: 'sticky', left: 0, background: 'var(--bg-tertiary)', fontWeight: 'bold', zIndex: 5 }}>AQI分指数</td>
                      {matrixData.cities.map(city => (
                        <td key={`iaqi-${city.name}`} style={{ textAlign: 'center', fontWeight: 'bold' }}>
                          {city.finalIaqi !== null ? city.finalIaqi : '-'}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td style={{ position: 'sticky', left: 0, background: 'var(--bg-tertiary)', fontWeight: 'bold', zIndex: 5 }}>空气质量指数级别</td>
                      {matrixData.cities.map(city => (
                        <td key={`cat-${city.name}`} style={{ textAlign: 'center', fontWeight: 'bold', backgroundColor: city.finalCat?.color, color: (city.finalCat?.level === 'V' || city.finalCat?.level === 'VI') ? 'white' : 'inherit' }}>
                          {city.finalCat?.label || '-'}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td style={{ position: 'sticky', left: 0, background: 'var(--bg-tertiary)', fontWeight: 'bold', zIndex: 5, color: 'var(--accent)' }}>保良余量</td>
                      {matrixData.cities.map(city => (
                        <td key={`margin-${city.name}`} style={{ textAlign: 'center', fontWeight: 'bold', color: city.margin !== null && city.margin <= 0 ? 'var(--color-red)' : 'var(--color-green)' }}>
                          {city.margin !== null ? (selectedPollutant === 'CO' ? city.margin.toFixed(1) : city.margin) : '-'}
                        </td>
                      ))}
                    </tr>
                  </>
                ) : (
                  <>
                    <tr style={{ borderTop: '2px solid var(--border)' }}>
                      <td style={{ position: 'sticky', left: 0, background: 'var(--bg-tertiary)', fontWeight: 'bold', zIndex: 5 }}>日均值</td>
                      {matrixData.cities.map(city => (
                        <td key={`avg-${city.name}`} style={{ textAlign: 'center', fontWeight: 'bold' }}>
                          {city.dailyAvg !== null ? (selectedPollutant === 'CO' ? city.dailyAvg.toFixed(1) : Math.round(city.dailyAvg)) : '-'}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td style={{ position: 'sticky', left: 0, background: 'var(--bg-tertiary)', fontWeight: 'bold', zIndex: 5 }}>IAQI</td>
                      {matrixData.cities.map(city => (
                        <td key={`iaqi-${city.name}`} style={{ textAlign: 'center', fontWeight: 'bold' }}>
                          {city.finalIaqi !== null ? city.finalIaqi : '-'}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td style={{ position: 'sticky', left: 0, background: 'var(--bg-tertiary)', fontWeight: 'bold', zIndex: 5 }}>空气质量等级</td>
                      {matrixData.cities.map(city => (
                        <td key={`cat-${city.name}`} style={{ textAlign: 'center', fontWeight: 'bold', backgroundColor: city.finalCat?.color, color: (city.finalCat?.level === 'V' || city.finalCat?.level === 'VI') ? 'white' : 'inherit' }}>
                          {city.finalCat?.label || '-'}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td style={{ position: 'sticky', left: 0, background: 'var(--bg-tertiary)', fontWeight: 'bold', zIndex: 5, color: 'var(--accent)' }}>保良余量</td>
                      {matrixData.cities.map(city => (
                        <td key={`margin100-${city.name}`} style={{ textAlign: 'center', fontWeight: 'bold', color: city.margin100 !== null && city.margin100 <= 0 ? 'var(--color-red)' : 'var(--color-green)' }}>
                          {city.margin100 !== null ? (selectedPollutant === 'CO' ? city.margin100.toFixed(1) : city.margin100) : '-'}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td style={{ position: 'sticky', left: 0, background: 'var(--bg-tertiary)', fontWeight: 'bold', zIndex: 5 }}>保轻度余量</td>
                      {matrixData.cities.map(city => (
                        <td key={`margin150-${city.name}`} style={{ textAlign: 'center', fontWeight: 'bold', color: city.margin150 !== null && city.margin150 <= 0 ? 'var(--color-red)' : 'var(--color-green)' }}>
                          {city.margin150 !== null ? (selectedPollutant === 'CO' ? city.margin150.toFixed(1) : city.margin150) : '-'}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td style={{ position: 'sticky', left: 0, background: 'var(--bg-tertiary)', fontWeight: 'bold', zIndex: 5 }}>保中度余量</td>
                      {matrixData.cities.map(city => (
                        <td key={`margin200-${city.name}`} style={{ textAlign: 'center', fontWeight: 'bold', color: city.margin200 !== null && city.margin200 <= 0 ? 'var(--color-red)' : 'var(--color-green)' }}>
                          {city.margin200 !== null ? (selectedPollutant === 'CO' ? city.margin200.toFixed(1) : city.margin200) : '-'}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td style={{ position: 'sticky', left: 0, background: 'var(--bg-tertiary)', fontWeight: 'bold', zIndex: 5 }}>保重度余量</td>
                      {matrixData.cities.map(city => (
                        <td key={`margin300-${city.name}`} style={{ textAlign: 'center', fontWeight: 'bold', color: city.margin300 !== null && city.margin300 <= 0 ? 'var(--color-red)' : 'var(--color-green)' }}>
                          {city.margin300 !== null ? (selectedPollutant === 'CO' ? city.margin300.toFixed(1) : city.margin300) : '-'}
                        </td>
                      ))}
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
