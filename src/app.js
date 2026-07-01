/**
 * Pertamina Career-Sync: Internship 2026 Dashboard
 * Core Application Logic (Vanilla ES6)
 */

// Application State
const state = {
  rawItems: [],        // Original cleaned dataset
  filteredItems: [],   // Currently filtered dataset
  favorites: [],       // Array of saved program titles (or unique IDs)
  activeSection: 'dashboard-section',
  layoutView: 'grid',
  currentPage: 1,
  itemsPerPage: 12,
  charts: {},          // ChartJS instances
  originalCsvContent: '', // To cache the default CSV content for reset
  
  // CV Matcher State
  resumeText: '',
  resumeFileName: '',
  resumeFileSize: '',
  geminiApiKey: ''
};

// Color palettes for Chart.js
const colors = {
  blue: { solid: '#0ea5e9', light: 'rgba(14, 165, 233, 0.2)' },
  green: { solid: '#10b981', light: 'rgba(16, 185, 129, 0.2)' },
  indigo: { solid: '#6366f1', light: 'rgba(99, 102, 241, 0.2)' },
  amber: { solid: '#f59e0b', light: 'rgba(245, 158, 11, 0.2)' },
  rose: { solid: '#ef4444', light: 'rgba(239, 68, 68, 0.2)' },
  cyan: { solid: '#06b6d4', light: 'rgba(6, 182, 212, 0.2)' },
  purple: { solid: '#a855f7', light: 'rgba(168, 85, 247, 0.2)' },
  violet: { solid: '#8b5cf6', light: 'rgba(139, 92, 246, 0.2)' }
};

// Initialize App
document.addEventListener('DOMContentLoaded', async () => {
  // Load Lucide Icons
  lucide.createIcons();
  
  // Load saved theme
  initTheme();

  // Load saved bookmarks from localStorage
  loadBookmarks();

  // Load saved Gemini API Key
  loadApiKey();

  // Initialize CV Matcher bindings
  initCvMatcher();

  // Fetch and parse the CSV
  try {
    const response = await fetch('/pertamina_internship_full.csv');
    if (!response.ok) throw new Error('Failed to load CSV file.');
    const csvText = await response.text();
    state.originalCsvContent = csvText;
    
    processAndInitData(csvText);
  } catch (error) {
    showToast('Failed to load internship data. Please upload a CSV file manually.', 'warning');
    console.error(error);
  }

  // Bind all UI interaction events
  bindEvents();
});

/* ==========================================================================
   DATA PROCESSING & PARSING
   ========================================================================== */

/**
 * Parses raw CSV content with RFC 4180 compliance (handles quotes and commas)
 */
function parseCSV(text) {
  const lines = [];
  let row = [""];
  let inQuotes = false;
  
  for (let i = 0; i < text.length; i++) {
    let c = text[i];
    let next = text[i+1];
    
    if (c === '"') {
      if (inQuotes && next === '"') {
        row[row.length - 1] += '"';
        i++; // skip next double quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      row.push('');
    } else if ((c === '\r' || c === '\n') && !inQuotes) {
      if (c === '\r' && next === '\n') {
        i++;
      }
      lines.push(row);
      row = [''];
    } else {
      row[row.length - 1] += c;
    }
  }
  if (row.length > 1 || row[0] !== '') {
    lines.push(row);
  }
  
  if (lines.length === 0) return [];
  
  const headers = lines[0].map(h => h.trim().toLowerCase());
  const result = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i];
    if (values.length < headers.length) continue;
    
    const obj = {};
    let hasData = false;
    for (let j = 0; j < headers.length; j++) {
      const val = values[j] ? values[j].trim() : '';
      obj[headers[j]] = val;
      if (val) hasData = true;
    }
    if (hasData) {
      result.push(obj);
    }
  }
  
  return result;
}

/**
 * Cleans and maps the parsed CSV rows into structured objects
 */
function cleanDataset(parsedRows) {
  return parsedRows.map((row, index) => {
    const rawTitle = row.title || '';
    const rawCompany = row.company || '';
    const rawLocation = row.location || '';
    
    // 1. Determine Subsidiary / Company Group
    let company = "PT Pertamina (Persero)";
    if (rawTitle.includes("Patra Niaga") || rawCompany.includes("Patra Niaga")) {
      company = "PT Pertamina Patra Niaga";
    } else if (rawTitle.includes("Patra Jasa") || rawCompany.includes("Patra Jasa")) {
      company = "PT Patra Jasa";
    } else if (rawTitle.includes("Nusantara Regas") || rawCompany.includes("Nusantara Regas")) {
      company = "PT Nusantara Regas";
    } else if (rawTitle.includes("Pertamina Gas") || rawCompany.includes("Pertamina Gas")) {
      company = "PT Pertamina Gas";
    } else if (rawTitle.includes("Trans Kontinental") || rawCompany.includes("Trans Kontinental")) {
      company = "PT Pertamina Trans Kontinental";
    } else if (rawTitle.includes("Geothermal") || rawCompany.includes("Geothermal")) {
      company = "PT Pertamina Geothermal Energy";
    } else if (rawTitle.includes("Power Indonesia") || rawCompany.includes("Power Indonesia")) {
      company = "PT Pertamina Power Indonesia";
    } else if (rawTitle.includes("Training and Consulting") || rawCompany.includes("Training and Consulting")) {
      company = "PT Pertamina Training & Consulting";
    } else if (rawTitle.includes("Foundation") || rawCompany.includes("Foundation")) {
      company = "Pertamina Foundation";
    } else if (rawTitle.includes("Hulu Energi") || rawCompany.includes("Hulu Energi")) {
      company = "PT Pertamina Hulu Energi";
    } else if (rawTitle.includes("Permata Graha") || rawCompany.includes("Permata Graha")) {
      company = "PT Permata Graha Nusantara";
    } else if (rawTitle.includes("Port & Logistics") || rawCompany.includes("Port & Logistics")) {
      company = "PT Pertamina Port & Logistics";
    }

    // 2. Clean Location
    let location = rawLocation
      .replace(/Kota Administrasi/gi, '')
      .replace(/Kota/gi, '')
      .replace(/Kabupaten/gi, 'Kab.')
      .replace(/Oil/gi, '')
      .trim();
    if (!location) location = "Jakarta Selatan"; // Default fallback

    // 3. Parse Numbers
    const posisi = parseInt(row.posisi) || 1;
    const pelamar = parseInt(row.pelamar) || 0;
    const rasio = parseFloat(row.rasio) || (pelamar / posisi);

    // 4. Extract Function and Details
    // E.g.: "IINTERNSHIP 2026 - PT Pertamina (Persero) - Fungsi SDM (Employee Services)"
    let fungsi = "Umum / Operasional";
    let detail = rawTitle;
    
    // Attempt standard Pertamina pattern: "Fungsi XXX (YYY)"
    const fungsiRegex = /Fungsi\s+([^(]+)(?:\(([^)]+)\))?/;
    const match = rawTitle.match(fungsiRegex);
    
    if (match) {
      fungsi = match[1].trim();
      detail = match[2] ? match[2].trim() : fungsi;
    } else {
      // General fallbacks
      const parts = rawTitle.split('-');
      if (parts.length >= 3) {
        detail = parts[parts.length - 1].trim();
        fungsi = parts[parts.length - 2].replace("Fungsi", "").trim();
      }
    }

    // Double check clean title
    const displayTitle = rawTitle
      .replace(/^I+NTERNSHIP\s+\d+\s*-\s*/i, '') // Remove IINTERNSHIP 2026 prefix
      .trim();

    return {
      id: `role-${index}`,
      originalTitle: rawTitle,
      title: displayTitle,
      company: company,
      location: location,
      date: row.date || '07/01/2026 - 07/05/2026',
      posisi: posisi,
      pelamar: pelamar,
      rasio: Math.round(rasio * 100) / 100, // round to 2 decimals
      fungsi: fungsi,
      detail: detail
    };
  });
}

/**
 * Bootstraps the application state and view updates after parsing a CSV
 */
function processAndInitData(csvText) {
  const parsed = parseCSV(csvText);
  if (parsed.length === 0) {
    showToast('Empty or invalid CSV file.', 'warning');
    return;
  }
  
  state.rawItems = cleanDataset(parsed);
  state.filteredItems = [...state.rawItems];
  state.currentPage = 1;

  // Build filter options (companies & locations)
  populateFilters();

  // Reset filter values in DOM
  document.getElementById('explorerSearchInput').value = '';
  document.getElementById('filterCompanySelect').value = '';
  document.getElementById('filterLocationSelect').value = '';
  document.getElementById('filterRatioRange').value = 500;
  document.getElementById('ratioValueLabel').textContent = 'Any';
  document.getElementById('sortFieldSelect').value = 'rasio-desc';

  // Calculate & render stats
  calculateKPIs();
  
  // Render graphs
  initOrUpdateCharts();

  // Render lists
  renderExplorer();
  renderFavorites();
  
  // Show reset button if it's not the default dataset
  const resetBtn = document.getElementById('resetDataBtn');
  if (resetBtn) {
    resetBtn.style.display = csvText === state.originalCsvContent ? 'none' : 'inline-flex';
  }

  showToast(`Successfully loaded ${state.rawItems.length} internship programs.`, 'success');
}

/* ==========================================================================
   STATISTICS & ANALYTICS
   ========================================================================== */

/**
 * Calculates and prints KPIs
 */
function calculateKPIs() {
  const items = state.filteredItems;
  if (items.length === 0) {
    document.getElementById('statPrograms').textContent = '0';
    document.getElementById('statPositions').textContent = '0';
    document.getElementById('statApplicants').textContent = '0';
    document.getElementById('statAvgApplicantsPerRole').textContent = 'Avg. 0 per role';
    document.getElementById('statAvgRatio').textContent = '0.0x';
    document.getElementById('statMostCompetitiveTitle').textContent = 'None';
    document.getElementById('statMostCompetitiveDetail').textContent = 'No applicants';
    return;
  }

  const totalPrograms = items.length;
  let totalPositions = 0;
  let totalApplicants = 0;
  let maxRatio = -1;
  let maxRatioItem = null;

  items.forEach(item => {
    totalPositions += item.posisi;
    totalApplicants += item.pelamar;
    
    if (item.rasio > maxRatio) {
      maxRatio = item.rasio;
      maxRatioItem = item;
    }
  });

  const avgRatio = totalPositions > 0 ? (totalApplicants / totalPositions) : 0;
  const avgApplicantsPerRole = Math.round(totalApplicants / totalPrograms);

  // Render KPI values
  document.getElementById('statPrograms').textContent = totalPrograms.toLocaleString();
  document.getElementById('statPositions').textContent = totalPositions.toLocaleString();
  document.getElementById('statApplicants').textContent = totalApplicants.toLocaleString();
  document.getElementById('statAvgApplicantsPerRole').textContent = `Avg. ${avgApplicantsPerRole.toLocaleString()} applicants / program`;
  document.getElementById('statAvgRatio').textContent = `${avgRatio.toFixed(1)}x`;

  if (maxRatioItem) {
    document.getElementById('statMostCompetitiveTitle').textContent = maxRatioItem.title;
    document.getElementById('statMostCompetitiveDetail').textContent = 
      `${maxRatioItem.company} | ${maxRatioItem.pelamar} applicants for ${maxRatioItem.posisi} slot (${maxRatioItem.rasio.toFixed(1)}x ratio)`;
  }
}

/**
 * Populates company and location selectors dynamically based on dataset
 */
function populateFilters() {
  const companies = [...new Set(state.rawItems.map(item => item.company))].sort();
  const locations = [...new Set(state.rawItems.map(item => item.location))].sort();

  const companySelect = document.getElementById('filterCompanySelect');
  const locationSelect = document.getElementById('filterLocationSelect');

  // Clear previous options except first placeholder
  companySelect.innerHTML = '<option value="">All Companies / Subsidiaries</option>';
  locationSelect.innerHTML = '<option value="">All Locations</option>';

  companies.forEach(company => {
    const opt = document.createElement('option');
    opt.value = company;
    opt.textContent = company;
    companySelect.appendChild(opt);
  });

  locations.forEach(location => {
    const opt = document.createElement('option');
    opt.value = location;
    opt.textContent = location;
    locationSelect.appendChild(opt);
  });
}

/**
 * Group ratio into 4 difficulty buckets
 */
function getCompetitionBucket(ratio) {
  if (ratio < 5) return 'low';
  if (ratio < 15) return 'medium';
  if (ratio < 30) return 'high';
  return 'extreme';
}

/* ==========================================================================
   CHARTS RENDER (CHART.JS)
   ========================================================================== */

function initOrUpdateCharts() {
  const items = state.filteredItems;

  // Destroy existing charts to reload with new dataset
  Object.keys(state.charts).forEach(key => {
    if (state.charts[key]) {
      state.charts[key].destroy();
    }
  });

  // Prepare theme properties (adjust grid color based on dark/light mode)
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  const gridColor = isLight ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.05)';
  const textColor = isLight ? '#475569' : '#94a3b8';
  const displayFont = 'Outfit';

  Chart.defaults.color = textColor;
  Chart.defaults.font.family = 'Inter';

  // ----------------------------------------------------
  // Chart 1: Company Distribution (Positions & Applicants)
  // ----------------------------------------------------
  const companyData = {};
  items.forEach(item => {
    if (!companyData[item.company]) {
      companyData[item.company] = { positions: 0, applicants: 0 };
    }
    companyData[item.company].positions += item.posisi;
    companyData[item.company].applicants += item.pelamar;
  });

  const sortedCompanies = Object.keys(companyData).sort((a, b) => companyData[b].applicants - companyData[a].applicants);
  
  const ctxCompany = document.getElementById('companyDistributionChart').getContext('2d');
  state.charts.company = new Chart(ctxCompany, {
    type: 'bar',
    data: {
      labels: sortedCompanies.map(c => c.replace("PT Pertamina ", "")),
      datasets: [
        {
          label: 'Total Positions',
          data: sortedCompanies.map(c => companyData[c].positions),
          backgroundColor: colors.cyan.solid,
          borderRadius: 4,
          yAxisID: 'yPos',
          order: 2
        },
        {
          label: 'Total Applicants',
          data: sortedCompanies.map(c => companyData[c].applicants),
          backgroundColor: colors.indigo.light,
          borderColor: colors.indigo.solid,
          borderWidth: 2,
          type: 'line',
          tension: 0.3,
          yAxisID: 'yPel',
          order: 1
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top' },
        tooltip: { padding: 12 }
      },
      scales: {
        x: {
          grid: { display: false }
        },
        yPos: {
          type: 'linear',
          position: 'left',
          grid: { color: gridColor },
          title: { display: true, text: 'Positions Open' }
        },
        yPel: {
          type: 'linear',
          position: 'right',
          grid: { display: false },
          title: { display: true, text: 'Total Applicants' }
        }
      }
    }
  });

  // ----------------------------------------------------
  // Chart 2: Top 10 Most Competitive Functions (by Avg Ratio)
  // ----------------------------------------------------
  const functionData = {};
  items.forEach(item => {
    if (!functionData[item.fungsi]) {
      functionData[item.fungsi] = { sumRatio: 0, count: 0 };
    }
    functionData[item.fungsi].sumRatio += item.rasio;
    functionData[item.fungsi].count += 1;
  });

  const avgFunctionRatios = Object.keys(functionData).map(f => ({
    name: f,
    avgRatio: Math.round((functionData[f].sumRatio / functionData[f].count) * 100) / 100
  })).sort((a, b) => b.avgRatio - a.avgRatio).slice(0, 10);

  const ctxFunction = document.getElementById('functionRatioChart').getContext('2d');
  state.charts.function = new Chart(ctxFunction, {
    type: 'bar',
    data: {
      labels: avgFunctionRatios.map(f => f.name.length > 22 ? f.name.slice(0, 20) + '...' : f.name),
      datasets: [{
        label: 'Avg Competition Ratio',
        data: avgFunctionRatios.map(f => f.avgRatio),
        backgroundColor: colors.rose.solid,
        borderRadius: 4
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { padding: 12 }
      },
      scales: {
        x: {
          grid: { color: gridColor },
          title: { display: true, text: 'Competition Ratio (x)' }
        },
        y: {
          grid: { display: false }
        }
      }
    }
  });

  // ----------------------------------------------------
  // Chart 3: Location Distribution
  // ----------------------------------------------------
  const locationData = {};
  items.forEach(item => {
    if (!locationData[item.location]) {
      locationData[item.location] = 0;
    }
    locationData[item.location] += item.posisi;
  });

  const sortedLocations = Object.keys(locationData).sort((a, b) => locationData[b] - locationData[a]).slice(0, 8);
  const locationColors = [
    colors.blue.solid, colors.indigo.solid, colors.green.solid, 
    colors.amber.solid, colors.rose.solid, colors.cyan.solid, 
    colors.purple.solid, colors.violet.solid
  ];

  const ctxLoc = document.getElementById('locationDistributionChart').getContext('2d');
  state.charts.location = new Chart(ctxLoc, {
    type: 'polarArea',
    data: {
      labels: sortedLocations,
      datasets: [{
        data: sortedLocations.map(l => locationData[l]),
        backgroundColor: locationColors.map(c => c + 'cc'), // add opacity
        borderColor: isLight ? '#ffffff' : '#12192f',
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'right', labels: { boxWidth: 12 } }
      },
      scales: {
        r: {
          grid: { color: gridColor },
          angleLines: { color: gridColor },
          ticks: { display: false }
        }
      }
    }
  });

  // ----------------------------------------------------
  // Chart 4: Competition Zones (Doughnut)
  // ----------------------------------------------------
  const zoneCounts = { low: 0, medium: 0, high: 0, extreme: 0 };
  items.forEach(item => {
    const bucket = getCompetitionBucket(item.rasio);
    zoneCounts[bucket]++;
  });

  const ctxZone = document.getElementById('competitionZonesChart').getContext('2d');
  state.charts.zone = new Chart(ctxZone, {
    type: 'doughnut',
    data: {
      labels: ['Low (< 5x)', 'Medium (5x-15x)', 'High (15x-30x)', 'Extreme (>= 30x)'],
      datasets: [{
        data: [zoneCounts.low, zoneCounts.medium, zoneCounts.high, zoneCounts.extreme],
        backgroundColor: [
          colors.green.solid,
          colors.indigo.solid,
          colors.amber.solid,
          colors.rose.solid
        ],
        borderWidth: 0,
        cutout: '70%'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 12 } },
        tooltip: { padding: 12 }
      }
    }
  });
}

/* ==========================================================================
   INTERACTIVE GRID & TABLE EXPLORER
   ========================================================================== */

/**
 * Filter and sort dataset based on input state
 */
function applyFiltersAndSort() {
  const searchQuery = document.getElementById('explorerSearchInput').value.toLowerCase().trim();
  const company = document.getElementById('filterCompanySelect').value;
  const location = document.getElementById('filterLocationSelect').value;
  const maxRatio = parseFloat(document.getElementById('filterRatioRange').value);
  const sortOption = document.getElementById('sortFieldSelect').value;

  state.filteredItems = state.rawItems.filter(item => {
    // 1. Text Search matches title, fungsi, detail, company
    const matchesSearch = !searchQuery || 
      item.title.toLowerCase().includes(searchQuery) ||
      item.fungsi.toLowerCase().includes(searchQuery) ||
      item.detail.toLowerCase().includes(searchQuery) ||
      item.company.toLowerCase().includes(searchQuery) ||
      item.location.toLowerCase().includes(searchQuery);

    // 2. Company filter
    const matchesCompany = !company || item.company === company;

    // 3. Location filter
    const matchesLocation = !location || item.location === location;

    // 4. Ratio range filter
    const matchesRatio = item.rasio <= maxRatio;

    return matchesSearch && matchesCompany && matchesLocation && matchesRatio;
  });

  // Apply Sorting
  const [field, direction] = sortOption.split('-');
  state.filteredItems.sort((a, b) => {
    let valA = a[field];
    let valB = b[field];
    
    // Sort strings case insensitively
    if (typeof valA === 'string') {
      return direction === 'asc' 
        ? valA.localeCompare(valB)
        : valB.localeCompare(valA);
    }
    
    return direction === 'asc' ? valA - valB : valB - valA;
  });

  // Calculate stats based on new filtered subset
  calculateKPIs();

  state.currentPage = 1; // Reset to page 1
  renderExplorer();
}

/**
 * Renders the paginated Explorer results list
 */
function renderExplorer() {
  const gridView = document.getElementById('resultsGridView');
  const tableView = document.getElementById('resultsTableView');
  const tableBody = document.getElementById('resultsTableBody');
  const emptyState = document.getElementById('explorerEmptyState');
  const paginationWrapper = document.getElementById('paginationWrapper');

  const countText = `${state.filteredItems.length} program${state.filteredItems.length === 1 ? '' : 's'} matching`;
  document.getElementById('filteredCountText').textContent = countText;

  if (state.filteredItems.length === 0) {
    gridView.innerHTML = '';
    tableBody.innerHTML = '';
    emptyState.style.display = 'flex';
    paginationWrapper.style.display = 'none';
    return;
  }

  emptyState.style.display = 'none';
  paginationWrapper.style.display = 'flex';

  // Pagination logic
  const startIndex = (state.currentPage - 1) * state.itemsPerPage;
  const endIndex = Math.min(startIndex + state.itemsPerPage, state.filteredItems.length);
  const paginatedItems = state.filteredItems.slice(startIndex, endIndex);

  // Render Grid Cards
  gridView.innerHTML = '';
  paginatedItems.forEach(item => {
    gridView.appendChild(createJobCard(item));
  });

  // Render Table Rows
  tableBody.innerHTML = '';
  paginatedItems.forEach(item => {
    tableBody.appendChild(createTableRow(item));
  });

  // Recreate lucide icons for newly inserted nodes
  lucide.createIcons();

  // Render pagination buttons
  renderPagination();
}

/**
 * Creates card DOM node for a single internship
 */
function createJobCard(item) {
  const isSaved = state.favorites.includes(item.originalTitle);
  const card = document.createElement('div');
  card.className = 'job-card';
  card.dataset.id = item.id;

  const bucket = getCompetitionBucket(item.rasio);
  const bucketLabels = {
    low: 'Low Competition',
    medium: 'Moderate Comp.',
    high: 'High Comp.',
    extreme: 'Extreme Comp.'
  };

  const compLabel = bucketLabels[bucket];

  card.innerHTML = `
    <div class="card-header-row">
      <span class="company-tag ${getCompanyClass(item.company)}" title="${item.company}">
        ${item.company.replace("PT Pertamina ", "")}
      </span>
      <button class="bookmark-btn ${isSaved ? 'saved' : ''}" data-title="${item.originalTitle}" aria-label="Bookmark Program">
        <i data-lucide="bookmark"></i>
      </button>
    </div>
    <h3 class="job-title" title="${item.title}">${item.title}</h3>
    <div class="job-details">
      <div class="detail-item">
        <i data-lucide="map-pin"></i>
        <span>${item.location}</span>
      </div>
      <div class="detail-item">
        <i data-lucide="calendar"></i>
        <span>${item.date}</span>
      </div>
    </div>
    <div class="card-stats">
      <div class="stat-item">
        <span class="stat-val">${item.posisi}</span>
        <span class="stat-lbl">Slots</span>
      </div>
      <div class="stat-item">
        <span class="stat-val">${item.pelamar}</span>
        <span class="stat-lbl">Applicants</span>
      </div>
      <div class="stat-item">
        <span class="stat-val">${item.rasio.toFixed(1)}x</span>
        <span class="stat-lbl">Ratio</span>
      </div>
    </div>
    <div class="ratio-severity ${bucket}">
      <i data-lucide="shield-alert"></i>
      <span>${compLabel}</span>
    </div>
  `;

  // Bind Bookmark Toggle
  card.querySelector('.bookmark-btn').addEventListener('click', function(e) {
    e.stopPropagation();
    toggleBookmark(item.originalTitle);
  });

  return card;
}

/**
 * Creates table row DOM node for list view
 */
function createTableRow(item) {
  const isSaved = state.favorites.includes(item.originalTitle);
  const tr = document.createElement('tr');
  tr.dataset.id = item.id;

  const bucket = getCompetitionBucket(item.rasio);

  tr.innerHTML = `
    <td>
      <div class="table-title-cell">
        <span class="table-title">${item.title}</span>
        <span class="table-company">${item.company}</span>
      </div>
    </td>
    <td>
      <span class="text-secondary">${item.location}</span>
    </td>
    <td class="text-right font-display" style="font-weight:600;">
      ${item.posisi}
    </td>
    <td class="text-right font-display" style="font-weight:600;">
      ${item.pelamar}
    </td>
    <td class="text-center">
      <span class="table-ratio-badge ${bucket}">
        ${item.rasio.toFixed(1)}x
      </span>
    </td>
    <td class="text-center">
      <button class="bookmark-btn ${isSaved ? 'saved' : ''}" data-title="${item.originalTitle}" style="margin: 0 auto;" aria-label="Bookmark Program">
        <i data-lucide="bookmark"></i>
      </button>
    </td>
  `;

  tr.querySelector('.bookmark-btn').addEventListener('click', function(e) {
    e.stopPropagation();
    toggleBookmark(item.originalTitle);
  });

  return tr;
}

function getCompanyClass(companyName) {
  if (companyName.includes("Patra Niaga")) return 'patra-niaga';
  if (companyName.includes("Patra Jasa")) return 'patra-jasa';
  if (companyName.includes("Gas")) return 'gas';
  if (companyName.includes("Trans Kontinental")) return 'trans-kontinental';
  return '';
}

/**
 * Renders pagination controls dynamically
 */
function renderPagination() {
  const container = document.getElementById('paginationPagesContainer');
  container.innerHTML = '';

  const totalPages = Math.ceil(state.filteredItems.length / state.itemsPerPage);
  if (totalPages <= 1) {
    container.innerHTML = '';
    return;
  }

  // Previous page button
  const prevBtn = document.createElement('button');
  prevBtn.className = 'page-btn';
  prevBtn.innerHTML = '<i data-lucide="chevron-left"></i>';
  prevBtn.disabled = state.currentPage === 1;
  prevBtn.addEventListener('click', () => {
    if (state.currentPage > 1) {
      state.currentPage--;
      renderExplorer();
      scrollToResults();
    }
  });
  container.appendChild(prevBtn);

  // Page Numbers (showing max 5 around current page)
  let startPage = Math.max(1, state.currentPage - 2);
  let endPage = Math.min(totalPages, startPage + 4);
  
  if (endPage - startPage < 4) {
    startPage = Math.max(1, endPage - 4);
  }

  for (let i = startPage; i <= endPage; i++) {
    const pageBtn = document.createElement('button');
    pageBtn.className = `page-btn ${state.currentPage === i ? 'active' : ''}`;
    pageBtn.textContent = i;
    pageBtn.addEventListener('click', () => {
      state.currentPage = i;
      renderExplorer();
      scrollToResults();
    });
    container.appendChild(pageBtn);
  }

  // Next page button
  const nextBtn = document.createElement('button');
  nextBtn.className = 'page-btn';
  nextBtn.innerHTML = '<i data-lucide="chevron-right"></i>';
  nextBtn.disabled = state.currentPage === totalPages;
  nextBtn.addEventListener('click', () => {
    if (state.currentPage < totalPages) {
      state.currentPage++;
      renderExplorer();
      scrollToResults();
    }
  });
  container.appendChild(nextBtn);
}

function scrollToResults() {
  document.querySelector('.filter-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ==========================================================================
   BOOKMARKS & SAVED COMPARISONS
   ========================================================================== */

function loadBookmarks() {
  const saved = localStorage.getItem('pertamina_saved_roles');
  state.favorites = saved ? JSON.parse(saved) : [];
  updateBookmarkBadge();
}

function saveBookmarks() {
  localStorage.setItem('pertamina_saved_roles', JSON.stringify(state.favorites));
  updateBookmarkBadge();
}

function updateBookmarkBadge() {
  const badge = document.getElementById('bookmarkCountBadge');
  if (badge) {
    badge.textContent = state.favorites.length;
    badge.style.display = state.favorites.length > 0 ? 'inline-block' : 'none';
  }
}

/**
 * Add or remove program title from bookmarks
 */
function toggleBookmark(originalTitle) {
  const index = state.favorites.indexOf(originalTitle);
  if (index === -1) {
    state.favorites.push(originalTitle);
    showToast('Role saved to comparison sheet.', 'success');
  } else {
    state.favorites.splice(index, 1);
    showToast('Role removed from comparison sheet.', 'info');
  }
  saveBookmarks();
  
  // Re-render Explorer lists to update bookmarks active statuses
  renderExplorer();
  
  // Update saved comparison view
  renderFavorites();
}

/**
 * Render the side-by-side comparison screen
 */
function renderFavorites() {
  const board = document.getElementById('comparisonBoard');
  const emptyState = document.getElementById('favoritesEmptyState');

  // Filter items in rawItems that match saved titles
  const savedItems = state.rawItems.filter(item => state.favorites.includes(item.originalTitle));

  if (savedItems.length === 0) {
    board.innerHTML = '';
    board.style.display = 'none';
    emptyState.style.display = 'flex';
    return;
  }

  emptyState.style.display = 'none';
  board.style.display = 'grid';
  board.innerHTML = '';

  // Find the lowest competition ratio item (most favorable) to tag it
  let lowestRatio = Infinity;
  let lowestItem = null;
  
  if (savedItems.length > 1) {
    savedItems.forEach(item => {
      if (item.rasio < lowestRatio) {
        lowestRatio = item.rasio;
        lowestItem = item;
      }
    });
  }

  savedItems.forEach(item => {
    const isLowest = lowestItem && item.id === lowestItem.id;
    const card = document.createElement('div');
    card.className = `compare-card ${isLowest ? 'most-favorable' : ''}`;
    
    // Calculate a competition gauge width (cap at 100% for ratio >= 50)
    const gaugeWidth = Math.min(100, (item.rasio / 50) * 100);
    const bucket = getCompetitionBucket(item.rasio);

    card.innerHTML = `
      ${isLowest ? '<div class="favorable-badge">Highly Recommended</div>' : ''}
      <button class="remove-compare-btn" title="Remove from list" data-title="${item.originalTitle}">
        <i data-lucide="x"></i>
      </button>
      <span class="compare-company">${item.company}</span>
      <h4 class="compare-title" title="${item.title}">${item.title}</h4>
      
      <div class="compare-stat-row">
        <span class="compare-stat-label">Location</span>
        <span class="compare-stat-value">${item.location}</span>
      </div>
      <div class="compare-stat-row">
        <span class="compare-stat-label">Target Openings</span>
        <span class="compare-stat-value">${item.posisi}</span>
      </div>
      <div class="compare-stat-row">
        <span class="compare-stat-label">Total Applicants</span>
        <span class="compare-stat-value">${item.pelamar}</span>
      </div>
      <div class="compare-stat-row">
        <span class="compare-stat-label">Competition Ratio</span>
        <span class="compare-stat-value" style="color: var(--color-primary); font-weight:700;">
          ${item.rasio.toFixed(1)}x
        </span>
      </div>
      
      <div class="compare-gauge-wrapper">
        <div class="gauge-title">
          <span>Competition Heat</span>
          <span style="font-weight: 700;">${item.rasio.toFixed(0)}x</span>
        </div>
        <div class="gauge-bar-outer">
          <div class="gauge-bar-inner ${bucket}" style="width: ${gaugeWidth}%; background-color: var(--color-${bucket === 'low' ? 'success' : bucket === 'medium' ? 'info' : bucket === 'high' ? 'warning' : 'danger'});"></div>
        </div>
      </div>
    `;

    card.querySelector('.remove-compare-btn').addEventListener('click', () => {
      toggleBookmark(item.originalTitle);
    });

    board.appendChild(card);
  });

  lucide.createIcons();
}

/* ==========================================================================
   UI NAVIGATION & EVENT HANDLERS
   ========================================================================== */

function bindEvents() {
  // Navigation tabs handler
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.target;
      
      // Update sidebar highlight
      navItems.forEach(n => n.classList.remove('active'));
      btn.classList.add('active');

      // Toggle active section container
      document.querySelectorAll('.content-section').forEach(sec => {
        sec.classList.remove('active');
        if (sec.id === target) {
          sec.classList.add('active');
        }
      });

      // Update Top Header titles dynamically
      const titleEl = document.getElementById('pageTitleHeading');
      const subEl = document.getElementById('pageSubTitleHeading');

      if (target === 'dashboard-section') {
        titleEl.textContent = 'Internship Analytics';
        subEl.textContent = 'Overview of the 2026 PT Pertamina (Persero) recruitment season.';
      } else if (target === 'explorer-section') {
        titleEl.textContent = 'Program Explorer';
        subEl.textContent = 'Search and filter active positions by subsidiary, location, and applicant ratio.';
      } else if (target === 'matcher-section') {
        titleEl.textContent = 'AI CV Matcher';
        subEl.textContent = 'Upload your CV and let AI find the most suitable roles for your background.';
      } else if (target === 'favorites-section') {
        titleEl.textContent = 'My Saved List';
        subEl.textContent = 'Compare your saved roles to find your best fit.';
      }

      // Close mobile sidebar if open
      document.getElementById('appSidebar').classList.remove('active');
    });
  });

  // Mobile sidebar burger toggle with backdrop overlay
  const burger = document.getElementById('mobileSidebarToggle');
  const sidebar = document.getElementById('appSidebar');
  const backdrop = document.getElementById('sidebarBackdrop');

  function openSidebar() {
    sidebar.classList.add('open');
    backdrop.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeSidebar() {
    sidebar.classList.remove('open');
    backdrop.classList.remove('active');
    document.body.style.overflow = '';
  }

  if (burger && sidebar) {
    burger.addEventListener('click', () => {
      sidebar.classList.contains('open') ? closeSidebar() : openSidebar();
    });
  }

  if (backdrop) {
    backdrop.addEventListener('click', closeSidebar);
  }

  // Close sidebar when a nav item is clicked on mobile
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      if (window.innerWidth <= 768) closeSidebar();
    });
  });

  // Theme Toggler Event
  document.getElementById('themeToggleBtn').addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('pertamina_theme', newTheme);
    
    // Refresh graphs to adapt colors
    initOrUpdateCharts();
    showToast(`Switched to ${newTheme} mode.`, 'info');
  });

  // Layout View Switcher
  const gridBtn = document.getElementById('layoutGridBtn');
  const tableBtn = document.getElementById('layoutTableBtn');
  const gridView = document.getElementById('resultsGridView');
  const tableView = document.getElementById('resultsTableView');

  gridBtn.addEventListener('click', () => {
    gridBtn.classList.add('active');
    tableBtn.classList.remove('active');
    gridView.classList.add('active');
    tableView.classList.remove('active');
    state.layoutView = 'grid';
  });

  tableBtn.addEventListener('click', () => {
    tableBtn.classList.add('active');
    gridBtn.classList.remove('active');
    tableView.classList.add('active');
    gridView.classList.remove('active');
    state.layoutView = 'table';
  });

  // Filter change handlers (Search, dropdowns, ranges)
  let searchTimeout = null;
  document.getElementById('explorerSearchInput').addEventListener('input', () => {
    // Debounce search requests
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      applyFiltersAndSort();
    }, 250);
  });

  document.getElementById('filterCompanySelect').addEventListener('change', applyFiltersAndSort);
  document.getElementById('filterLocationSelect').addEventListener('change', applyFiltersAndSort);
  
  const ratioSlider = document.getElementById('filterRatioRange');
  ratioSlider.addEventListener('input', (e) => {
    const val = parseInt(e.target.value);
    document.getElementById('ratioValueLabel').textContent = val === 500 ? 'Any' : `< ${val}x`;
    applyFiltersAndSort();
  });

  document.getElementById('sortFieldSelect').addEventListener('change', applyFiltersAndSort);

  // Clear filters
  document.getElementById('clearFiltersBtn').addEventListener('click', () => {
    document.getElementById('explorerSearchInput').value = '';
    document.getElementById('filterCompanySelect').value = '';
    document.getElementById('filterLocationSelect').value = '';
    document.getElementById('filterRatioRange').value = 500;
    document.getElementById('ratioValueLabel').textContent = 'Any';
    document.getElementById('sortFieldSelect').value = 'rasio-desc';
    applyFiltersAndSort();
    showToast('Filters cleared.', 'info');
  });

  document.getElementById('resetExplorerFiltersBtn').addEventListener('click', () => {
    document.getElementById('clearFiltersBtn').click();
  });

  // Favorites Panel triggers
  document.getElementById('goToExplorerBtn').addEventListener('click', () => {
    document.getElementById('navExplorer').click();
  });

  document.getElementById('clearAllFavoritesBtn').addEventListener('click', () => {
    if (state.favorites.length === 0) return;
    if (confirm('Are you sure you want to clear your saved list?')) {
      state.favorites = [];
      saveBookmarks();
      renderExplorer();
      renderFavorites();
      showToast('All saved items cleared.', 'info');
    }
  });

  // Items per page selector
  document.getElementById('itemsPerPageSelect').addEventListener('change', (e) => {
    state.itemsPerPage = parseInt(e.target.value);
    state.currentPage = 1;
    renderExplorer();
  });

  // CSV File Upload selector
  document.getElementById('csvFileInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(evt) {
      processAndInitData(evt.target.result);
      // Reset input value so same file can be uploaded again
      e.target.value = '';
    };
    reader.readAsText(file);
  });

  // Reset to original data button
  document.getElementById('resetDataBtn').addEventListener('click', () => {
    if (confirm('Reset dashboard back to the original Pertamina 2026 dataset?')) {
      processAndInitData(state.originalCsvContent);
    }
  });
}

/**
 * Setup default color schemes on startup
 */
function initTheme() {
  const savedTheme = localStorage.getItem('pertamina_theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
}

/* ==========================================================================
   TOAST NOTIFICATION COMPONENT
   ========================================================================= */

function showToast(message, type = 'success') {
  // Check if toast-container exists, else create
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  // Create toast element
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  const icon = type === 'success' ? 'check-circle' : type === 'info' ? 'info' : 'alert-triangle';

  toast.innerHTML = `
    <i data-lucide="${icon}" class="toast-icon ${type}"></i>
    <span>${message}</span>
  `;

  container.appendChild(toast);
  lucide.createIcons();

  // Animation removal after 3.5s
  setTimeout(() => {
    toast.style.animation = 'slideIn 0.3s reverse forwards';
    toast.addEventListener('animationend', () => {
      toast.remove();
      if (container && container.childNodes.length === 0) {
        container.remove();
      }
    });
  }, 3500);
}

/* ==========================================================================
   AI CV MATCHER & RECOMMENDATION LOGIC
   ========================================================================== */

function loadApiKey() {
  state.geminiApiKey = localStorage.getItem('pertamina_gemini_api_key') || '';
  updateAiStatusBanner();
}

function updateAiStatusBanner() {
  const banner = document.getElementById('aiStatusBanner');
  const icon = document.getElementById('aiStatusIcon');
  const title = document.getElementById('aiStatusTitle');
  const desc = document.getElementById('aiStatusDesc');
  
  if (!banner || !icon || !title || !desc) return;

  if (state.geminiApiKey) {
    banner.classList.add('active');
    icon.setAttribute('data-lucide', 'cpu');
    if (state.geminiApiKey.startsWith('gsk_')) {
      title.textContent = 'Groq AI Engine Activated';
      desc.textContent = 'Llama 3.3 model active via Groq Cloud. Ready to match CV.';
    } else {
      title.textContent = 'Gemini AI Engine Activated';
      desc.textContent = 'Gemini 1.5 Flash model active. Ready to match CV.';
    }
  } else {
    banner.classList.remove('active');
    icon.setAttribute('data-lucide', 'cpu');
    title.textContent = 'Local Recommendation Engine';
    desc.textContent = 'No API key found. Using local heuristic keyword model.';
  }
  lucide.createIcons();
}

// Taxonomy mapping for local heuristics
const taxonomy = {
  it: {
    name: "IT, Data & Software Engineering",
    icon: "terminal",
    keywords: ['it', 'developer', 'programming', 'software', 'cyber', 'security', 'network', 'data', 'analytics', 'python', 'sql', 'javascript', 'cloud', 'system', 'digital', 'database', 'web', 'forensic', 'ict', 'hub', 'ccus', 'information technology', 'computer', 'code', 'artificial', 'intelligence', 'ai', 'ml', 'machine learning', 'dashboard'],
    targets: ['it', 'digital', 'cyber', 'ict', 'data', 'software', 'technology', 'system', 'programming', 'forensic', 'telecommunication', 'computer']
  },
  hr: {
    name: "Human Resources & Training",
    icon: "users",
    keywords: ['sdm', 'hc', 'hr', 'human capital', 'resources', 'payroll', 'recruitment', 'training', 'people', 'employee', 'services', 'learning', 'culture', 'competency', 'career', 'organization', 'talent', 'industrial relation', 'hrbp', 'psikologi', 'psychology'],
    targets: ['sdm', 'human capital', 'hc', 'payroll', 'recruitment', 'training', 'employee', 'learning', 'culture', 'competency', 'relation']
  },
  finance: {
    name: "Finance, Accounting & Audit",
    icon: "wallet",
    keywords: ['finance', 'accounting', 'tax', 'billing', 'invoice', 'treasury', 'budget', 'audit', 'investor', 'investment', 'revenue', 'economic', 'financial', 'pajak', 'akuntansi', 'keuangan', 'fiscal', 'cost', 'cash', 'ledger'],
    targets: ['keuangan', 'finance', 'tax', 'treasury', 'audit', 'controller', 'billing', 'invoice', 'investment', 'accountant', 'pajak']
  },
  legal: {
    name: "Legal, Compliance & Policy",
    icon: "gavel",
    keywords: ['legal', 'law', 'compliance', 'ethics', 'governance', 'policy', 'advocacy', 'contract', 'hukum', 'peraturan', 'advokat', 'litigasi', 'somasi', 'sarjana hukum', 'sh'],
    targets: ['legal', 'compliance', 'ethics', 'policy', 'governance', 'advocacy', 'legal counsel']
  },
  engineering: {
    name: "Engineering, Asset & Operations",
    icon: "settings",
    keywords: ['engineering', 'geothermal', 'drilling', 'production', 'operations', 'technical', 'maintenance', 'reliability', 'integrity', 'asset', 'fleet', 'marine', 'shipping', 'waste', 'safety', 'facility', 'ship', 'pipeline', 'refinery', 'energy', 'kimia', 'mesin', 'sipil', 'industri', 'elektro'],
    targets: ['geothermal', 'drilling', 'fleet', 'ship', 'production', 'engineering', 'operation', 'asset', 'integrity', 'reliability', 'refinery']
  },
  hsse: {
    name: "HSSE & Safety Management",
    icon: "shield-alert",
    keywords: ['hsse', 'safety', 'environment', 'health', 'k3', 'security', 'wbs', 'ercm', 'surveillance', 'keamanan', 'keselamatan', 'lingkungan', 'hukum lingkungan', 'healt', 'hygiene'],
    targets: ['hsse', 'safety', 'environment', 'health', 'wbs', 'security', 'keselamatan', 'keamanan']
  },
  logistics: {
    name: "Logistics & Supply Chain",
    icon: "truck",
    keywords: ['logistik', 'logistics', 'procurement', 'supply', 'chain', 'scheduling', 'purchasing', 'vendor', 'inventory', 'local content', 'quantity', 'quality control', 'assurance', 's&d', 'distribution', 'warehouse', 'freight'],
    targets: ['logistik', 'procurement', 'supply chain', 'scheduling', 'quantity assurance', 'quality control', 'distribution']
  },
  business: {
    name: "Business Strategy & Marketing",
    icon: "presentation",
    keywords: ['business', 'strategy', 'marketing', 'sales', 'development', 'relationship', 'partnership', 'market', 'investor', 'commercial', 'rating', 'disclosure', 'transformation', 'optimization', 'sustainability', 'keberlanjutan', 'csr', 'pmo', 'manajemen', 'management'],
    targets: ['business', 'strategy', 'marketing', 'sales', 'commercial', 'transformation', 'sustainability', 'optimization', 'partnership']
  }
};

function runHeuristicMatching(cvText) {
  const normalizedCV = cvText.toLowerCase();
  
  // 1. Identify primary domain score
  const domainScores = {};
  Object.keys(taxonomy).forEach(key => {
    let score = 0;
    taxonomy[key].keywords.forEach(kw => {
      const regex = new RegExp('\\b' + kw.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + '\\b', 'g');
      const matches = normalizedCV.match(regex);
      if (matches) {
        score += matches.length * 2;
      } else if (normalizedCV.includes(kw)) {
        score += 1;
      }
    });
    domainScores[key] = score;
  });
  
  let topDomainKey = 'business';
  let maxDomainScore = -1;
  Object.keys(domainScores).forEach(key => {
    if (domainScores[key] > maxDomainScore) {
      maxDomainScore = domainScores[key];
      topDomainKey = key;
    }
  });
  
  const matchedDomain = taxonomy[topDomainKey];
  
  // 2. Score all roles
  const scoredRoles = state.rawItems.map(role => {
    let score = 0;
    let matchedKeywords = [];
    
    const roleText = (role.title + ' ' + role.fungsi + ' ' + role.company).toLowerCase();
    
    const cvWords = normalizedCV.split(/[^a-zA-Z0-9]/).filter(w => w.length > 3);
    const uniqueCVWords = [...new Set(cvWords)];
    
    uniqueCVWords.forEach(word => {
      if (roleText.includes(word)) {
        if (matchedDomain.keywords.includes(word)) {
          score += 6;
          matchedKeywords.push(word);
        } else {
          score += 1;
        }
      }
    });
    
    let isDomainMatch = false;
    matchedDomain.targets.forEach(tgt => {
      if (roleText.includes(tgt)) {
        isDomainMatch = true;
      }
    });
    
    if (isDomainMatch) {
      score += 30;
    }
    
    const relevance = Math.min(100, score * 1.5);
    const ratioScore = Math.max(0, 100 * (1 - Math.min(1, (role.rasio - 1) / 39))); 
    const finalScore = Math.round((relevance * 0.7) + (ratioScore * 0.3));
    
    matchedKeywords = [...new Set(matchedKeywords)].slice(0, 5);
    
    const justification = `CV Anda menunjukkan keahlian di bidang ${matchedKeywords.join(', ') || 'terkait'} yang relevan dengan fokus ${role.fungsi}. Posisi di ${role.company} ini menawarkan kecocokan karir yang baik dengan rasio kompetisi pelamar (${role.rasio}x) yang tergolong wajar.`;

    return {
      ...role,
      matchScore: finalScore,
      matchedKeywords: matchedKeywords,
      justification: justification
    };
  });
  
  const topRecommendations = scoredRoles
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 5);
    
  return {
    domainName: matchedDomain.name,
    domainIcon: matchedDomain.icon,
    matchedKeywords: [...new Set(scoredRoles.flatMap(r => r.matchedKeywords))].slice(0, 10),
    recommendations: topRecommendations
  };
}

async function runGeminiMatching(cvText, apiKey) {
  // Extract local candidates first (top 35) to optimize prompt size
  const localMatching = runHeuristicMatching(cvText);
  const localCandidateIds = localMatching.recommendations.map(r => r.id);
  
  const candidatePool = state.rawItems
    .map(role => ({
      id: role.id,
      title: role.title,
      company: role.company,
      location: role.location,
      posisi: role.posisi,
      pelamar: role.pelamar,
      rasio: role.rasio
    }));

  const localCandidates = candidatePool.filter(r => localCandidateIds.includes(r.id));
  const otherCandidates = candidatePool.filter(r => !localCandidateIds.includes(r.id)).slice(0, 25);
  const promptCandidates = [...localCandidates, ...otherCandidates];

  const prompt = `
You are a professional HR career match counselor at PT Pertamina (Persero).
You must analyze the candidate's resume (CV) and match them with the best 5 internship roles from the provided list.
To maximize their chance of acceptance, prioritize roles where they have a high skill match AND the competition ratio (applicant-to-position "rasio") is relatively lower.

Candidate Resume (CV):
"""
${cvText}
"""

List of Available Internship Roles (JSON):
${JSON.stringify(promptCandidates)}

Select exactly the top 5 most suitable roles.
Response MUST be a valid JSON array of objects with the exact schema below, and no other text or markdown formatting (Do NOT enclose in \`\`\`json).
[
  {
    "id": "role-id",
    "score": 92,
    "rationale": "Justifikasi dalam bahasa Indonesia (2 kalimat). Kalimat pertama menjelaskan kecocokan CV dengan posisi magang ini. Kalimat kedua memberikan tips konkret melamar untuk posisi ini."
  }
]
`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json'
      }
    })
  });

  if (!response.ok) {
    throw new Error(`Google API returned status ${response.status}. Please check your API Key.`);
  }

  const data = await response.json();
  if (!data.candidates || data.candidates.length === 0) {
    throw new Error('No recommendations generated by AI.');
  }

  const responseText = data.candidates[0].content.parts[0].text;
  const parsedRecs = JSON.parse(responseText);

  const finalRecommendations = parsedRecs.map(rec => {
    const roleRecord = state.rawItems.find(r => r.id === rec.id);
    if (!roleRecord) return null;
    
    // Find matched words
    const cvWords = cvText.toLowerCase().split(/[^a-zA-Z0-9]/);
    const titleLower = roleRecord.title.toLowerCase();
    const matched = [];
    cvWords.forEach(w => {
      if (w.length > 3 && titleLower.includes(w)) {
        matched.push(w);
      }
    });

    return {
      ...roleRecord,
      matchScore: rec.score,
      justification: rec.rationale,
      matchedKeywords: [...new Set(matched)].slice(0, 5)
    };
  }).filter(r => r !== null);

  return {
    domainName: localMatching.domainName,
    domainIcon: localMatching.domainIcon,
    matchedKeywords: localMatching.matchedKeywords,
    recommendations: finalRecommendations
  };
}

async function runGroqMatching(cvText, apiKey) {
  const localMatching = runHeuristicMatching(cvText);
  const localCandidateIds = localMatching.recommendations.map(r => r.id);
  
  const candidatePool = state.rawItems
    .map(role => ({
      id: role.id,
      title: role.title,
      company: role.company,
      location: role.location,
      posisi: role.posisi,
      pelamar: role.pelamar,
      rasio: role.rasio
    }));

  const localCandidates = candidatePool.filter(r => localCandidateIds.includes(r.id));
  const otherCandidates = candidatePool.filter(r => !localCandidateIds.includes(r.id)).slice(0, 25);
  const promptCandidates = [...localCandidates, ...otherCandidates];

  const prompt = `
You are a professional HR career match counselor at PT Pertamina (Persero).
You must analyze the candidate's resume (CV) and match them with the best 5 internship roles from the provided list.
To maximize their chance of acceptance, prioritize roles where they have a high skill match AND the competition ratio (applicant-to-position "rasio") is relatively lower.

Candidate Resume (CV):
"""
${cvText}
"""

List of Available Internship Roles (JSON):
${JSON.stringify(promptCandidates)}

Select exactly the top 5 most suitable roles.
Response MUST be a valid JSON array of objects with the exact schema below, and no other text or markdown formatting (Do NOT enclose in \`\`\`json).
[
  {
    "id": "role-id",
    "score": 92,
    "rationale": "Justifikasi dalam bahasa Indonesia (2 kalimat). Kalimat pertama menjelaskan kecocokan CV dengan posisi magang ini. Kalimat kedua memberikan tips konkret melamar untuk posisi ini."
  }
]
`;

  const url = 'https://api.groq.com/openai/v1/chat/completions';
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: {
        type: "json_object"
      },
      temperature: 0.3
    })
  });

  if (!response.ok) {
    throw new Error(`Groq API returned status ${response.status}. Please check your API Key.`);
  }

  const data = await response.json();
  const responseText = data.choices[0].message.content;
  
  let parsedRecs = JSON.parse(responseText);
  if (!Array.isArray(parsedRecs) && parsedRecs.recommendations) {
    parsedRecs = parsedRecs.recommendations;
  } else if (!Array.isArray(parsedRecs) && typeof parsedRecs === 'object') {
    const keys = Object.keys(parsedRecs);
    if (keys.length === 1 && Array.isArray(parsedRecs[keys[0]])) {
      parsedRecs = parsedRecs[keys[0]];
    }
  }

  if (!Array.isArray(parsedRecs)) {
    throw new Error('Format respon AI dari Groq tidak valid.');
  }

  const finalRecommendations = parsedRecs.map(rec => {
    const roleRecord = state.rawItems.find(r => r.id === rec.id);
    if (!roleRecord) return null;
    
    const cvWords = cvText.toLowerCase().split(/[^a-zA-Z0-9]/);
    const titleLower = roleRecord.title.toLowerCase();
    const matched = [];
    cvWords.forEach(w => {
      if (w.length > 3 && titleLower.includes(w)) {
        matched.push(w);
      }
    });

    return {
      ...roleRecord,
      matchScore: rec.score,
      justification: rec.rationale,
      matchedKeywords: [...new Set(matched)].slice(0, 5)
    };
  }).filter(r => r !== null);

  return {
    domainName: localMatching.domainName,
    domainIcon: localMatching.domainIcon,
    matchedKeywords: localMatching.matchedKeywords,
    recommendations: finalRecommendations
  };
}

async function runProxyMatching(cvText) {
  const localMatching = runHeuristicMatching(cvText);
  const localCandidateIds = localMatching.recommendations.map(r => r.id);
  
  const candidatePool = state.rawItems
    .map(role => ({
      id: role.id,
      title: role.title,
      company: role.company,
      location: role.location,
      posisi: role.posisi,
      pelamar: role.pelamar,
      rasio: role.rasio
    }));

  const localCandidates = candidatePool.filter(r => localCandidateIds.includes(r.id));
  const otherCandidates = candidatePool.filter(r => !localCandidateIds.includes(r.id)).slice(0, 25);
  const promptCandidates = [...localCandidates, ...otherCandidates];

  const response = await fetch('/api/match', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      cvText: cvText,
      candidateRoles: promptCandidates
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMsg = errorData.error || `Server returned status ${response.status}`;
    throw new Error(errorMsg);
  }

  const data = await response.json();
  const responseText = data.choices[0].message.content;
  
  let parsedRecs = JSON.parse(responseText);
  if (!Array.isArray(parsedRecs) && parsedRecs.recommendations) {
    parsedRecs = parsedRecs.recommendations;
  } else if (!Array.isArray(parsedRecs) && typeof parsedRecs === 'object') {
    const keys = Object.keys(parsedRecs);
    if (keys.length === 1 && Array.isArray(parsedRecs[keys[0]])) {
      parsedRecs = parsedRecs[keys[0]];
    }
  }

  if (!Array.isArray(parsedRecs)) {
    throw new Error('Format respon AI tidak valid.');
  }

  const finalRecommendations = parsedRecs.map(rec => {
    const roleRecord = state.rawItems.find(r => r.id === rec.id);
    if (!roleRecord) return null;
    
    const cvWords = cvText.toLowerCase().split(/[^a-zA-Z0-9]/);
    const titleLower = roleRecord.title.toLowerCase();
    const matched = [];
    cvWords.forEach(w => {
      if (w.length > 3 && titleLower.includes(w)) {
        matched.push(w);
      }
    });

    return {
      ...roleRecord,
      matchScore: rec.score,
      justification: rec.rationale,
      matchedKeywords: [...new Set(matched)].slice(0, 5)
    };
  }).filter(r => r !== null);

  return {
    domainName: localMatching.domainName,
    domainIcon: localMatching.domainIcon,
    matchedKeywords: localMatching.matchedKeywords,
    recommendations: finalRecommendations
  };
}

// PDF reader helper using PDFJS
async function readResumeFile(file) {
  // Set worker
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

  const reader = new FileReader();
  return new Promise((resolve, reject) => {
    reader.onload = async (e) => {
      const content = e.target.result;
      
      if (file.name.endsWith('.pdf')) {
        try {
          const typedarray = new Uint8Array(content);
          const pdf = await pdfjsLib.getDocument(typedarray).promise;
          let extracted = '';
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join(' ');
            extracted += pageText + '\n';
          }
          resolve(extracted);
        } catch (err) {
          reject(new Error('Gagal membaca PDF. Pastikan file PDF tidak terenkripsi/corrupt.'));
        }
      } else if (file.name.endsWith('.docx')) {
        try {
          // Parse DOCX via Mammoth
          const result = await mammoth.extractRawText({ arrayBuffer: content });
          resolve(result.value);
        } catch (err) {
          reject(new Error('Gagal membaca file Word (.docx).'));
        }
      } else {
        resolve(content); // Text file content
      }
    };
    reader.onerror = () => reject(new Error('Gagal membaca file.'));
    
    if (file.name.endsWith('.pdf') || file.name.endsWith('.docx')) {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsText(file);
    }
  });
}

function initCvMatcher() {
  // Settings Modal Selectors
  const aiSettingsBtn = document.getElementById('aiSettingsBtn');
  const aiSettingsModal = document.getElementById('aiSettingsModal');
  const closeAiSettingsModalBtn = document.getElementById('closeAiSettingsModalBtn');
  const setupApiKeyBtn = document.getElementById('setupApiKeyBtn');
  const saveApiKeyBtn = document.getElementById('saveApiKeyBtn');
  const clearApiKeyBtn = document.getElementById('clearApiKeyBtn');
  const geminiApiKeyInput = document.getElementById('geminiApiKeyInput');

  if (!aiSettingsModal) return;

  const openModal = () => {
    geminiApiKeyInput.value = state.geminiApiKey;
    aiSettingsModal.classList.add('active');
  };
  
  const closeModal = () => {
    aiSettingsModal.classList.remove('active');
  };

  aiSettingsBtn.addEventListener('click', openModal);
  setupApiKeyBtn.addEventListener('click', openModal);
  closeAiSettingsModalBtn.addEventListener('click', closeModal);
  
  aiSettingsModal.addEventListener('click', (e) => {
    if (e.target === aiSettingsModal) closeModal();
  });

  saveApiKeyBtn.addEventListener('click', () => {
    const key = geminiApiKeyInput.value.trim();
    if (!key) {
      showToast('Please enter your API key.', 'warning');
      return;
    }
    if (!key.startsWith('AIzaSy') && !key.startsWith('AQ.') && !key.startsWith('gsk_')) {
      showToast('API Key tidak valid. Pastikan menyalin kode lengkap (diawali dengan "AIzaSy", "AQ.", atau "gsk_").', 'warning');
      return;
    }
    state.geminiApiKey = key;
    localStorage.setItem('pertamina_gemini_api_key', key);
    updateAiStatusBanner();
    closeModal();
    const providerName = key.startsWith('gsk_') ? 'Groq' : 'Gemini';
    showToast(`${providerName} API key saved successfully.`, 'success');
  });

  clearApiKeyBtn.addEventListener('click', () => {
    state.geminiApiKey = '';
    localStorage.removeItem('pertamina_gemini_api_key');
    geminiApiKeyInput.value = '';
    updateAiStatusBanner();
    closeModal();
    showToast('Gemini AI key cleared.', 'info');
  });

  // Drag Drop Selectors
  const cvDropZone = document.getElementById('cvDropZone');
  const resumeFileInput = document.getElementById('resumeFileInput');
  const fileInfoBadge = document.getElementById('fileInfoBadge');
  const fileNameText = document.getElementById('fileNameText');
  const fileSizeText = document.getElementById('fileSizeText');
  const removeFileBtn = document.getElementById('removeFileBtn');
  const cvTextarea = document.getElementById('cvTextarea');

  cvDropZone.addEventListener('click', () => {
    resumeFileInput.click();
  });

  resumeFileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) handleCvSelection(file);
  });

  // Drag over states
  ['dragenter', 'dragover'].forEach(name => {
    cvDropZone.addEventListener(name, (e) => {
      e.preventDefault();
      e.stopPropagation();
      cvDropZone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach(name => {
    cvDropZone.addEventListener(name, (e) => {
      e.preventDefault();
      e.stopPropagation();
      cvDropZone.classList.remove('dragover');
    });
  });

  cvDropZone.addEventListener('drop', (e) => {
    const file = e.dataTransfer.files[0];
    if (file) handleCvSelection(file);
  });

  removeFileBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    state.resumeText = '';
    state.resumeFileName = '';
    state.resumeFileSize = '';
    resumeFileInput.value = '';
    
    fileInfoBadge.style.display = 'none';
    cvDropZone.style.display = 'flex';
    cvTextarea.disabled = false;
    showToast('File removed.', 'info');
  });

  async function handleCvSelection(file) {
    if (file.size > 5 * 1024 * 1024) {
      showToast('File is too large (max 5MB).', 'warning');
      return;
    }
    
    if (!file.name.endsWith('.pdf') && !file.name.endsWith('.txt') && !file.name.endsWith('.docx')) {
      showToast('Only PDF, TXT, or DOCX files are supported.', 'warning');
      return;
    }

    fileNameText.textContent = 'Reading file...';
    fileSizeText.textContent = '';
    cvDropZone.style.display = 'none';
    fileInfoBadge.style.display = 'flex';

    try {
      const text = await readResumeFile(file);
      state.resumeText = text;
      state.resumeFileName = file.name;
      state.resumeFileSize = (file.size / 1024).toFixed(1) + ' KB';
      
      fileNameText.textContent = state.resumeFileName;
      fileSizeText.textContent = state.resumeFileSize;
      cvTextarea.disabled = true;
      cvTextarea.value = '';
      showToast('CV file loaded successfully.', 'success');
    } catch (err) {
      showToast(err.message, 'danger');
      state.resumeText = '';
      state.resumeFileName = '';
      state.resumeFileSize = '';
      fileInfoBadge.style.display = 'none';
      cvDropZone.style.display = 'flex';
      cvTextarea.disabled = false;
    }
  }

  // Run Recommendations Button
  const runMatcherBtn = document.getElementById('runMatcherBtn');
  runMatcherBtn.addEventListener('click', async () => {
    const pasteContent = cvTextarea.value.trim();
    const cvText = state.resumeText || pasteContent;

    if (!cvText || cvText.length < 15) {
      showToast('Please upload a resume or paste CV details (min 15 chars).', 'warning');
      return;
    }

    document.getElementById('matcherEmptyState').style.display = 'none';
    document.getElementById('matcherResultsContent').style.display = 'none';
    const skeleton = document.getElementById('matcherLoadingSkeleton');
    skeleton.style.display = 'block';

    if (window.innerWidth < 1024) {
      skeleton.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    try {
      let results;
      if (state.geminiApiKey) {
        try {
          if (state.geminiApiKey.startsWith('gsk_')) {
            results = await runGroqMatching(cvText, state.geminiApiKey);
            showToast('Rekomendasi Llama AI (Groq) berhasil dibuat!', 'success');
          } else {
            results = await runGeminiMatching(cvText, state.geminiApiKey);
            showToast('Rekomendasi Gemini AI berhasil dibuat!', 'success');
          }
        } catch (apiErr) {
          console.warn('API Error:', apiErr);
          const providerName = state.geminiApiKey.startsWith('gsk_') ? 'Groq' : 'Gemini';
          showToast(`${providerName} AI gagal (${apiErr.message}). Menggunakan rekomendasi Lokal Heuristik.`, 'warning');
          results = runHeuristicMatching(cvText);
        }
      } else {
        // Try calling the server-side proxy
        try {
          results = await runProxyMatching(cvText);
          showToast('Rekomendasi Server Llama AI berhasil dibuat!', 'success');
        } catch (proxyErr) {
          console.warn('Server Proxy Error:', proxyErr);
          let msg = `Server AI gagal (${proxyErr.message})`;
          if (proxyErr.message.includes('Limit harian') || proxyErr.message.includes('habis') || proxyErr.message.includes('429')) {
            msg = `Limit API Server habis! Menggunakan rekomendasi Lokal Heuristik.`;
          }
          showToast(msg, 'warning');
          results = runHeuristicMatching(cvText);
        }
      }
      renderMatcherResults(results);
    } catch (err) {
      console.error(err);
      showToast('Gagal memproses data: ' + err.message, 'danger');
      document.getElementById('matcherEmptyState').style.display = 'flex';
    } finally {
      skeleton.style.display = 'none';
    }
  });
}

function renderMatcherResults(results) {
  document.getElementById('matcherEmptyState').style.display = 'none';
  const panel = document.getElementById('matcherResultsContent');
  panel.style.display = 'block';

  // Set titles
  document.getElementById('resultDomainTitle').textContent = results.domainName;
  document.getElementById('resultMatchCount').textContent = results.recommendations.length + ' Recommended';
  
  // Set Icon
  const iconContainer = document.getElementById('resultDomainIcon');
  iconContainer.innerHTML = `<i data-lucide="${results.domainIcon}"></i>`;

  // Matched Tags
  const tagsContainer = document.getElementById('matchedSkillsTags');
  tagsContainer.innerHTML = '';

  results.matchedKeywords.forEach(tag => {
    const span = document.createElement('span');
    span.className = 'skill-match-tag active';
    span.textContent = tag;
    tagsContainer.appendChild(span);
  });

  if (results.matchedKeywords.length === 0) {
    tagsContainer.innerHTML = '<span class="skill-match-tag">General Fit</span>';
  }

  // Cards List
  const container = document.getElementById('recommendationsListContainer');
  container.innerHTML = '';

  results.recommendations.forEach(rec => {
    const isSaved = state.favorites.includes(rec.originalTitle);
    const card = document.createElement('div');
    card.className = 'rec-card';
    
    card.innerHTML = `
      <div class="rec-badge-score">
        <span>${rec.matchScore}</span>
        <small>Score</small>
      </div>
      <div class="rec-body">
        <div class="rec-meta">
          <span class="rec-company">${rec.company}</span>
          <span class="rec-ratio">${rec.rasio.toFixed(1)}x ratio</span>
        </div>
        <h4 class="rec-title">${rec.title}</h4>
        <div class="rec-loc">
          <i data-lucide="map-pin"></i>
          <span>${rec.location}</span>
        </div>
        <p class="rec-justification">${rec.justification}</p>
      </div>
      <div class="rec-actions">
        <button class="bookmark-btn ${isSaved ? 'saved' : ''}" data-title="${rec.originalTitle}" title="Add to comparisons">
          <i data-lucide="bookmark"></i>
        </button>
        <button class="btn btn-secondary inspect-btn" style="padding: 6px 12px; font-size:0.8rem;">
          <i data-lucide="eye" style="width:14px; height:14px;"></i>
          <span>View Role</span>
        </button>
      </div>
    `;

    // Bind bookmarks toggle
    card.querySelector('.bookmark-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      toggleBookmark(rec.originalTitle);
      renderMatcherResults(results); // re-render list
    });

    // Inspect
    card.querySelector('.inspect-btn').addEventListener('click', () => {
      document.getElementById('navExplorer').click();
      const input = document.getElementById('explorerSearchInput');
      input.value = rec.title;
      applyFiltersAndSort();
    });

    container.appendChild(card);
  });

  lucide.createIcons();
}

