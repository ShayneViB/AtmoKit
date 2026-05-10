const XLSX = require('xlsx');
const workbook = XLSX.readFile('templates/城市监测数据小时值_2026-05-08 01_00_2026-05-08 15_00_原始（实况）.xlsx');
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
console.log(JSON.stringify(json.slice(0, 2), null, 2));
