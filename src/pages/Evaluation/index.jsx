import React, { useState, useMemo, useEffect, useRef } from 'react';
import { parseFile } from '../../utils/fileParser';
import { calculateOverallAQI, AQI_STANDARDS } from '../../utils/aqiCalc';
import { calculateAverage, calculatePercentile, calculateCompliance, calculateComprehensiveIndex } from '../../utils/statistics';
import { BarChart2, Upload, FileText, HelpCircle, Download } from 'lucide-react';
import StandardComparisonModal from '../../components/StandardComparisonModal';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import * as XLSX from 'xlsx';
import html2canvas from 'html2canvas';

const POLLUTANT_COLORS = {
  'PM2.5': '#facc15', // yellow
  'PM10': '#06b6d4',  // cyan
  'SO2': '#22c55e',   // green
  'NO2': '#f97316',   // orange
  'CO': '#3b82f6',    // blue
  'O3': '#84cc16',    // lime
  '-': '#cbd5e1'      // slate
};
const renderChart1Label = ({ x, y, textAnchor, payload, fill }) => {
  if (parseFloat(payload.percentage) < 3) return null;
  const dec = payload.unweightedVal !== undefined ? payload.unweightedVal.toString().split('.')[1]?.length || 2 : 2;
  const decimals = Math.max(2, dec);
  return (
    <text x={x} y={y} fill={fill} textAnchor={textAnchor} dominantBaseline="central" fontSize={11} fontWeight="bold">
      {payload.name}: {payload.percentage}%({Number(payload.unweightedVal).toFixed(decimals)})
    </text>
  );
};

const renderChart2Label = ({ x, y, textAnchor, payload, fill }) => {
  if (parseFloat(payload.percentage) < 3) return null;
  return (
    <text x={x} y={y} fill={fill} textAnchor={textAnchor} dominantBaseline="central" fontSize={11} fontWeight="bold">
      {payload.name}: {payload.percentage}%({payload.value}天)
    </text>
  );
};

export default function Evaluation() {
  const [data, setData] = useState([]);
  const [rawData, setRawData] = useState([]); // Store raw data for recalculation
  const [loading, setLoading] = useState(false);
  const [selectedStandard, setSelectedStandard] = useState('2026-2030');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [precisionMode, setPrecisionMode] = useState('standard');
  const summaryTableRef = useRef(null);
  const dataTableRef = useRef(null);
  const chartsRef = useRef(null);

  const exportSummaryTable = () => {
    if (!summaryTableRef.current) return;
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.table_to_sheet(summaryTableRef.current);
    XLSX.utils.book_append_sheet(wb, ws, '统计指标摘要');
    XLSX.writeFile(wb, '统计指标摘要.xlsx');
  };

  const exportDataTable = () => {
    if (!dataTableRef.current) return;
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.table_to_sheet(dataTableRef.current);
    XLSX.utils.book_append_sheet(wb, ws, '数据明细');
    XLSX.writeFile(wb, '数据明细.xlsx');
  };

  const exportChartsPng = async () => {
    if (!chartsRef.current) return;
    const canvas = await html2canvas(chartsRef.current, { backgroundColor: '#1a1a2e', scale: 2 });
    const link = document.createElement('a');
    link.download = '综合评价图表.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);
    try {
      const parsedData = await parseFile(file);
      
      setRawData(parsedData);
      processAndSetData(parsedData, selectedStandard);
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
        const res = await fetch('/templates/城市监测数据日均值_2026-04-01_2026-04-30_原始（实况）.xlsx');
        if (!res.ok) throw new Error("获取默认模板数据失败");
        const arrayBuffer = await res.arrayBuffer();
        const file = new File([arrayBuffer], "城市监测数据日均值_2026-04-01_2026-04-30_原始（实况）.xlsx", {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        });
        const parsedData = await parseFile(file);
        setRawData(parsedData);
      } catch (err) {
        console.error("加载默认数据出错:", err);
      } finally {
        setLoading(false);
      }
    };
    
    loadDefaultData();
  }, []);

  useEffect(() => {
    if (rawData.length > 0) {
      processAndSetData(rawData, selectedStandard);
    }
  }, [rawData, selectedStandard]);

  function processAndSetData(dataset, standardId) {
    const processedData = dataset.map(row => {
      const date = row['时间'] || row.Date;
      const pm25 = parseFloat(row['PM2.5(μg/m3)']) || row.PM25;
      const pm10 = parseFloat(row['PM10(μg/m3)']) || row.PM10;
      const so2 = parseFloat(row['SO2(μg/m3)']) || row.SO2;
      const no2 = parseFloat(row['NO2(μg/m3)']) || row.NO2;
      const o3 = parseFloat(row['O3_8H(μg/m3)']) || row.O3;
      const co = parseFloat(row['CO(mg/m3)']) || row.CO;

      const conc = { PM25: pm25, PM10: pm10, SO2: so2, NO2: no2, O3: o3, CO: co };
      const calc = calculateOverallAQI(conc, standardId);
      
      return {
        ...row,
        Date: date,
        PM25: pm25,
        PM10: pm10,
        SO2: so2,
        NO2: no2,
        O3: o3,
        CO: co,
        aqi: calc.aqi,
        category: calc.category.label,
        primary: calc.primaryPollutants.join(', ') || '-'
      };
    }).filter(row => row.Date !== undefined && row.Date !== null);

    setData(processedData);
  };

  const stats = useMemo(() => {
    if (data.length === 0) return null;

    const getCol = (col) => data.map(r => r[col]).filter(v => v !== undefined && v !== null && !isNaN(v));

    const pm25 = getCol('PM25');
    const pm10 = getCol('PM10');
    const so2 = getCol('SO2');
    const no2 = getCol('NO2');
    const o3 = getCol('O3');
    const co = getCol('CO');

    const comp = calculateCompliance(data, 'aqi');
    const indexData = calculateComprehensiveIndex(data, selectedStandard, precisionMode);

    let pollutedDays = 0;
    let heavyPollutedDays = 0;
    let maxAqi = 0;
    
    const primaryCount = {};
    const categoryCount = {};

    for (const row of data) {
      if (row.aqi) {
        maxAqi = Math.max(maxAqi, row.aqi);
        if (row.aqi > 100) pollutedDays++;
        if (row.aqi > 200) heavyPollutedDays++;
        
        categoryCount[row.category] = (categoryCount[row.category] || 0) + 1;
      }
      if (row.primary && row.primary !== '-') {
        const prims = row.primary.split(', ');
        for (const p of prims) {
          primaryCount[p] = (primaryCount[p] || 0) + 1;
        }
      }
    }

    const totalDays = comp.total;
    const formatPct = (num) => (totalDays > 0 ? (num / totalDays * 100).toFixed(1) : '0.0') + '%';

    const formatValue = (val, type) => {
      if (val === undefined || val === null || isNaN(val)) return '-';
      const isCO = type === 'CO';
      const decimals = precisionMode === 'standard' ? (isCO ? 1 : 0) : (isCO ? 2 : 1);
      return Number(val).toFixed(decimals);
    };

    const contributionChartData = Object.entries(indexData.contributions).map(([key, val]) => {
      const name = key === 'PM25' ? 'PM2.5' : key;
      return {
        name,
        value: val,
        unweightedVal: indexData.unweighted[key],
        percentage: (val / indexData.total * 100).toFixed(1)
      };
    }).sort((a, b) => b.value - a.value);

    const primaryChartData = Object.entries(primaryCount).map(([name, count]) => ({
      name: name === 'PM25' ? 'PM2.5' : name,
      value: count,
      percentage: (count / totalDays * 100).toFixed(1)
    })).sort((a, b) => b.value - a.value);

    const CATEGORY_COLORS = {
      '优': '#00e400',
      '良': '#ffff00',
      '轻度污染': '#ff7e00',
      '中度污染': '#ff0000',
      '重度污染': '#99004c',
      '严重污染': '#7e0023'
    };
    
    const categoryChartData = Object.entries(categoryCount)
      .map(([name, count]) => ({
        name,
        value: count,
        percentage: (count / totalDays * 100).toFixed(1),
        color: CATEGORY_COLORS[name] || '#aaa'
      })).sort((a, b) => b.value - a.value);

    return {
      pm25Avg: formatValue(calculateAverage(pm25), 'PM25'),
      pm10Avg: formatValue(calculateAverage(pm10), 'PM10'),
      so2Avg: formatValue(calculateAverage(so2), 'SO2'),
      no2Avg: formatValue(calculateAverage(no2), 'NO2'),
      o3P90: formatValue(calculatePercentile(o3, 90), 'O3'),
      coP95: formatValue(calculatePercentile(co, 95), 'CO'),
      
      complianceDays: comp.days,
      complianceRate: formatPct(comp.days),
      pollutedDays,
      pollutedRate: formatPct(pollutedDays),
      heavyPollutedDays,
      heavyPollutedRate: formatPct(heavyPollutedDays),
      
      compIndex: indexData.total > 0 ? indexData.total.toFixed(precisionMode === 'standard+1' ? 3 : 2) : '-',
      maxIndex: indexData.maxIndex > 0 ? indexData.maxIndex.toFixed(precisionMode === 'standard+1' ? 3 : 2) : '-',
      
      contributionChartData,
      primaryChartData,
      categoryChartData
    };
  }, [data, precisionMode]);

  return (
    <div style={{ padding: '24px 0' }}>
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BarChart2 color="var(--accent)" />
          综合数据评价
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
            导入历史数据，自动根据不同时期的标准计算统计特征与达标率指标。
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
            <label style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '8px' }}>
              数值保留:
            </label>
            <select 
              value={precisionMode} 
              onChange={(e) => setPrecisionMode(e.target.value)}
              className="input-field" 
              style={{ width: '120px', padding: '8px 12px' }}
            >
              <option value="standard">标准</option>
              <option value="standard+1">标准+1</option>
            </select>
          </div>
        </div>
      </div>

      <div className="glass-panel" style={{ marginBottom: '24px' }}>
        <h3 style={{ marginTop: 0 }}>数据导入</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <label className="btn" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Upload size={18} />
            上传数据文件
            <input type="file" accept=".csv, .xlsx, .xls" onChange={handleFileUpload} style={{ display: 'none' }} />
          </label>
          <a href="/templates/城市监测数据日均值_2026-04-01_2026-04-30_原始（实况）.xlsx" download className="btn" style={{ background: 'transparent', color: 'var(--text-primary)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
            <FileText size={18} /> 下载模板
          </a>
          {loading && <span style={{ color: 'var(--accent)' }}>解析中...</span>}
        </div>
      </div>

      {!stats && !loading && (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '64px 24px', color: 'var(--text-secondary)', marginBottom: '24px' }}>
          <BarChart2 size={64} opacity={0.2} style={{ marginBottom: '16px', display: 'inline-block' }} />
          <h3 style={{ margin: '0 0 8px 0', color: 'var(--text-primary)' }}>暂无数据</h3>
          <p style={{ margin: 0 }}>请点击上方“上传数据文件”导入您的空气质量 CSV/Excel 数据以生成综合评估报告。</p>
        </div>
      )}

      {stats && (
        <>
          <div className="glass-panel" style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0 }}>统计指标摘要</h3>
              <button className="btn" onClick={exportSummaryTable} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--color-green)', color: 'white', border: 'none', padding: '6px 14px', fontSize: '0.85rem' }}>
                <Download size={15} /> 导出表格
              </button>
            </div>
            <div className="table-container">
              <table ref={summaryTableRef}>
                <thead>
                  <tr>
                    <th>PM2.5(平均)</th>
                    <th>PM10(平均)</th>
                    <th>SO2(平均)</th>
                    <th>NO2(平均)</th>
                    <th>O3(90百分位)</th>
                    <th>CO(95百分位)</th>
                    <th>优良天数/占比</th>
                    <th>污染天数/占比</th>
                    <th>重污染天/占比</th>
                    <th>综合指数</th>
                    <th>最大指数</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>{stats.pm25Avg}</td>
                    <td>{stats.pm10Avg}</td>
                    <td>{stats.so2Avg}</td>
                    <td>{stats.no2Avg}</td>
                    <td>{stats.o3P90}</td>
                    <td>{stats.coP95}</td>
                    <td><span style={{ backgroundColor: 'rgba(0, 228, 0, 0.15)', color: '#009900', padding: '4px 8px', borderRadius: '4px', fontWeight: 'bold' }}>{stats.complianceDays} ({stats.complianceRate})</span></td>
                    <td><span style={{ backgroundColor: 'rgba(255, 126, 0, 0.15)', color: '#cc6600', padding: '4px 8px', borderRadius: '4px', fontWeight: 'bold' }}>{stats.pollutedDays} ({stats.pollutedRate})</span></td>
                    <td><span style={{ backgroundColor: 'rgba(153, 0, 76, 0.15)', color: '#800040', padding: '4px 8px', borderRadius: '4px', fontWeight: 'bold' }}>{stats.heavyPollutedDays} ({stats.heavyPollutedRate})</span></td>
                    <td style={{ fontWeight: 'bold' }}>{stats.compIndex}</td>
                    <td style={{ fontWeight: 'bold', color: 'var(--color-red)' }}>{stats.maxIndex}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-3" style={{ marginBottom: '24px' }} ref={chartsRef}>
            <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
              <button className="btn" onClick={exportChartsPng} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--accent)', color: 'white', border: 'none', padding: '6px 14px', fontSize: '0.85rem' }}>
                <Download size={15} /> 导出图表 PNG
              </button>
            </div>
            <div className="glass-panel" style={{ textAlign: 'center', height: '350px', display: 'flex', flexDirection: 'column' }}>
              <h4 style={{ margin: '0 0 16px 0' }}>综合指数贡献比</h4>
              <div style={{ flex: 1, position: 'relative' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
                    <Pie
                      data={stats.contributionChartData}
                      cx="50%" cy="50%" innerRadius={55} outerRadius={75}
                      dataKey="value" stroke="none"
                      labelLine={true}
                      label={renderChart1Label}
                    >
                      {stats.contributionChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={POLLUTANT_COLORS[entry.name]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(val, name, props) => [`${props.payload.percentage}% (单项指数: ${Number(props.payload.unweightedVal).toFixed(precisionMode === 'standard+1' ? 3 : 2)}, 贡献加权: ${Number(val).toFixed(precisionMode === 'standard+1' ? 3 : 2)})`, name]} />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ position: 'absolute', top: '45%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>综合指数</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{stats.compIndex}</div>
                </div>
              </div>
            </div>
            
            <div className="glass-panel" style={{ textAlign: 'center', height: '350px', display: 'flex', flexDirection: 'column' }}>
              <h4 style={{ margin: '0 0 16px 0' }}>首要污染物占比</h4>
              <div style={{ flex: 1, position: 'relative' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
                    <Pie
                      data={stats.primaryChartData}
                      cx="50%" cy="50%" innerRadius={55} outerRadius={75}
                      dataKey="value" stroke="none"
                      labelLine={true}
                      label={renderChart2Label}
                    >
                      {stats.primaryChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={POLLUTANT_COLORS[entry.name]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(val, name, props) => [`${props.payload.percentage}% (${val}天)`, name]} />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="glass-panel" style={{ textAlign: 'center', height: '350px', display: 'flex', flexDirection: 'column' }}>
              <h4 style={{ margin: '0 0 16px 0' }}>优良天数比例</h4>
              <div style={{ flex: 1, position: 'relative' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
                    <Pie
                      data={stats.categoryChartData}
                      cx="50%" cy="50%" innerRadius={55} outerRadius={75}
                      dataKey="value" stroke="none"
                      labelLine={true}
                      label={renderChart2Label}
                    >
                      {stats.categoryChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(val, name, props) => [`${props.payload.percentage}% (${val}天)`, name]} />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ position: 'absolute', top: '45%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>优良天数</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--color-green)' }}>{stats.complianceDays}</div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {data.length > 0 && (
        <div className="glass-panel table-container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ margin: 0 }}>数据预览</h3>
            <button className="btn" onClick={exportDataTable} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--color-green)', color: 'white', border: 'none', padding: '6px 14px', fontSize: '0.85rem' }}>
              <Download size={15} /> 导出明细
            </button>
          </div>
          <table ref={dataTableRef}>
            <thead>
              <tr>
                <th>日期</th>
                <th>PM2.5</th>
                <th>PM10</th>
                <th>SO2</th>
                <th>NO2</th>
                <th>O3</th>
                <th>CO</th>
                <th>AQI</th>
                <th>级别</th>
                <th>首要污染物</th>
              </tr>
            </thead>
            <tbody>
              {data.slice(0, 50).map((row, i) => (
                <tr key={i}>
                  <td>{row.Date}</td>
                  <td>{row.PM25}</td>
                  <td>{row.PM10}</td>
                  <td>{row.SO2}</td>
                  <td>{row.NO2}</td>
                  <td>{row.O3}</td>
                  <td>{row.CO}</td>
                  <td style={{ fontWeight: 'bold' }}>{row.aqi}</td>
                  <td>{row.category}</td>
                  <td>{row.primary}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.length > 50 && (
            <div style={{ textAlign: 'center', padding: '16px', color: 'var(--text-secondary)' }}>
              仅显示前 50 条数据
            </div>
          )}
        </div>
      )}

      <StandardComparisonModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
      />
    </div>
  );
}
