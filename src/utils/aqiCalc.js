import standardsData from '../../standards/AQI_Rules.json';

export const AQI_STANDARDS = standardsData;

// Get AQI category details based on AQI value
export function getAqiCategory(aqi) {
  if (aqi === null || isNaN(aqi)) return { level: '-', color: 'var(--color-invalid)', label: '无数据' };
  if (aqi <= 50) return { level: 'I', color: 'var(--color-green)', label: '优' };
  if (aqi <= 100) return { level: 'II', color: 'var(--color-yellow)', label: '良' };
  if (aqi <= 150) return { level: 'III', color: 'var(--color-orange)', label: '轻度污染' };
  if (aqi <= 200) return { level: 'IV', color: 'var(--color-red)', label: '中度污染' };
  if (aqi <= 300) return { level: 'V', color: 'var(--color-purple)', label: '重度污染' };
  return { level: 'VI', color: 'var(--color-maroon)', label: '严重污染' };
}

// Calculate IAQI for a single pollutant
export function calculateIAQI(pollutant, concentration, standardId = '2026-2030') {
  if (concentration === null || concentration === undefined || isNaN(concentration) || concentration < 0) {
    return null; // Invalid concentration
  }

  const standard = AQI_STANDARDS.find(s => s.id === standardId) || AQI_STANDARDS[1];
  const rules = standard.pollutants[pollutant];
  if (!rules) return null; // No rules for this pollutant

  const { breakpoints, iaqi } = rules;
  
  let bpLow = 0, bpHigh = 0, iaqiLow = 0, iaqiHigh = 0;
  let found = false;

  for (let i = 0; i < breakpoints.length - 1; i++) {
    if (concentration >= breakpoints[i] && concentration <= breakpoints[i + 1]) {
      bpLow = breakpoints[i];
      bpHigh = breakpoints[i + 1];
      iaqiLow = iaqi[i];
      iaqiHigh = iaqi[i + 1];
      found = true;
      break;
    }
  }

  if (!found && concentration > breakpoints[breakpoints.length - 1]) {
    bpLow = breakpoints[breakpoints.length - 2];
    bpHigh = breakpoints[breakpoints.length - 1];
    iaqiLow = iaqi[iaqi.length - 2];
    iaqiHigh = iaqi[iaqi.length - 1];
  }

  const calculatedIaqi = ((iaqiHigh - iaqiLow) / (bpHigh - bpLow)) * (concentration - bpLow) + iaqiLow;
  const finalIaqi = Math.ceil(calculatedIaqi);
  return finalIaqi > 500 ? 500 : finalIaqi;
}

// Calculate overall AQI and primary pollutants
export function calculateOverallAQI(concentrations, standardId = '2026-2030') {
  const iaqis = {};
  let maxIaqi = -1;
  const primaryPollutants = [];

  for (const [pollutant, concentration] of Object.entries(concentrations)) {
    const iaqi = calculateIAQI(pollutant, concentration, standardId);
    if (iaqi !== null) {
      iaqis[pollutant] = iaqi;
      if (iaqi > maxIaqi) {
        maxIaqi = iaqi;
      }
    }
  }

  if (maxIaqi === -1) {
    return { aqi: null, primaryPollutants: [], iaqis, category: getAqiCategory(null) };
  }

  if (maxIaqi > 50) {
    for (const [pollutant, iaqi] of Object.entries(iaqis)) {
      if (iaqi === maxIaqi) {
        primaryPollutants.push(pollutant);
      }
    }
  }

  return {
    aqi: maxIaqi,
    primaryPollutants,
    iaqis,
    category: getAqiCategory(maxIaqi)
  };
}
