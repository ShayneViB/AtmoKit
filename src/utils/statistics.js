// Calculate average of an array
export function calculateAverage(arr) {
  if (!arr || arr.length === 0) return null;
  const sum = arr.reduce((acc, val) => acc + val, 0);
  return sum / arr.length;
}

// Calculate percentile (e.g., 90th for O3, 95th for CO)
export function calculatePercentile(arr, percentile) {
  if (!arr || arr.length === 0) return null;
  
  // Sort array in ascending order
  const sorted = [...arr].sort((a, b) => a - b);
  
  const index = (percentile / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;

  if (upper >= sorted.length) return sorted[lower];
  
  // Interpolate
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

// Compliance rate calculation
export function calculateCompliance(dataList, aqiField = 'aqi') {
  if (!dataList || dataList.length === 0) return { days: 0, total: 0, rate: 0 };
  
  let validDays = 0;
  let complianceDays = 0;

  for (const row of dataList) {
    if (row[aqiField] !== undefined && row[aqiField] !== null) {
      validDays++;
      if (row[aqiField] <= 100) {
        complianceDays++;
      }
    }
  }

  return {
    days: complianceDays,
    total: validDays,
    rate: validDays > 0 ? (complianceDays / validDays) * 100 : 0
  };
}

export function calculateComprehensiveIndex(data, standardId = '2026-2030', precisionMode = 'standard') {
  const getLimits = (id) => {
    if (id === '2031+') {
      return { SO2: 20, NO2: 30, PM10: 50, PM25: 25, CO: 4, O3: 160 };
    }
    if (id === '2026-2030') {
      return { SO2: 60, NO2: 40, PM10: 60, PM25: 30, CO: 4, O3: 160 };
    }
    return { SO2: 60, NO2: 40, PM10: 70, PM25: 35, CO: 4, O3: 160 };
  };
  const limits = getLimits(standardId);

  const avg = col => calculateAverage(data.map(r => r[col]).filter(v => v !== undefined && !isNaN(v)));
  const pct = (col, p) => calculatePercentile(data.map(r => r[col]).filter(v => v !== undefined && !isNaN(v)), p);

  const roundHalfToEven = (val, decimals = 0) => {
    if (val === null || val === undefined || isNaN(val)) return null;
    const factor = Math.pow(10, decimals);
    const scaled = val * factor;
    const floor = Math.floor(scaled + 1e-14);
    const fraction = scaled - floor;
    
    let rounded;
    if (Math.abs(fraction - 0.5) < 1e-10) {
      rounded = (floor % 2 === 0) ? floor : floor + 1;
    } else {
      rounded = Math.round(scaled);
    }
    return rounded / factor;
  };

  const getDecimals = (p) => {
    const base = (p === 'CO') ? 1 : 0;
    return precisionMode === 'standard+1' ? base + 1 : base;
  };

  const C = {
    SO2: roundHalfToEven(avg('SO2'), getDecimals('SO2')),
    NO2: roundHalfToEven(avg('NO2'), getDecimals('NO2')),
    PM10: roundHalfToEven(avg('PM10'), getDecimals('PM10')),
    PM25: roundHalfToEven(avg('PM25'), getDecimals('PM25')),
    CO: roundHalfToEven(pct('CO', 95), getDecimals('CO')),
    O3: roundHalfToEven(pct('O3', 90), getDecimals('O3'))
  };

  const getWeight = (p) => {
    if (standardId === '2013-2025') return 1;
    if (p === 'PM25') return 3;
    if (p === 'O3' || p === 'NO2') return 2;
    return 1;
  };

  const index = {};
  const unweighted = {};
  let total = 0;
  let maxIndex = 0;
  
  const indexDecimals = precisionMode === 'standard+1' ? 3 : 2;

  for (const p of ['SO2', 'NO2', 'PM10', 'PM25', 'CO', 'O3']) {
    if (C[p] !== null && C[p] !== undefined) {
      const w = getWeight(p);
      const I_i_raw = C[p] / limits[p];
      const I_i = roundHalfToEven(I_i_raw, indexDecimals);
      
      unweighted[p] = I_i;
      index[p] = I_i * w;
      total += index[p];
      if (I_i > maxIndex) {
        maxIndex = I_i;
      }
    }
  }

  total = roundHalfToEven(total, indexDecimals);
  return { total, maxIndex, contributions: index, unweighted, concentrations: C };
}
